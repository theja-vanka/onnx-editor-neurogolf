import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { useEditor } from "../store";
import { AttributeForm } from "./AttributeForm";
import { InitializerEditor } from "./InitializerEditor";
export function PropertiesPanel({ ops }) {
    const sel = useEditor((s) => s.selectedNodeId);
    const node = useEditor((s) => s.nodes.find((n) => n.id === sel) ?? null);
    const updateNodeData = useEditor((s) => s.updateNodeData);
    const opSchema = useMemo(() => {
        if (!node || node.data.kind !== "op")
            return null;
        return ops.find((o) => o.name === node.data.op) ?? null;
    }, [node, ops]);
    if (!node) {
        return (_jsx("div", { style: { color: "var(--fg-muted)", fontSize: 12 }, children: "Select a node to edit its attributes and initializers." }));
    }
    if (node.data.kind === "io") {
        return (_jsxs("div", { children: [_jsx("h4", { style: { margin: "4px 0 8px" }, children: node.data.io }), _jsxs("div", { style: { color: "var(--fg-muted)", fontSize: 12 }, children: ["Fixed [1, 10, 30, 30] float tensor. The output node receives the network's final tensor; it must be threshold-able to ", ">", " 0.0 to match the expected one-hot grid."] })] }));
    }
    if (!opSchema) {
        return (_jsxs("div", { className: "error-banner", children: ["unknown op: ", node.data.op] }));
    }
    const data = node.data;
    return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [_jsxs("div", { children: [_jsx("h4", { style: { margin: "4px 0 4px" }, children: opSchema.name }), _jsxs("div", { style: { fontSize: 11, color: "var(--fg-muted)" }, children: ["opset ", opSchema.sinceVersion, " \u00B7 id ", _jsx("code", { children: node.id })] }), opSchema.doc && (_jsx("div", { style: { fontSize: 11, color: "var(--fg-muted)", marginTop: 4 }, children: opSchema.doc }))] }), _jsxs("section", { children: [_jsx("div", { style: {
                            fontSize: 11,
                            color: "var(--fg-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            marginBottom: 6,
                        }, children: "Attributes" }), _jsx(AttributeForm, { schema: opSchema, values: data.attrs, onChange: (next) => updateNodeData(node.id, { attrs: next }) })] }), _jsxs("section", { children: [_jsx("div", { style: {
                            fontSize: 11,
                            color: "var(--fg-muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            marginBottom: 6,
                        }, children: "Initializers" }), _jsxs("div", { style: { fontSize: 11, color: "var(--fg-muted)", marginBottom: 4 }, children: ["Each initializer's ", _jsx("code", { children: "name" }), " must match a formal input (e.g.", " ", _jsx("code", { children: "W" }), " for Conv) \u2014 initializers fill any inputs not connected by an edge."] }), _jsx(InitializerEditor, { initializers: data.initializers, onChange: (next) => updateNodeData(node.id, { initializers: next }) })] })] }));
}
