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
        return (_jsx("div", { className: "properties-pane", children: _jsx("div", { className: "properties-empty", children: "Select a node to edit its attributes and initializers." }) }));
    }
    if (node.data.kind === "io") {
        return (_jsx("div", { className: "properties-pane", children: _jsxs("div", { className: "node-header", children: [_jsx("h4", { children: node.data.io }), _jsxs("div", { className: "helper-text", children: ["Fixed [1, 10, 30, 30] float tensor. The output node receives the network's final tensor; it must be threshold-able to ", ">", " 0.0 to match the expected one-hot grid."] })] }) }));
    }
    if (!opSchema) {
        return (_jsx("div", { className: "properties-pane", children: _jsxs("div", { className: "error-banner", children: ["unknown op: ", node.data.op] }) }));
    }
    const data = node.data;
    return (_jsxs("div", { className: "properties-pane", children: [_jsxs("div", { className: "node-header", children: [_jsx("h4", { children: opSchema.name }), _jsxs("div", { className: "helper-text", children: ["opset ", opSchema.sinceVersion, " \u00B7 id ", _jsx("code", { children: node.id })] }), opSchema.doc && _jsx("div", { className: "helper-text", children: opSchema.doc })] }), _jsxs("section", { className: "properties-section", children: [_jsx("div", { className: "section-header", children: "Attributes" }), _jsx(AttributeForm, { schema: opSchema, values: data.attrs, onChange: (next) => updateNodeData(node.id, { attrs: next }) })] }), _jsxs("section", { className: "properties-section", children: [_jsx("div", { className: "section-header", children: "Initializers" }), _jsxs("div", { className: "helper-text", style: { marginBottom: 10 }, children: ["Each initializer's ", _jsx("code", { children: "name" }), " must match a formal input (e.g. ", _jsx("code", { children: "W" }), " for Conv) \u2014 initializers fill any inputs not connected by an edge."] }), _jsx(InitializerEditor, { initializers: data.initializers, onChange: (next) => updateNodeData(node.id, { initializers: next }) })] })] }));
}
