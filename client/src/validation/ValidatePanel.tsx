import { useState } from "react";
import { api } from "../api";
import { useEditor } from "../store";
import type { ValidateResult } from "../types";
import { DiffRow } from "./DiffGrids";
import { ScoreCard } from "./ScoreCard";

export function ValidateDock() {
  const taskNum = useEditor((s) => s.currentTask);
  const toSpec = useEditor((s) => s.toSpec);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValidateResult | null>(null);

  const validate = async () => {
    if (!taskNum) {
      setError("pick a task first");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.validate(toSpec(), taskNum);
      setResult(r);
      if (!r.ok && r.error) setError(r.error);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const exportOnnx = async () => {
    try {
      const r = await api.build(toSpec());
      const bytes = Uint8Array.from(atob(r.onnxB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `task${String(taskNum).padStart(3, "0")}.onnx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  };

  if (!open) {
    return (
      <div className="validate-dock" style={{ height: 36, maxHeight: 36 }}>
        <header>
          <button onClick={() => setOpen(true)}>▲ Validate</button>
        </header>
      </div>
    );
  }

  return (
    <div className="validate-dock">
      <header>
        <span>Validation</span>
        <span style={{ flex: 1 }} />
        <button className="primary" disabled={busy} onClick={validate}>
          {busy ? "running…" : "Validate"}
        </button>
        <button onClick={exportOnnx}>Export .onnx</button>
        <button onClick={() => setOpen(false)} title="collapse">−</button>
      </header>
      <div className="body">
        {error && <div className="error-banner">{error}</div>}
        {result && (
          <>
            <ScoreCard result={result} />
            {result.summary && (
              <div style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 8 }}>
                {Object.entries(result.summary).map(([k, v]) => (
                  <span key={k} className="pill">
                    {k}: {v.pass}✓ / {v.fail}✗
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {result.perExample.map((rec, i) => (
                <DiffRow key={i} rec={rec} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
