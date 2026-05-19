"""Validate a built ONNX model against an ARC task, mirroring neurogolf_utils.verify_network.

Returns structured JSON instead of matplotlib output. Reuses calculate_memory and
calculate_params copies inlined here so the server has no Python-path dependency on
neurogolf_utils/ (which is a sibling, not a Python package).
"""
from __future__ import annotations

import json
import math
import traceback
from typing import Any

import numpy as np
import onnx
import onnxruntime

from .config import (
    BATCH_SIZE,
    CHANNELS,
    FILESIZE_LIMIT_IN_BYTES,
    HEIGHT,
    WIDTH,
    WORK_DIR,
)


def _convert_to_numpy(example: dict[str, Any]) -> dict[str, np.ndarray] | None:
    shape = (BATCH_SIZE, CHANNELS, HEIGHT, WIDTH)
    out: dict[str, np.ndarray] = {}
    for mode in ("input", "output"):
        out[mode] = np.zeros(shape, dtype=np.float32)
        grid = example[mode]
        if max(len(grid), len(grid[0]) if grid else 0) > 30:
            return None
        for r, row in enumerate(grid):
            for c, color in enumerate(row):
                if 0 <= color < CHANNELS:
                    out[mode][0][color][r][c] = 1.0
    return out


def _convert_from_numpy(arr: np.ndarray) -> list[list[int]]:
    _, channels, height, width = arr.shape
    rows: list[list[int]] = []
    for row in range(height):
        cells: list[int] = []
        for col in range(width):
            colors = [c for c in range(channels) if arr[0][c][row][col] == 1]
            cells.append(colors[0] if len(colors) == 1 else (11 if colors else 10))
        while cells and cells[-1] == 10:
            cells.pop()
        rows.append(cells)
    while rows and not rows[-1]:
        rows.pop()
    return rows


def _calculate_memory(model: onnx.ModelProto, trace_path: str) -> int | None:
    try:
        onnx.checker.check_model(model, full_check=True)
    except Exception:
        return None
    graph = onnx.shape_inference.infer_shapes(model, strict_mode=True).graph
    if len(graph.input) > 1 or len(graph.output) > 1:
        return None
    init_names = {init.name for init in graph.initializer}
    init_names.update(init.name for init in graph.sparse_initializer)
    io_names = {t.name for t in list(graph.input) + list(graph.output)}
    if io_names.intersection(init_names):
        return None
    if model.functions:
        return None
    for opset in model.opset_import:
        if opset.domain not in {"", "ai.onnx"}:
            return None
    node_outputs: dict[str, list[str]] = {}
    tensor_names: set[str] = set()
    for node in graph.node:
        for attr in node.attribute:
            if attr.type in (onnx.AttributeProto.GRAPH, onnx.AttributeProto.GRAPHS):
                return None
        node_outputs[node.name] = list(node.output)
        for output_name in node.output:
            if output_name:
                tensor_names.add(output_name)
    tensor_memory: dict[str, int] = {}
    tensor_dtypes: dict[str, np.dtype] = {}
    tensor_map = {t.name: t for t in list(graph.input) + list(graph.value_info) + list(graph.output)}
    tensor_names.update(tensor_map.keys())
    for tensor_name in tensor_names:
        item = tensor_map.get(tensor_name)
        if not item:
            return None
        if item.type.HasField("sequence_type"):
            return None
        if not item.type.HasField("tensor_type"):
            continue
        tt = item.type.tensor_type
        if not tt.HasField("shape"):
            return None
        num_elements = 1
        for dim in tt.shape.dim:
            if dim.HasField("dim_param"):
                return None
            if not dim.HasField("dim_value"):
                return None
            if dim.dim_value <= 0:
                return None
            num_elements *= dim.dim_value
        if tensor_name in ("input", "output"):
            continue
        np_dtype = onnx.helper.tensor_dtype_to_np_dtype(tt.elem_type)
        tensor_memory[tensor_name] = num_elements * np.dtype(np_dtype).itemsize
        tensor_dtypes[tensor_name] = np_dtype

    with open(trace_path) as f:
        trace_data = json.load(f)
    for event in trace_data:
        if event.get("cat") != "Node" or "args" not in event:
            continue
        if "output_type_shape" not in event["args"]:
            continue
        node_name = event.get("name", "").replace("_kernel_time", "")
        if node_name not in node_outputs:
            continue
        for i, shape_dict in enumerate(event["args"]["output_type_shape"]):
            if i >= len(node_outputs[node_name]):
                continue
            output_name = node_outputs[node_name][i]
            if output_name not in tensor_dtypes:
                continue
            itemsize = np.dtype(tensor_dtypes[output_name]).itemsize
            mem = itemsize * sum(math.prod(dims) for dims in shape_dict.values())
            tensor_memory[output_name] = max(tensor_memory[output_name], mem)
    return sum(tensor_memory.values())


def _calculate_params(model: onnx.ModelProto) -> int | None:
    params = 0
    for init in model.graph.initializer:
        if any(d <= 0 for d in init.dims):
            return None
        params += math.prod(init.dims)
    for sparse_init in model.graph.sparse_initializer:
        if any(d <= 0 for d in sparse_init.values.dims):
            return None
        params += math.prod(sparse_init.values.dims)
    for node in model.graph.node:
        if node.op_type != "Constant":
            continue
        for attr in node.attribute:
            if attr.name == "value":
                if any(d <= 0 for d in attr.t.dims):
                    return None
                params += math.prod(attr.t.dims)
            elif attr.name == "sparse_value":
                if any(d <= 0 for d in attr.sparse_tensor.values.dims):
                    return None
                params += math.prod(attr.sparse_tensor.values.dims)
            elif attr.name == "value_floats":
                params += len(attr.floats)
            elif attr.name == "value_ints":
                params += len(attr.ints)
            elif attr.name == "value_strings":
                params += len(attr.strings)
    return params


def _run_network(session: onnxruntime.InferenceSession, benchmark_input: np.ndarray) -> np.ndarray:
    result = session.run(["output"], {"input": benchmark_input})
    return (result[0] > 0.0).astype(float)


def _verify_subset(
    session: onnxruntime.InferenceSession, subset: list[dict[str, Any]], label: str
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for idx, example in enumerate(subset):
        rec: dict[str, Any] = {
            "set": label,
            "idx": idx,
            "pass": False,
            "expected": example.get("output"),
            "input": example.get("input"),
            "actual": None,
            "error": None,
        }
        benchmark = _convert_to_numpy(example)
        if benchmark is None:
            rec["error"] = "example exceeds 30x30 limit"
            out.append(rec)
            continue
        try:
            user_output = _run_network(session, benchmark["input"])
            rec["actual"] = _convert_from_numpy(user_output)
            rec["pass"] = bool(np.array_equal(user_output, benchmark["output"]))
        except onnxruntime.OrtException as e:
            rec["error"] = f"runtime error: {e}"
        except Exception:
            rec["error"] = traceback.format_exc()
        out.append(rec)
    return out


def validate_against_task(model: onnx.ModelProto, task_num: int, examples: dict[str, Any]) -> dict[str, Any]:
    """Run validate flow. Returns a dict the client can render directly."""
    filename = WORK_DIR / f"task{task_num:03d}.onnx"
    onnx.save(model, str(filename))
    size = filename.stat().st_size
    if size > FILESIZE_LIMIT_IN_BYTES:
        return {
            "ok": False,
            "error": f"file size {size} bytes exceeds limit {FILESIZE_LIMIT_IN_BYTES}",
            "perExample": [],
            "memory": None,
            "params": None,
            "points": None,
            "fileSize": size,
        }

    try:
        sanitized = onnx.load(str(filename))
        for node in sanitized.graph.node:
            node.name = node.output[0]
            if "kernel_time" in node.name:
                return {
                    "ok": False,
                    "error": "node name contains banned 'kernel_time' string",
                    "perExample": [],
                    "memory": None,
                    "params": None,
                    "points": None,
                    "fileSize": size,
                }
        options = onnxruntime.SessionOptions()
        options.enable_profiling = True
        options.graph_optimization_level = onnxruntime.GraphOptimizationLevel.ORT_DISABLE_ALL
        options.profile_file_prefix = str(WORK_DIR / f"{task_num:03d}")
        session = onnxruntime.InferenceSession(sanitized.SerializeToString(), options)
    except Exception as e:
        return {
            "ok": False,
            "error": f"unable to load ONNX model: {e}",
            "perExample": [],
            "memory": None,
            "params": None,
            "points": None,
            "fileSize": size,
        }

    train = list(examples.get("train", []))
    test = list(examples.get("test", []))
    arc_gen = list(examples.get("arc-gen", []))

    per_example = (
        _verify_subset(session, train, "train")
        + _verify_subset(session, test, "test")
        + _verify_subset(session, arc_gen, "arc-gen")
    )
    trace_path = session.end_profiling()
    memory = _calculate_memory(sanitized, trace_path)
    params = _calculate_params(sanitized)

    points: float | None
    if memory is None or params is None or memory < 0 or params < 0:
        points = None
    else:
        points = max(1.0, 25.0 - math.log(max(1.0, memory + params)))

    summary = {
        "train": _counts(per_example, "train"),
        "test": _counts(per_example, "test"),
        "arc-gen": _counts(per_example, "arc-gen"),
    }
    summary["total"] = {
        "pass": sum(v["pass"] for v in summary.values()),
        "fail": sum(v["fail"] for v in summary.values()),
    }

    return {
        "ok": True,
        "error": None,
        "perExample": per_example,
        "summary": summary,
        "memory": memory,
        "params": params,
        "points": points,
        "fileSize": size,
    }


def _counts(records: list[dict[str, Any]], label: str) -> dict[str, int]:
    sub = [r for r in records if r["set"] == label]
    return {
        "pass": sum(1 for r in sub if r["pass"]),
        "fail": sum(1 for r in sub if not r["pass"]),
    }
