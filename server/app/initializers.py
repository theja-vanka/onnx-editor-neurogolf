"""Initializer evaluation for the 4 client modes: literal / preset / formula / upload.

Each initializer in the editor's graph spec looks like:

    {
        "name": "W",
        "dtype": "float",
        "shape": [10, 10, 3, 3],
        "mode": "formula" | "literal" | "preset" | "upload",
        # mode-specific:
        "expr": "1.0 if (o == i and r == 0 and c == 0) else 0.0",
        "vars": ["o", "i", "r", "c"],
        "values": [ ... flat list ... ],
        "preset": "zeros" | "ones" | "identity",
        "data_b64": "<base64 of the values array>",  # for upload mode
    }
"""
from __future__ import annotations

import ast
import base64
import math
from typing import Any

import numpy as np
import onnx

_DTYPE_TO_ONNX = {
    "float": onnx.TensorProto.FLOAT,
    "float32": onnx.TensorProto.FLOAT,
    "float64": onnx.TensorProto.DOUBLE,
    "double": onnx.TensorProto.DOUBLE,
    "int32": onnx.TensorProto.INT32,
    "int64": onnx.TensorProto.INT64,
    "int": onnx.TensorProto.INT64,
    "bool": onnx.TensorProto.BOOL,
}

_DTYPE_TO_NP = {
    "float": np.float32,
    "float32": np.float32,
    "float64": np.float64,
    "double": np.float64,
    "int32": np.int32,
    "int64": np.int64,
    "int": np.int64,
    "bool": np.bool_,
}

_ALLOWED_NODES: tuple[type, ...] = (
    ast.Expression,
    ast.BinOp, ast.UnaryOp, ast.BoolOp, ast.Compare, ast.IfExp,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.USub, ast.UAdd, ast.Not,
    ast.And, ast.Or,
    ast.Eq, ast.NotEq, ast.Lt, ast.LtE, ast.Gt, ast.GtE,
    ast.Name, ast.Load, ast.Constant, ast.Tuple, ast.List,
    ast.Call, ast.Attribute,
)

_ALLOWED_FUNCS = {
    "abs": abs, "min": min, "max": max, "int": int, "float": float, "round": round,
    "math": math,
}

_ALLOWED_MATH_ATTRS = {
    "pi", "e", "sqrt", "sin", "cos", "tan", "exp", "log", "log2", "log10",
    "floor", "ceil", "tanh", "atan", "atan2", "pow", "fabs", "fmod",
}


def _validate_expr(tree: ast.AST, allowed_vars: set[str]) -> None:
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise ValueError(f"disallowed expression syntax: {type(node).__name__}")
        if isinstance(node, ast.Name):
            if node.id in allowed_vars or node.id in _ALLOWED_FUNCS:
                continue
            raise ValueError(f"unknown name in expression: {node.id!r}")
        if isinstance(node, ast.Attribute):
            if isinstance(node.value, ast.Name) and node.value.id == "math":
                if node.attr in _ALLOWED_MATH_ATTRS:
                    continue
            raise ValueError(f"disallowed attribute access: {ast.dump(node)}")
        if isinstance(node, ast.Call):
            func = node.func
            ok = False
            if isinstance(func, ast.Name) and func.id in _ALLOWED_FUNCS:
                ok = True
            elif isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "math":
                if func.attr in _ALLOWED_MATH_ATTRS:
                    ok = True
            if not ok:
                raise ValueError(f"disallowed function call: {ast.dump(func)}")


def _eval_formula(expr: str, var_names: list[str], shape: list[int]) -> np.ndarray:
    if not var_names:
        raise ValueError("formula mode requires at least one variable name")
    if len(var_names) != len(shape):
        raise ValueError(
            f"formula vars ({var_names}) must match shape rank ({len(shape)})"
        )
    tree = ast.parse(expr, mode="eval")
    _validate_expr(tree, allowed_vars=set(var_names))
    code = compile(tree, filename="<initializer>", mode="eval")

    total = 1
    for d in shape:
        if d <= 0:
            raise ValueError(f"shape dims must be positive, got {shape}")
        total *= d
    out = np.empty(total, dtype=np.float64)
    idx_ranges = [range(d) for d in shape]

    base_globals: dict[str, Any] = {"math": math, **_ALLOWED_FUNCS}
    base_globals["__builtins__"] = {}

    counter = 0
    def _recurse(depth: int, env: dict[str, Any]) -> None:
        nonlocal counter
        if depth == len(shape):
            v = eval(code, base_globals, env)
            out[counter] = float(v)
            counter += 1
            return
        name = var_names[depth]
        for i in idx_ranges[depth]:
            env[name] = i
            _recurse(depth + 1, env)
    _recurse(0, {})
    return out.reshape(shape)


def _preset(name: str, shape: list[int]) -> np.ndarray:
    if name == "zeros":
        return np.zeros(shape, dtype=np.float64)
    if name == "ones":
        return np.ones(shape, dtype=np.float64)
    if name == "identity":
        if len(shape) < 2 or shape[-1] != shape[-2]:
            raise ValueError("identity preset requires last two dims equal")
        eye = np.eye(shape[-1], dtype=np.float64)
        if len(shape) == 2:
            return eye
        leading = shape[:-2]
        return np.broadcast_to(eye, shape).copy()
    raise ValueError(f"unknown preset {name!r}")


def _from_upload(data_b64: str, shape: list[int], np_dtype: type) -> np.ndarray:
    raw = base64.b64decode(data_b64)
    arr = np.frombuffer(raw, dtype=np_dtype).copy()
    expected = 1
    for d in shape:
        expected *= d
    if arr.size != expected:
        raise ValueError(
            f"upload contains {arr.size} elements, shape {shape} requires {expected}"
        )
    return arr.reshape(shape)


def build_initializer(spec: dict[str, Any]) -> onnx.TensorProto:
    name = spec.get("name")
    if not name:
        raise ValueError("initializer missing 'name'")
    dtype_str = spec.get("dtype", "float")
    if dtype_str not in _DTYPE_TO_ONNX:
        raise ValueError(f"unsupported dtype {dtype_str!r}")
    onnx_dtype = _DTYPE_TO_ONNX[dtype_str]
    np_dtype = _DTYPE_TO_NP[dtype_str]

    shape = list(spec.get("shape", []))
    if not shape or any((not isinstance(d, int)) or d <= 0 for d in shape):
        raise ValueError(f"initializer {name!r} requires positive integer shape, got {shape}")

    mode = spec.get("mode", "literal")
    if mode == "literal":
        values = spec.get("values")
        if values is None:
            raise ValueError(f"initializer {name!r}: literal mode requires 'values'")
        arr = np.asarray(values, dtype=np_dtype).reshape(shape)
    elif mode == "preset":
        arr = _preset(spec.get("preset", ""), shape).astype(np_dtype)
    elif mode == "formula":
        expr = spec.get("expr", "")
        var_names = list(spec.get("vars", []))
        arr = _eval_formula(expr, var_names, shape).astype(np_dtype)
    elif mode == "upload":
        data_b64 = spec.get("data_b64", "")
        arr = _from_upload(data_b64, shape, np_dtype)
    else:
        raise ValueError(f"unknown initializer mode {mode!r}")

    return onnx.helper.make_tensor(
        name=name,
        data_type=onnx_dtype,
        dims=list(shape),
        vals=arr.flatten().tolist(),
    )
