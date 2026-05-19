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
      <div className="properties-pane">
        <div className="properties-empty">
          Select a node to edit its attributes and initializers.
        </div>
      </div>
    );
  }

  if (node.data.kind === "io") {
    return (
      <div className="properties-pane">
        <div className="node-header">
          <h4>{node.data.io}</h4>
          <div className="helper-text">
            Fixed [1, 10, 30, 30] float tensor. The output node receives the network's final
            tensor; it must be threshold-able to {">"} 0.0 to match the expected one-hot grid.
          </div>
        </div>
      </div>
    );
  }

  if (!opSchema) {
    return (
      <div className="properties-pane">
        <div className="error-banner">unknown op: {(node.data as OpNodeData).op}</div>
      </div>
    );
  }

  const data = node.data as OpNodeData;
  return (
    <div className="properties-pane">
      <div className="node-header">
        <h4>{opSchema.name}</h4>
        <div className="helper-text">
          opset {opSchema.sinceVersion} · id <code>{node.id}</code>
        </div>
        {opSchema.doc && <div className="helper-text">{opSchema.doc}</div>}
      </div>

      <section className="properties-section">
        <div className="section-header">Attributes</div>
        <AttributeForm
          schema={opSchema}
          values={data.attrs}
          onChange={(next) => updateNodeData(node.id, { attrs: next })}
        />
      </section>

      <section className="properties-section">
        <div className="section-header">Initializers</div>
        <div className="helper-text" style={{ marginBottom: 10 }}>
          Each initializer's <code>name</code> must match a formal input (e.g. <code>W</code> for
          Conv) — initializers fill any inputs not connected by an edge.
        </div>
        <InitializerEditor
          initializers={data.initializers}
          onChange={(next) => updateNodeData(node.id, { initializers: next })}
        />
      </section>
    </div>
  );
}
