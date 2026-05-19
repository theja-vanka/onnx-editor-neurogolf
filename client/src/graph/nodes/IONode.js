import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Handle, Position } from "reactflow";
export function IONode({ data, selected }) {
    const isInput = data.io === "input";
    return (_jsxs("div", { className: `io-node${selected ? " selected" : ""}`, children: [_jsx("header", { children: isInput ? "Input" : "Output" }), _jsx("div", { className: "body", children: "[1, 10, 30, 30] float" }), isInput ? (_jsx(Handle, { type: "source", position: Position.Right, id: "out-0" })) : (_jsx(Handle, { type: "target", position: Position.Left, id: "in-0" }))] }));
}
