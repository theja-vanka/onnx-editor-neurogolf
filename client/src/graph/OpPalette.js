import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export function OpPalette({ ops }) {
    const [q, setQ] = useState("");
    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle)
            return ops;
        return ops.filter((o) => o.name.toLowerCase().includes(needle));
    }, [ops, q]);
    return (_jsxs("div", { className: "palette", children: [_jsxs("header", { children: ["Ops \u00B7 opset 10 \u00B7 ", ops.length, " available"] }), _jsx("div", { className: "search", children: _jsx("input", { autoFocus: false, placeholder: "search ops\u2026", value: q, onChange: (e) => setQ(e.target.value) }) }), _jsxs("div", { className: "list", children: [filtered.map((op) => (_jsx("div", { className: "item", draggable: true, title: op.doc, onDragStart: (e) => {
                            e.dataTransfer.setData("application/onnx-op", op.name);
                            e.dataTransfer.effectAllowed = "move";
                        }, children: op.name }, op.name))), filtered.length === 0 && (_jsx("div", { style: { padding: 6, color: "var(--fg-muted)" }, children: "no match" }))] })] }));
}
