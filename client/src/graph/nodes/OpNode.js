import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Handle, Position } from "reactflow";
import { getOpSchemaCache } from "../../store";
export function OpNode({ data, selected }) {
    const schemas = getOpSchemaCache();
    const schema = useMemo(() => schemas.find((s) => s.name === data.op), [schemas, data.op]);
    const inputs = schema?.inputs ?? [];
    const outputs = schema?.outputs ?? [{ name: "Y", description: "", typeStr: "T", option: "single" }];
    return (_jsxs("div", { className: `op-node${selected ? " selected" : ""}`, children: [_jsx("header", { children: data.op }), _jsxs("div", { className: "ports", children: [_jsxs("div", { className: "col left", children: [inputs.length === 0 && _jsx("div", { className: "port-row", children: "(no inputs)" }), inputs.map((p, i) => (_jsxs("div", { className: "port-row", title: p.description, children: [_jsx(Handle, { type: "target", position: Position.Left, id: `in-${p.name}`, style: { top: 30 + i * 16 } }), _jsxs("span", { children: [p.name, p.option === "optional" ? "?" : ""] })] }, p.name + i)))] }), _jsx("div", { className: "col right", children: outputs.map((p, i) => (_jsxs("div", { className: "port-row", title: p.description, children: [_jsx("span", { children: p.name }), _jsx(Handle, { type: "source", position: Position.Right, id: `out-${i}`, style: { top: 30 + i * 16 } })] }, p.name + i))) })] })] }));
}
