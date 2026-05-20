"""FastAPI app entrypoint."""
from __future__ import annotations

import base64
from typing import Any

import onnx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .graph_build import BuildError, build_model
from .onnx_import import onnx_to_spec
from .ops import list_ops
from .shape_infer import infer_edge_shapes
from .tasks import list_tasks, load_task
from .verify import validate_against_task

app = FastAPI(title="onnx-editor", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GraphSpec(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    io: dict[str, str] = Field(default_factory=dict)


class ValidateRequest(BaseModel):
    spec: GraphSpec
    taskNum: int


class ImportOnnxRequest(BaseModel):
    onnxB64: str


# Reject pathologically large uploads before we try to decode/parse them.
_MAX_ONNX_BYTES = 64 * 1024 * 1024


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def get_tasks() -> list[dict[str, Any]]:
    return list_tasks()


@app.get("/api/tasks/{num}")
def get_task(num: int) -> dict[str, Any]:
    t = load_task(num)
    if t is None:
        raise HTTPException(status_code=404, detail=f"task {num} not found")
    return {"num": num, "task": t}


@app.get("/api/ops")
def get_ops() -> list[dict[str, Any]]:
    return list_ops()


@app.post("/api/build")
def post_build(spec: GraphSpec) -> dict[str, Any]:
    try:
        model = build_model(spec.model_dump())
    except BuildError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"build failed: {e}")
    blob = model.SerializeToString()
    return {
        "onnxB64": base64.b64encode(blob).decode("ascii"),
        "byteSize": len(blob),
    }


@app.post("/api/import-onnx")
def post_import_onnx(req: ImportOnnxRequest) -> dict[str, Any]:
    try:
        blob = base64.b64decode(req.onnxB64, validate=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"invalid base64 payload: {e}")
    if len(blob) > _MAX_ONNX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"model is {len(blob)} bytes; limit is {_MAX_ONNX_BYTES} bytes",
        )
    try:
        model = onnx.load_model_from_string(blob)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"not a valid .onnx model: {e}")
    try:
        return onnx_to_spec(model)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"could not convert model to graph: {e}")


@app.post("/api/infer-shapes")
def post_infer_shapes(spec: GraphSpec) -> dict[str, Any]:
    return infer_edge_shapes(spec.model_dump())


@app.post("/api/validate")
def post_validate(req: ValidateRequest) -> dict[str, Any]:
    task = load_task(req.taskNum)
    if task is None:
        raise HTTPException(status_code=404, detail=f"task {req.taskNum} not found")
    try:
        model = build_model(req.spec.model_dump())
    except BuildError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"build failed: {e}")
    return validate_against_task(model, req.taskNum, task)
