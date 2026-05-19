# onnx-editor

[ Python 3.12 ] [ FastAPI ] [ React 18 ] [ React Flow ] [ ONNX 1.21 ] [ onnxruntime 1.24 ] [ Vite 5 ] [ ARC-AGI ]

`onnx-editor` is a browser-based ARC task viewer and visual ONNX graph editor for the IJCAI-ECAI 2026 NeuroGolf Championship. It lets you inspect ARC-style grid tasks, build candidate ONNX graphs by dragging and connecting nodes, and validate them end-to-end against every visible train, test, and arc-gen example using the same scoring path the competition uses.

The intended workflow is human-in-the-loop solving in the web GUI: pick a task, look at the examples, sketch a graph, click **Validate**, iterate. Every endpoint is regular JSON so the same backend can also be driven from notebooks or scripts.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Web GUI Workflow](#web-gui-workflow)
- [Graph spec wire format](#graph-spec-wire-format)
- [Initializer modes](#initializer-modes)
- [Supported Ops](#supported-ops)
- [Banned Ops](#banned-ops)
- [Validation flow](#validation-flow)
- [HTTP API](#http-api)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Repo layout](#repo-layout)
- [Pinned versions](#pinned-versions)
- [Kaggle Workflow](#kaggle-workflow)
- [Development Checks](#development-checks)
- [Repo Safety](#repo-safety)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- Indexes every ARC task in `data/task001.json` … `data/task400.json` and exposes them through a dropdown + jump-by-number picker.
- Horizontal task-examples strip across the top: train, test, and arc-gen groups rendered side-by-side using the exact 12-color ARC palette from the competition utilities.
- React Flow graph canvas in the center: drag from the **Ops** palette, wire nodes by their formal ONNX input names (`X`, `W`, `B`, …), edge labels show shapes inferred by `onnx.shape_inference`.
- Properties panel on the right: auto-generated attribute forms (types pulled from `onnx.defs.get_schema`), and a four-mode initializer editor for weights and constants.
- Backend compiler reuses `neurogolf_utils` semantics: writes the ONNX through `onnx_tool`-style checks, enforces the 1.44 MB filesize limit, blocks the banned op set, and returns memory + params + points exactly as the competition scorer.
- Per-example pass/fail with `expected` (green border) vs `actual` (red border) grid overlays on failures.
- Per-task localStorage autosave; explicit `Export .onnx` and `Export .json` / `Import .json` for sharing or submitting.
- Dark/light theme toggle, keyboard shortcuts, and a collapsible validation dock.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ Topbar  — title · task picker · import / export / reset / theme     │
├──────────────────────────────────────────────────────────────────────┤
│ Examples strip  (horizontal scroll: train | test | arc-gen)         │
├───────────────┬────────────────────────────────────┬────────────────┤
│ Ops palette   │  React Flow canvas                 │  Properties    │
│ (search,      │  · OpNode (named input handles)    │  · attributes  │
│  draggable    │  · IONode (fixed 1,10,30,30)       │  · initializers│
│  list of      │  · ShapeEdge (live shape labels)   │    (4 modes)   │
│  133 ops)     │  · ValidateDock (overlay)          │                │
└───────────────┴────────────────────────────────────┴────────────────┘
```

- The **client** is a single-page Vite/React/TypeScript app that owns the graph as zustand state.
- The **server** is a small FastAPI app that owns ONNX building, shape inference, and validation. It serves the static task JSONs and the opset-10 schema.
- The frontend talks to the backend over `fetch` via Vite's `/api` proxy on port `8000` (config in `client/vite.config.ts`).

---

## Quick Start

Prerequisites: Python 3.12, Node ≥ 18, `make`.

```bash
make install    # creates server/.venv with pinned deps, installs node_modules
make dev        # boots backend (:8000) and frontend (:5173) together
```

Then open <http://localhost:5173>.

`make dev` uses a bash `trap 'kill 0'` on the recipe shell so one Ctrl-C tears both processes down cleanly. `make start` is an alias for `make dev`.

To run them separately:

```bash
make server     # uvicorn app.main:app --reload --port 8000
make client     # vite (port 5173)
```

To wipe the venv and node_modules:

```bash
make clean
```

---

## Configuration

Environment variables are read by the FastAPI app:

| Variable    | Default                            | Meaning                                                           |
|-------------|------------------------------------|-------------------------------------------------------------------|
| `DATA_DIR`  | `<repo>/data`                      | Folder containing `task001.json` … `task400.json`.                |
| `WORK_DIR`  | `<repo>/server/.workdir`           | Where built `.onnx` files and onnxruntime profiler traces land.   |

There are no secrets — `onnx-editor` does not upload anything anywhere. The built `.onnx` is downloaded directly by the browser on **Export .onnx**.

---

## Web GUI Workflow

1. **Pick a task.** Use the dropdown in the topbar, or type a number 1–400 and press Enter to jump.
2. **Inspect examples.** The horizontal strip shows train, test, and arc-gen pairs side-by-side. Inputs are on the left of each pair, outputs on the right, separated by `→`.
3. **Drop ops onto the canvas.** Search the left palette (`Abs`, `Add`, `Conv`, `Concat`, …), then drag onto the React Flow surface.
4. **Wire nodes.** Each op shows its formal ONNX inputs as named handles (`X`, `W`, `B`, …). Drag from a source handle to a target handle. Edge labels appear with the inferred tensor shape, e.g. `[1,10,30,30]`.
5. **Edit attributes.** Select a node. The right pane shows an auto-generated form with the correct type for every attribute, including required-flag indicators and the official ONNX defaults.
6. **Provide initializers.** For ops that need weights (Conv `W`, MatMul `B`, …), add an initializer in the right pane. Each initializer's `name` should match a formal input name (e.g. `W` for Conv) so the builder can wire it automatically.
7. **Connect the Output node.** The graph must end at the fixed `[1,10,30,30] float` Output. Anything beyond a `> 0.0` threshold counts as a `1` in the one-hot channel.
8. **Validate.** Open the `Validate` dock (bottom-right of the canvas) and click `Validate`. The backend builds the model, runs it through onnxruntime against every example, and returns pass/fail plus memory / params / points.
9. **Export.** When you are satisfied, click `Export .onnx` to download the model. Use `Export .json` for the editor's graph spec; that one round-trips back through `Import .json`.

A useful first graph for verifying the wiring is a 1×1 identity Conv:

```text
Input ─[X]─► Conv (kernel_shape=[1,1], pads=[0,0,0,0], W="formula 1.0 if o==i else 0.0", shape=[10,10,1,1]) ─► Output
```

That builds, validates, and returns 100 params + ~20.4 points, but fails every example because no real ARC task is an identity transformation. It is the smallest end-to-end smoke test.

---

## Graph spec wire format

Every editor state can be serialized to JSON. The same shape is what `/api/build`, `/api/infer-shapes`, and `/api/validate` accept on the wire.

```json
{
  "io": { "inputName": "input", "outputName": "output" },
  "nodes": [
    {
      "id": "conv1",
      "op": "Conv",
      "attrs": { "kernel_shape": [3, 3], "pads": [1, 1, 1, 1], "strides": [1, 1] },
      "initializers": [
        {
          "name": "W",
          "dtype": "float",
          "shape": [10, 10, 3, 3],
          "mode": "formula",
          "vars": ["o", "i", "r", "c"],
          "expr": "1.0 if (o == i and r == 0 and c == 0) else 0.0"
        }
      ],
      "position": { "x": 320, "y": 200 }
    }
  ],
  "edges": [
    { "id": "e1", "fromNode": "input", "fromPort": 0, "toNode": "conv1", "toPort": "X" },
    { "id": "e2", "fromNode": "conv1", "fromPort": 0, "toNode": "output", "toPort": 0 }
  ]
}
```

Conventions:

- `id == "input"` is the implicit graph Input ValueInfo (`[1, 10, 30, 30] float`).
- `id == "output"` is the implicit graph Output ValueInfo (same shape).
- `fromPort` is the integer output index of the source node.
- `toPort` is either the integer input index *or* the formal input name from the ONNX schema. The string form (`"X"`, `"W"`, `"B"`) is more robust to op changes.
- `position` is purely for the editor; the builder ignores it.
- Initializers whose `name` matches a formal input name (`W`, `B`, …) are wired to that slot automatically.

---

## Initializer modes

| Mode      | Use when                                                | Spec fields                                              |
|-----------|---------------------------------------------------------|----------------------------------------------------------|
| `literal` | You have a flat list of numbers ready.                  | `values: number[]`                                       |
| `preset`  | Standard fills: zeros, ones, identity matrix.           | `preset: "zeros" \| "ones" \| "identity"`                |
| `formula` | The kernel is defined by a closed-form rule on indices. | `vars: string[]`, `expr: string`                         |
| `upload`  | You have a precomputed `.npy` (or raw bytes).           | `data_b64: string` (base64 of the values buffer)         |

The `formula` evaluator is an AST-walk allowlist — only arithmetic, comparisons, `if/else` ternary, `min/max/abs/int/float/round`, and `math.*` (pi, e, sqrt, sin, cos, tan, exp, log, log2, log10, floor, ceil, tanh, atan, atan2, pow, fabs, fmod) are accepted. Anything else (attribute access, calls, imports) is rejected at build time before any code runs.

Example: a 3×3 Sobel-x kernel as a single initializer ::

```text
vars:  o, i, r, c
shape: [10, 10, 3, 3]
expr:  (1.0 if c == 2 else -1.0 if c == 0 else 0.0) * (2.0 if r == 1 else 1.0) if o == i else 0.0
```

---

## Supported Ops

`onnx-editor` exposes every op defined in opset 10 minus the competition's banned list, as derived live from `onnx.defs.get_schema`. Counts and exact names match whatever your pinned `onnx` version reports — currently **133 ops**. Categories most relevant to ARC tasks:

```text
Arithmetic:      Add Sub Mul Div Mod Neg Abs Sign Pow Sqrt Reciprocal
Logical:         Equal Greater Less Not And Or Xor Where
Comparison/Ops:  Min Max Sum Mean Clip Cast Identity Constant
Reductions:      ReduceSum ReduceProd ReduceMean ReduceMax ReduceMin
                 ReduceL1 ReduceL2 ReduceLogSum ReduceLogSumExp ReduceSumSquare
                 ArgMax ArgMin
Spatial:         Conv ConvTranspose MaxPool AveragePool GlobalMaxPool GlobalAveragePool
                 LpPool LpNormalization InstanceNormalization BatchNormalization
Shape/Layout:    Reshape Transpose Squeeze Unsqueeze Flatten Concat Split
                 Slice Pad Tile Resize Gather GatherND Scatter ScatterND
                 SpaceToDepth DepthToSpace
Activations:     Relu LeakyRelu Elu Selu PRelu Sigmoid Tanh Softmax LogSoftmax
                 HardSigmoid Softplus Softsign ThresholdedRelu
Linear algebra:  MatMul Gemm
```

Every op's full attribute schema (names, types, defaults, required-flag) is fetched at app start from `GET /api/ops`, so the attribute forms are always in sync with whatever ONNX version is installed.

---

## Banned Ops

The following are rejected at `/api/build` time with HTTP 400 to match the competition rules:

```text
LOOP   SCAN   NONZERO   UNIQUE   SCRIPT   FUNCTION   COMPRESS
```

Also rejected:

- Graphs with more than one input or output.
- Subgraph attributes (`GRAPH`, `GRAPHS`) — disallows control flow regardless of op.
- Tensor names containing the substring `kernel_time` (collides with onnxruntime profiler internals).
- Name collisions between tensors and initializers.

---

## Validation flow

`POST /api/validate` mirrors `neurogolf_utils.verify_network` end-to-end:

1. Build the ONNX model from the JSON spec.
2. Save to `WORK_DIR/task{N:03d}.onnx`. Reject if file size > 1.44 MB.
3. Sanitize node names (`node.name = node.output[0]`) and reject if any name contains `kernel_time`.
4. Open an `InferenceSession` with `enable_profiling=True` and `ORT_DISABLE_ALL` optimization (so the profiler reports the actual graph, not a fused one).
5. For every example in `train`, `test`, and `arc-gen`:
   - Encode the input grid as a `(1, 10, 30, 30)` one-hot float tensor.
   - Run the session.
   - Threshold the output at `> 0.0`.
   - Compare elementwise to the expected one-hot output.
6. Stop profiling. Compute memory from the profiler trace + `onnx.shape_inference`, and params from `graph.initializer` + Constant-op tensors. Both calculations are direct ports of `neurogolf_utils.calculate_memory` and `calculate_params`.
7. Score: `points = max(1.0, 25.0 - log(max(1.0, memory + params)))`.

The response is structured JSON the UI can render directly — per-example expected vs actual grids on failures, plus the score card.

---

## HTTP API

| Method | Path                  | Body                          | Returns                                                                          |
|--------|-----------------------|-------------------------------|----------------------------------------------------------------------------------|
| GET    | `/api/health`         | —                             | `{ "status": "ok" }`                                                             |
| GET    | `/api/tasks`          | —                             | `[{ num, filename, trainCount, testCount, arcGenCount }]` (400 items)            |
| GET    | `/api/tasks/{n}`      | —                             | `{ num, task: { train: [], test: [], "arc-gen": [] } }`                          |
| GET    | `/api/ops`            | —                             | `OpSchema[]` (opset-10 minus banned, ~133 items)                                 |
| POST   | `/api/build`          | `GraphSpec`                   | `{ onnxB64, byteSize }`                                                          |
| POST   | `/api/infer-shapes`   | `GraphSpec`                   | `{ ok, error, edges: { edgeId: [dims] } }`                                       |
| POST   | `/api/validate`       | `{ spec: GraphSpec, taskNum }`| `{ ok, perExample[], summary, memory, params, points, fileSize, error }`         |

All responses are JSON; CORS is enabled for `http://localhost:5173`.

---

## Keyboard shortcuts

| Keys                 | Action                            |
|----------------------|-----------------------------------|
| `Delete` / `Backspace`| Remove selected node + its edges  |
| `Cmd`/`Ctrl` + `D`   | Duplicate selected node           |
| `Enter` in jump box  | Jump to task by number            |

---

## Repo layout

```
onnx-editor/
├── Makefile                  # make install / dev / start / server / client / clean
├── README.md                 # you are here
├── neurogolf_utils/
│   └── neurogolf_utils.py    # competition utility module (reference only)
├── data/                     # task001.json .. task400.json (ARC-AGI + ARC-GEN)
├── server/
│   ├── pyproject.toml        # pinned versions
│   └── app/
│       ├── main.py           # FastAPI app
│       ├── config.py         # IO shape, banned ops, palette, dirs
│       ├── tasks.py          # /api/tasks index + loader
│       ├── ops.py            # /api/ops (opset 10 schema dump)
│       ├── initializers.py   # 4 modes + safe formula AST evaluator
│       ├── graph_build.py    # JSON spec -> onnx.ModelProto
│       ├── shape_infer.py    # /api/infer-shapes (per-edge dims)
│       └── verify.py         # /api/validate (mirrors verify_network)
└── client/
    ├── package.json
    ├── vite.config.ts        # /api proxy -> :8000
    ├── tsconfig.json
    └── src/
        ├── main.tsx, App.tsx, store.ts, api.ts, types.ts, palette.ts
        ├── styles.css
        ├── layout/           # ThreePane, ThemeProvider
        ├── tasks/            # TaskPicker, ExamplesPanel, ArcGridView
        ├── graph/            # Canvas, OpPalette, shortcuts, nodes/
        ├── properties/       # PropertiesPanel, AttributeForm, InitializerEditor
        └── validation/       # ValidatePanel, ScoreCard, DiffGrids
```

---

## Pinned versions

The backend pins to the competition-vintage stack:

```text
Python      3.12
fastapi     0.111.0
uvicorn     0.30.1
pydantic    2.7.4
numpy       2.4.4
onnx        1.21.0
onnxruntime 1.24.4
onnx-tool   1.0.1
```

The frontend pins:

```text
node        >= 18
vite        5.4
react       18.3
reactflow   11.11
zustand     4.5
typescript  5.5
```

---

## Kaggle Workflow

`onnx-editor` produces validated `.onnx` artifacts but does not submit anything to Kaggle for you. After you have a passing graph for a task:

```bash
# 1. Click `Export .onnx` in the GUI — saves task{NNN}.onnx to your Downloads.
# 2. Repeat for every task you can solve.
# 3. Bundle the lot into a single submission zip.
zip -j submission.zip task001.onnx task002.onnx ...

# 4. Submit with the Kaggle CLI.
kaggle competitions submit -c neurogolf-2026 -f submission.zip -m "onnx-editor handcrafted"
kaggle competitions submissions -c neurogolf-2026
```

Keep Kaggle credentials outside this repo, normally in `~/.kaggle/kaggle.json`.

---

## Development Checks

```bash
# Backend: smoke-boot uvicorn and ping the basic endpoints
make server &
curl -fsS http://127.0.0.1:8000/api/health
curl -fsS http://127.0.0.1:8000/api/tasks | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
curl -fsS http://127.0.0.1:8000/api/ops   | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"

# Frontend: typecheck + production bundle
cd client && npm run build
```

A full end-to-end smoke test (build → infer-shapes → validate on task 1 with an identity Conv) lives inline in the smoke-test commands of `make dev`'s history; see the conversation log.

---

## Repo Safety

`.gitignore` keeps the venv, build artifacts, and runtime traces out of the index:

```text
server/.venv
server/**/__pycache__
**/__pycache__
*.pyc
*.onnx
*.json.profile
data/*.json
.claude
```

Before publishing, sanity-check that no working `.onnx` or task JSON has snuck in:

```bash
git status --short --ignored
git ls-files | grep -E '\.(onnx|env)$' && echo "found tracked artifacts!" || echo "clean"
```

There are no secrets or tokens anywhere in this project. `onnx-editor` runs entirely on localhost.

---

## Troubleshooting

- **`make install` fails on `onnxruntime` install** — make sure you are using Python 3.12 (`python3.12 --version`). The pinned `onnxruntime==1.24.4` does not publish wheels for every interpreter; the Makefile's `PYTHON ?= python3.12` picks the right one.
- **Port 8000 or 5173 already in use** — kill stragglers: `lsof -i :8000 -i :5173`. The Makefile's `trap 'kill 0'` cleanup only fires on Ctrl-C, not on a hard kill.
- **Validate returns `file size … exceeds limit`** — your model is over 1.44 MB. Look at `params` in the score card; usually this is one giant initializer.
- **Validate returns 0 pass / N fail with no errors** — the graph builds and runs, but the threshold-at-zero output disagrees with the expected grid. Open the diff rows in the validate dock to see input → expected → actual side-by-side.
- **Edges have no shape labels** — `onnx.shape_inference` could not finish; check the `error` field in `/api/infer-shapes`. Most commonly: an upstream op has an unset required attribute.

---

## License

Choose and add a license before relying on this as an open-source project.
