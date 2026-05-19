const base = "";
async function jsonOrThrow(res) {
    if (!res.ok) {
        let detail = res.statusText;
        try {
            const body = await res.json();
            detail = body.detail ?? JSON.stringify(body);
        }
        catch {
            // ignore
        }
        throw new Error(`${res.status}: ${detail}`);
    }
    return res.json();
}
export const api = {
    listTasks: () => fetch(`${base}/api/tasks`).then((r) => jsonOrThrow(r)),
    getTask: (n) => fetch(`${base}/api/tasks/${n}`).then((r) => jsonOrThrow(r)),
    listOps: () => fetch(`${base}/api/ops`).then((r) => jsonOrThrow(r)),
    build: (spec) => fetch(`${base}/api/build`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(spec),
    }).then((r) => jsonOrThrow(r)),
    inferShapes: (spec) => fetch(`${base}/api/infer-shapes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(spec),
    }).then((r) => jsonOrThrow(r)),
    validate: (spec, taskNum) => fetch(`${base}/api/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec, taskNum }),
    }).then((r) => jsonOrThrow(r)),
};
