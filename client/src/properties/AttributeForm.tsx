import type { OpAttribute, OpSchema } from "../types";

interface Props {
  schema: OpSchema;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

export function AttributeForm({ schema, values, onChange }: Props) {
  if (schema.attributes.length === 0) {
    return (
      <div style={{ color: "var(--fg-muted)", fontSize: 12 }}>
        No attributes for {schema.name}.
      </div>
    );
  }
  return (
    <div className="attr-form">
      {schema.attributes.map((attr) => (
        <AttrRow
          key={attr.name}
          attr={attr}
          value={values[attr.name] ?? attr.default}
          set={(v) => onChange({ ...values, [attr.name]: v })}
          clear={() => {
            const next = { ...values };
            delete next[attr.name];
            onChange(next);
          }}
        />
      ))}
    </div>
  );
}

function AttrRow({
  attr,
  value,
  set,
  clear,
}: {
  attr: OpAttribute;
  value: unknown;
  set: (v: unknown) => void;
  clear: () => void;
}) {
  return (
    <div className="attr-row">
      <label title={attr.description}>
        {attr.name}
        <span style={{ color: "var(--fg-muted)" }}>
          {" "}· {attr.type}
          {attr.required ? " · required" : ""}
        </span>
      </label>
      {renderEditor(attr, value, set)}
      {!attr.required && (
        <button style={{ alignSelf: "flex-start", marginTop: 2 }} onClick={clear}>
          unset
        </button>
      )}
    </div>
  );
}

function renderEditor(attr: OpAttribute, value: unknown, set: (v: unknown) => void) {
  switch (attr.type) {
    case "int":
      return (
        <input
          type="number"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => set(e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
        />
      );
    case "float":
      return (
        <input
          type="number"
          step="any"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => set(e.target.value === "" ? undefined : parseFloat(e.target.value))}
        />
      );
    case "string":
      return (
        <input
          type="text"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => set(e.target.value)}
        />
      );
    case "ints":
    case "floats": {
      const cur = Array.isArray(value) ? value.join(",") : "";
      const isFloat = attr.type === "floats";
      return (
        <input
          type="text"
          placeholder="comma-separated"
          value={cur}
          onChange={(e) => {
            const parts = e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
            const arr = parts.map((p) => (isFloat ? parseFloat(p) : parseInt(p, 10)));
            set(arr.some((n) => Number.isNaN(n)) ? value : arr);
          }}
        />
      );
    }
    case "strings": {
      const cur = Array.isArray(value) ? (value as string[]).join(",") : "";
      return (
        <input
          type="text"
          placeholder="comma-separated"
          value={cur}
          onChange={(e) =>
            set(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0),
            )
          }
        />
      );
    }
    default:
      return (
        <input
          type="text"
          placeholder={`(${attr.type}) JSON`}
          value={value === undefined ? "" : JSON.stringify(value)}
          onChange={(e) => {
            try {
              set(e.target.value === "" ? undefined : JSON.parse(e.target.value));
            } catch {
              // ignore until valid JSON
            }
          }}
        />
      );
  }
}
