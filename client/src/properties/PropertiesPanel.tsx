import { useMemo } from "react";
import { useEditor, type OpNodeData } from "../store";
import type { OpSchema } from "../types";
import { AttributeForm } from "./AttributeForm";
import { InitializerEditor } from "./InitializerEditor";

export function PropertiesPanel({ ops }: { ops: OpSchema[] }) {
  const sel = useEditor((s) => s.selectedNodeId);
  const node = useEditor((s) => s.nodes.find((n) => n.id === sel) ?? null);
  const updateNodeData = useEditor((s) => s.updateNodeData);

  const opSchema = useMemo<OpSchema | null>(() => {
    if (!node || node.data.kind !== "op") return null;
    return ops.find((o) => o.name === (node.data as OpNodeData).op) ?? null;
  }, [node, ops]);

  if (!node) {
    return (
      <div style={{ color: "var(--fg-muted)", fontSize: 12 }}>
        Select a node to edit its attributes and initializers.
      </div>
    );
  }

  if (node.data.kind === "io") {
    return (
      <div>
        <h4 style={{ margin: "4px 0 8px" }}>{node.data.io}</h4>
        <div style={{ color: "var(--fg-muted)", fontSize: 12 }}>
          Fixed [1, 10, 30, 30] float tensor. The output node receives the network's final tensor;
          it must be threshold-able to {">"} 0.0 to match the expected one-hot grid.
        </div>
      </div>
    );
  }

  if (!opSchema) {
    return (
      <div className="error-banner">unknown op: {(node.data as OpNodeData).op}</div>
    );
  }

  const data = node.data as OpNodeData;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h4 style={{ margin: "4px 0 4px" }}>{opSchema.name}</h4>
        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>
          opset {opSchema.sinceVersion} · id <code>{node.id}</code>
        </div>
        {opSchema.doc && (
          <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }}>
            {opSchema.doc}
          </div>
        )}
      </div>

      <section>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 6,
          }}
        >
          Attributes
        </div>
        <AttributeForm
          schema={opSchema}
          values={data.attrs}
          onChange={(next) => updateNodeData(node.id, { attrs: next })}
        />
      </section>

      <section>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 6,
          }}
        >
          Initializers
        </div>
        <div style={{ fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }}>
          Each initializer's <code>name</code> must match a formal input (e.g.{" "}
          <code>W</code> for Conv) — initializers fill any inputs not connected by an edge.
        </div>
        <InitializerEditor
          initializers={data.initializers}
          onChange={(next) => updateNodeData(node.id, { initializers: next })}
        />
      </section>
    </div>
  );
}
