"""Run onnx.shape_inference over a built model and return per-edge tensor shapes.

The client passes the same graph-spec edges that built the model. Each edge maps
to the tensor name of (fromNode, fromPort) in the model's output ports. We look
that up against shape_inference's value_info table.
"""
from __future__ import annotations

from typing import Any

import onnx
import onnx.shape_inference

from .graph_build import build_model


def infer_edge_shapes(spec: dict[str, Any]) -> dict[str, Any]:
    try:
        model = build_model(spec)
    except Exception as e:
        return {"ok": False, "error": str(e), "edges": {}}

    try:
        inferred = onnx.shape_inference.infer_shapes(model, strict_mode=False)
    except Exception as e:
        return {"ok": False, "error": f"shape inference failed: {e}", "edges": {}}

    shape_map: dict[str, list[int | str]] = {}
    g = inferred.graph
    for vi in list(g.input) + list(g.value_info) + list(g.output):
        if not vi.type.HasField("tensor_type"):
            continue
        tt = vi.type.tensor_type
        dims: list[int | str] = []
        if not tt.HasField("shape"):
            shape_map[vi.name] = []
            continue
        for d in tt.shape.dim:
            if d.HasField("dim_value"):
                dims.append(d.dim_value)
            elif d.HasField("dim_param"):
                dims.append(d.dim_param)
            else:
                dims.append("?")
        shape_map[vi.name] = dims

    # Resolve each edge to a tensor name via the same logic as build_model.
    from .config import EXCLUDED_OP_TYPES
    from .ops import ops_by_name
    schemas = ops_by_name()
    input_name = spec.get("io", {}).get("inputName", "input")

    node_outputs: dict[str, list[str]] = {"input": [input_name], "output": []}
    for n in spec.get("nodes", []):
        nid = n.get("id")
        if not nid or nid in ("input", "output"):
            continue
        op = n.get("op", "")
        if op.upper() in EXCLUDED_OP_TYPES:
            continue
        sch = schemas.get(op)
        explicit = n.get("outputs")
        if explicit:
            node_outputs[nid] = list(explicit)
        else:
            num = max(1, len(sch["outputs"])) if sch else 1
            node_outputs[nid] = [f"{nid}__out{i}" for i in range(num)]

    edge_shapes: dict[str, list[int | str]] = {}
    for e in spec.get("edges", []):
        eid = e.get("id")
        if not eid:
            continue
        src = e.get("fromNode")
        port = int(e.get("fromPort", 0))
        outs = node_outputs.get(src, [])
        if port < 0 or port >= len(outs):
            continue
        tensor = outs[port]
        if tensor in shape_map:
            edge_shapes[eid] = shape_map[tensor]
    return {"ok": True, "error": None, "edges": edge_shapes}
