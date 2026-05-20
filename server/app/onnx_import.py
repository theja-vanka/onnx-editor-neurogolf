"""Convert an uploaded onnx.ModelProto into the editor's JSON graph spec.

This is the inverse of `graph_build.build_model`: given a parsed ONNX model we
emit the same wire format the client's `fromSpec` / `Import .json` consumes, so
an arbitrary model can be rendered on the canvas.

Mapping rules:
    - Each graph node      -> a spec node {id, op, attrs, initializers, outputs, position}
    - graph inputs         -> edges originating from the special "input" node (port 0)
    - graph outputs        -> edges feeding the special "output" node (port 0)
    - tensors in graph.initializer that feed a node input -> attached to that node's
      `initializers` list, named after the op's formal input (so a build can re-bind them)
    - other node->node tensors -> edges, with toPort set to the formal input name
      (matching the OpNode `in-<name>` handles)

Best-effort: unknown ops still render; unreadable / external-data weights fall back
to a zeros placeholder; unsupported attribute kinds (graphs, sparse) are skipped.
Anything lossy is reported back in `warnings`.
"""
from __future__ import annotations

import base64
from collections import defaultdict, deque
from typing import Any

import numpy as np
import onnx
import onnx.numpy_helper as nph

from .ops import ops_by_name

# onnx tensor dtype -> the editor's dtype strings (subset that build_initializer accepts)
_ONNX_DTYPE_TO_STR: dict[int, str] = {
    onnx.TensorProto.FLOAT: "float",
    onnx.TensorProto.FLOAT16: "float",
    onnx.TensorProto.DOUBLE: "double",
    onnx.TensorProto.INT8: "int32",
    onnx.TensorProto.INT16: "int32",
    onnx.TensorProto.INT32: "int32",
    onnx.TensorProto.INT64: "int64",
    onnx.TensorProto.UINT8: "int32",
    onnx.TensorProto.BOOL: "bool",
}

_DTYPE_TO_NP: dict[str, type] = {
    "float": np.float32,
    "double": np.float64,
    "int32": np.int32,
    "int64": np.int64,
    "bool": np.bool_,
}

# Above this many elements, embed the tensor as a base64 blob ("upload" mode)
# instead of an inline literal list, to keep the JSON payload reasonable.
_LITERAL_MAX_ELEMS = 256


def _tensor_to_init_spec(tp: onnx.TensorProto, name: str, warnings: list[str]) -> dict[str, Any]:
    dims = [int(d) for d in tp.dims] or [1]
    dtype = _ONNX_DTYPE_TO_STR.get(tp.data_type, "float")
    np_dtype = _DTYPE_TO_NP[dtype]
    try:
        arr = np.asarray(nph.to_array(tp))
        if arr.size <= _LITERAL_MAX_ELEMS:
            return {"name": name, "dtype": dtype, "shape": dims, "mode": "literal",
                    "values": arr.astype(np_dtype).flatten().tolist()}
        blob = arr.astype(np_dtype).tobytes()
        return {"name": name, "dtype": dtype, "shape": dims, "mode": "upload",
                "data_b64": base64.b64encode(blob).decode("ascii")}
    except Exception as e:  # external data, unusual dtype, etc.
        warnings.append(f"initializer {name!r}: could not read values ({e}); using zeros")
        return {"name": name, "dtype": dtype, "shape": dims, "mode": "preset", "preset": "zeros"}


def _attr_from_proto(a: onnx.AttributeProto, ctx: str, warnings: list[str]) -> Any:
    AP = onnx.AttributeProto
    t = a.type
    if t == AP.INT:
        return int(a.i)
    if t == AP.FLOAT:
        return float(a.f)
    if t == AP.STRING:
        return a.s.decode("utf-8", "replace")
    if t == AP.INTS:
        return [int(x) for x in a.ints]
    if t == AP.FLOATS:
        return [float(x) for x in a.floats]
    if t == AP.STRINGS:
        return [s.decode("utf-8", "replace") for s in a.strings]
    if t == AP.TENSOR:
        return _tensor_to_init_spec(a.t, a.t.name or ctx.replace(".", "_"), warnings)
    warnings.append(f"{ctx}: attribute kind {onnx.AttributeProto.AttributeType.Name(t)} not supported, skipped")
    return None


def _assign_node_ids(nodes: list[onnx.NodeProto]) -> list[str]:
    """Give every node a unique, canvas-safe id (reusing node.name when possible)."""
    used = {"input", "output"}
    ids: list[str] = []
    for i, node in enumerate(nodes):
        base = (node.name or "").strip() or f"{node.op_type.lower()}_{i}"
        nid = base
        k = 0
        while nid in used:
            nid = f"{base}_{k}"
            k += 1
        used.add(nid)
        ids.append(nid)
    return ids


def _layout(node_ids: list[str], edges: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    """Left-to-right layered placement using longest-path levels (op nodes only)."""
    idset = set(node_ids)
    succ: dict[str, list[str]] = {n: [] for n in node_ids}
    indeg: dict[str, int] = {n: 0 for n in node_ids}
    for e in edges:
        s, t = e["fromNode"], e["toNode"]
        if s in idset and t in idset:
            succ[s].append(t)
            indeg[t] += 1

    level = {n: 0 for n in node_ids}
    remaining = dict(indeg)
    q = deque([n for n in node_ids if indeg[n] == 0])
    visited = 0
    while q:
        u = q.popleft()
        visited += 1
        for v in succ[u]:
            if level[u] + 1 > level[v]:
                level[v] = level[u] + 1
            remaining[v] -= 1
            if remaining[v] == 0:
                q.append(v)
    # Nodes left over (cycles) keep level 0; still get placed.

    by_level: dict[int, list[str]] = defaultdict(list)
    for nid in node_ids:
        by_level[level[nid]].append(nid)

    X0, Y0, DX, DY = 320, 80, 230, 110
    pos: dict[str, dict[str, int]] = {}
    for lv, ids in by_level.items():
        for row, nid in enumerate(ids):
            pos[nid] = {"x": X0 + lv * DX, "y": Y0 + row * DY}
    return pos


def onnx_to_spec(model: onnx.ModelProto) -> dict[str, Any]:
    graph = model.graph
    warnings: list[str] = []
    schemas = ops_by_name()

    init_map = {init.name: init for init in graph.initializer}
    graph_input_names = [vi.name for vi in graph.input if vi.name not in init_map]
    graph_output_names = [vo.name for vo in graph.output]

    node_ids = _assign_node_ids(list(graph.node))

    # tensor name -> (producer node id, output port index)
    producer: dict[str, tuple[str, int]] = {}
    for name in graph_input_names:
        producer[name] = ("input", 0)
    for idx, node in enumerate(graph.node):
        for port, out_name in enumerate(node.output):
            if out_name:
                producer[out_name] = (node_ids[idx], port)

    spec_nodes: list[dict[str, Any]] = []
    spec_edges: list[dict[str, Any]] = []
    edge_id = 0

    for idx, node in enumerate(graph.node):
        nid = node_ids[idx]
        op = node.op_type
        sch = schemas.get(op)
        formal_inputs = sch["inputs"] if sch else []
        if sch is None:
            warnings.append(f"{nid}: op {op!r} is not in the opset-{10} palette; rendered without ports")

        attrs: dict[str, Any] = {}
        for a in node.attribute:
            val = _attr_from_proto(a, f"{nid}.{a.name}", warnings)
            if val is not None:
                attrs[a.name] = val

        node_inits: list[dict[str, Any]] = []
        for in_idx, in_name in enumerate(node.input):
            if not in_name:
                continue
            formal = formal_inputs[in_idx]["name"] if in_idx < len(formal_inputs) else None
            if in_name in init_map:
                # Keep the tensor's original (graph-unique) name and record which
                # input slot it feeds, so the build can re-bind it without the
                # name collisions you'd get from renaming every weight to "W"/"B".
                spec_i = _tensor_to_init_spec(init_map[in_name], in_name, warnings)
                spec_i["input"] = formal if formal is not None else in_idx
                node_inits.append(spec_i)
            elif in_name in producer:
                src_id, src_port = producer[in_name]
                spec_edges.append({
                    "id": f"e{edge_id}",
                    "fromNode": src_id,
                    "fromPort": src_port,
                    "toNode": nid,
                    "toPort": formal if formal is not None else in_idx,
                })
                edge_id += 1
            else:
                warnings.append(f"{nid}: input {in_name!r} has no producer (left unconnected)")

        spec_nodes.append({
            "id": nid,
            "op": op,
            "attrs": attrs,
            "initializers": node_inits,
            "outputs": [o for o in node.output] or None,
            "position": None,
        })

    if len(graph_output_names) > 1:
        warnings.append(
            f"model has {len(graph_output_names)} graph outputs; all routed to the single Output node"
        )
    for out_name in graph_output_names:
        if out_name in producer:
            src_id, src_port = producer[out_name]
            spec_edges.append({
                "id": f"e{edge_id}", "fromNode": src_id, "fromPort": src_port,
                "toNode": "output", "toPort": 0,
            })
            edge_id += 1
        else:
            warnings.append(f"graph output {out_name!r} has no producer")

    positions = _layout(node_ids, spec_edges)
    for n in spec_nodes:
        n["position"] = positions.get(n["id"], {"x": 320, "y": 80})

    # The editor's build + verify pipeline assumes a single graph input named
    # "input" and output named "output" (validation feeds/fetches those exact
    # names). Canonicalize so an imported model runs regardless of its original
    # tensor names — wiring is by node id, so renaming the graph I/O is safe.
    if graph_input_names and graph_input_names[0] != "input":
        warnings.append(f"graph input {graph_input_names[0]!r} renamed to 'input' for validation")
    if graph_output_names and graph_output_names[0] != "output":
        warnings.append(f"graph output {graph_output_names[0]!r} renamed to 'output' for validation")
    io = {"inputName": "input", "outputName": "output"}
    return {"spec": {"nodes": spec_nodes, "edges": spec_edges, "io": io}, "warnings": warnings}
