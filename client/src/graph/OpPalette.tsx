import { useMemo, useState } from "react";
import type { OpSchema } from "../types";

export function OpPalette({ ops }: { ops: OpSchema[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ops;
    return ops.filter((o) => o.name.toLowerCase().includes(needle));
  }, [ops, q]);

  return (
    <div className="palette">
      <header>Ops · opset 10 · {ops.length} available</header>
      <div className="search">
        <input
          autoFocus={false}
          placeholder="search ops…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="list">
        {filtered.map((op) => (
          <div
            key={op.name}
            className="item"
            draggable
            title={op.doc}
            onDragStart={(e) => {
              e.dataTransfer.setData("application/onnx-op", op.name);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            {op.name}
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 6, color: "var(--fg-muted)" }}>no match</div>
        )}
      </div>
    </div>
  );
}
