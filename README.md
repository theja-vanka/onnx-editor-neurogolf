# onnx-editor

Browser-based ARC task viewer and visual ONNX graph editor for the IJCAI-ECAI 2026 NeuroGolf Championship.

Inspect ARC-style grid tasks, build candidate ONNX graphs by connecting nodes, and validate against visible training examples using the real competition scorer.

## Layout

```
onnx-editor/
  server/   FastAPI backend (reuses ../neurogolf_utils)
  client/   Vite + React + TypeScript frontend
  data/     ARC task JSONs (task001.json .. task400.json)
```

## Pinned versions

- Python 3.12
- onnx 1.21.0, onnxruntime 1.24.4, onnx_tool 1.0.1, numpy 2.4.4
- node >=18, vite 5, react 18, reactflow 11

## Quickstart

```sh
make install     # creates server/.venv, installs node deps
make dev         # runs uvicorn :8000 and vite :5173 together
```

Open <http://localhost:5173>. The frontend proxies `/api/*` to the backend.

## Endpoints

- `GET  /api/tasks`            — list of available tasks
- `GET  /api/tasks/{n}`        — full task JSON (train / test / arc-gen)
- `GET  /api/ops`              — opset-10 op schemas (minus banned)
- `POST /api/build`            — graph spec → base64 ONNX
- `POST /api/infer-shapes`     — graph spec → per-edge tensor shapes
- `POST /api/validate`         — graph spec + task num → per-example pass/fail, memory, params, points

## Banned ops (enforced server-side)

`LOOP, SCAN, NONZERO, UNIQUE, SCRIPT, FUNCTION, COMPRESS`
