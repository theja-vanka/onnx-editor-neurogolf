import { useState } from "react";
import type { InitializerMode, InitializerSpec } from "../types";

const MODES: InitializerMode[] = ["literal", "preset", "formula", "upload"];

export function InitializerEditor({
  initializers,
  onChange,
}: {
  initializers: InitializerSpec[];
  onChange: (next: InitializerSpec[]) => void;
}) {
  const update = (i: number, patch: Partial<InitializerSpec>) => {
    const next = initializers.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => {
    const next = initializers.slice();
    next.splice(i, 1);
    onChange(next);
  };
  const add = () => {
    onChange([
      ...initializers,
      {
        name: `W${initializers.length + 1}`,
        dtype: "float",
        shape: [10, 10, 3, 3],
        mode: "preset",
        preset: "zeros",
      },
    ]);
  };

  return (
    <div className="initializer-list">
      {initializers.map((it, i) => (
        <Card key={i} value={it} onChange={(p) => update(i, p)} onRemove={() => remove(i)} />
      ))}
      <button onClick={add}>+ add initializer</button>
    </div>
  );
}

function Card({
  value,
  onChange,
  onRemove,
}: {
  value: InitializerSpec;
  onChange: (patch: Partial<InitializerSpec>) => void;
  onRemove: () => void;
}) {
  const [shapeText, setShapeText] = useState(value.shape.join(","));
  const [valuesText, setValuesText] = useState((value.values ?? []).join(","));

  const setShape = (text: string) => {
    setShapeText(text);
    const parts = text.split(",").map((s) => parseInt(s.trim(), 10));
    if (parts.every((n) => Number.isFinite(n) && n > 0)) onChange({ shape: parts });
  };

  return (
    <div className="initializer-card">
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        <input
          style={{ flex: 1 }}
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="name (e.g. W)"
        />
        <button onClick={onRemove}>✕</button>
      </div>

      <div className="attr-row">
        <label>dtype</label>
        <select value={value.dtype} onChange={(e) => onChange({ dtype: e.target.value })}>
          <option>float</option>
          <option>float64</option>
          <option>int32</option>
          <option>int64</option>
          <option>bool</option>
        </select>
      </div>

      <div className="attr-row">
        <label>shape</label>
        <input
          value={shapeText}
          onChange={(e) => setShape(e.target.value)}
          placeholder="e.g. 10,10,3,3"
        />
      </div>

      <div className="tabs">
        {MODES.map((m) => (
          <button
            key={m}
            className={value.mode === m ? "active" : ""}
            onClick={() => onChange({ mode: m })}
          >
            {m}
          </button>
        ))}
      </div>

      {value.mode === "literal" && (
        <div className="attr-row">
          <label>values (flat, row-major)</label>
          <textarea
            rows={3}
            value={valuesText}
            onChange={(e) => {
              setValuesText(e.target.value);
              const parts = e.target.value
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .map((s) => parseFloat(s));
              if (parts.every((n) => Number.isFinite(n))) onChange({ values: parts });
            }}
          />
        </div>
      )}

      {value.mode === "preset" && (
        <div className="attr-row">
          <label>preset</label>
          <select
            value={value.preset ?? "zeros"}
            onChange={(e) => onChange({ preset: e.target.value as InitializerSpec["preset"] })}
          >
            <option value="zeros">zeros</option>
            <option value="ones">ones</option>
            <option value="identity">identity (last two dims)</option>
          </select>
        </div>
      )}

      {value.mode === "formula" && (
        <>
          <div className="attr-row">
            <label>vars (one per shape dim)</label>
            <input
              value={(value.vars ?? []).join(",")}
              onChange={(e) =>
                onChange({
                  vars: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0),
                })
              }
              placeholder="o,i,r,c"
            />
          </div>
          <div className="attr-row">
            <label>expr (math, comparisons, ternary)</label>
            <textarea
              rows={3}
              value={value.expr ?? ""}
              onChange={(e) => onChange({ expr: e.target.value })}
              placeholder="1.0 if (o == i and r == 0 and c == 0) else 0.0"
            />
          </div>
        </>
      )}

      {value.mode === "upload" && (
        <div className="attr-row">
          <label>file (.npy or raw bytes)</label>
          <input
            type="file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const buf = await file.arrayBuffer();
              const bytes = new Uint8Array(buf);
              const offset = parseNpyHeader(bytes);
              const slice = bytes.subarray(offset);
              let bin = "";
              for (let i = 0; i < slice.length; i++) bin += String.fromCharCode(slice[i]);
              const b64 = btoa(bin);
              onChange({ data_b64: b64 });
            }}
          />
          {value.data_b64 && (
            <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>
              {Math.round((value.data_b64.length * 3) / 4)} bytes loaded
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function parseNpyHeader(bytes: Uint8Array): number {
  // .npy magic: \x93NUMPY ; if not, treat as raw bytes (offset 0).
  if (bytes.length < 10 || bytes[0] !== 0x93) return 0;
  const head = String.fromCharCode(...bytes.subarray(1, 6));
  if (head !== "NUMPY") return 0;
  const headerLen = bytes[8] | (bytes[9] << 8);
  return 10 + headerLen;
}
