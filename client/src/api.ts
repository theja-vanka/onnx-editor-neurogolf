import type { ArcTask, GraphSpec, OpSchema, TaskSummary, ValidateResult } from "./types";

const base = "";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      // ignore
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTasks: () => fetch(`${base}/api/tasks`).then((r) => jsonOrThrow<TaskSummary[]>(r)),
  getTask: (n: number) =>
    fetch(`${base}/api/tasks/${n}`).then((r) => jsonOrThrow<{ num: number; task: ArcTask }>(r)),
  listOps: () => fetch(`${base}/api/ops`).then((r) => jsonOrThrow<OpSchema[]>(r)),
  build: (spec: GraphSpec) =>
    fetch(`${base}/api/build`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spec),
    }).then((r) => jsonOrThrow<{ onnxB64: string; byteSize: number }>(r)),
  inferShapes: (spec: GraphSpec) =>
    fetch(`${base}/api/infer-shapes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spec),
    }).then((r) =>
      jsonOrThrow<{ ok: boolean; error: string | null; edges: Record<string, (number | string)[]> }>(r),
    ),
  validate: (spec: GraphSpec, taskNum: number) =>
    fetch(`${base}/api/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spec, taskNum }),
    }).then((r) => jsonOrThrow<ValidateResult>(r)),
};
