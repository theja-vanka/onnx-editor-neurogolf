"""Opset-10 schema dump (minus banned ops) for the client palette + attribute forms."""
from __future__ import annotations

from functools import lru_cache
from typing import Any

import onnx
import onnx.defs

from .config import EXCLUDED_OP_TYPES, OPSET_VERSION

_ATTR_TYPE_NAMES = {
    onnx.AttributeProto.UNDEFINED: "undefined",
    onnx.AttributeProto.FLOAT: "float",
    onnx.AttributeProto.INT: "int",
    onnx.AttributeProto.STRING: "string",
    onnx.AttributeProto.TENSOR: "tensor",
    onnx.AttributeProto.GRAPH: "graph",
    onnx.AttributeProto.FLOATS: "floats",
    onnx.AttributeProto.INTS: "ints",
    onnx.AttributeProto.STRINGS: "strings",
    onnx.AttributeProto.TENSORS: "tensors",
    onnx.AttributeProto.GRAPHS: "graphs",
}


def _attr_default(attr: onnx.defs.OpSchema.Attribute) -> Any:
    if not attr.default_value or attr.default_value.type == onnx.AttributeProto.UNDEFINED:
        return None
    dv = attr.default_value
    t = dv.type
    if t == onnx.AttributeProto.FLOAT:
        return dv.f
    if t == onnx.AttributeProto.INT:
        return dv.i
    if t == onnx.AttributeProto.STRING:
        return dv.s.decode("utf-8", errors="replace")
    if t == onnx.AttributeProto.FLOATS:
        return list(dv.floats)
    if t == onnx.AttributeProto.INTS:
        return list(dv.ints)
    if t == onnx.AttributeProto.STRINGS:
        return [s.decode("utf-8", errors="replace") for s in dv.strings]
    return None


def _formal_param(fp: onnx.defs.OpSchema.FormalParameter) -> dict[str, Any]:
    option = "single"
    try:
        if fp.option == onnx.defs.OpSchema.FormalParameterOption.Variadic:
            option = "variadic"
        elif fp.option == onnx.defs.OpSchema.FormalParameterOption.Optional:
            option = "optional"
    except AttributeError:
        pass
    type_str = getattr(fp, "type_str", None) or getattr(fp, "typeStr", "")
    return {
        "name": fp.name,
        "description": (fp.description or "").strip(),
        "typeStr": type_str,
        "option": option,
    }


@lru_cache(maxsize=1)
def list_ops() -> list[dict[str, Any]]:
    schemas: list[onnx.defs.OpSchema] = []
    for s in onnx.defs.get_all_schemas_with_history():
        if s.domain not in ("", "ai.onnx"):
            continue
        if s.since_version > OPSET_VERSION:
            continue
        if s.deprecated:
            continue
        schemas.append(s)
    by_name: dict[str, onnx.defs.OpSchema] = {}
    for s in schemas:
        cur = by_name.get(s.name)
        if cur is None or s.since_version > cur.since_version:
            by_name[s.name] = s

    out: list[dict[str, Any]] = []
    for name in sorted(by_name):
        if name.upper() in EXCLUDED_OP_TYPES:
            continue
        s = by_name[name]
        attrs = []
        for attr_name, attr in s.attributes.items():
            attrs.append({
                "name": attr_name,
                "type": _ATTR_TYPE_NAMES.get(attr.type, "undefined"),
                "default": _attr_default(attr),
                "required": attr.required,
                "description": (attr.description or "").strip(),
            })
        out.append({
            "name": s.name,
            "sinceVersion": s.since_version,
            "doc": (s.doc or "").strip().split("\n")[0],
            "inputs": [_formal_param(fp) for fp in s.inputs],
            "outputs": [_formal_param(fp) for fp in s.outputs],
            "attributes": sorted(attrs, key=lambda a: a["name"]),
        })
    return out


@lru_cache(maxsize=1)
def ops_by_name() -> dict[str, dict[str, Any]]:
    return {op["name"]: op for op in list_ops()}
