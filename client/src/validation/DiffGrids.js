import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArcGridView } from "../tasks/ArcGridView";
export function DiffRow({ rec }) {
    return (_jsxs("div", { className: "diff-row", style: {
            border: `1px solid ${rec.pass ? "var(--green)" : "var(--red)"}`,
        }, children: [_jsxs("div", { children: [_jsx("div", { className: "diff-label", children: "input" }), rec.input ? _jsx(ArcGridView, { grid: rec.input, cellSize: 6 }) : _jsx("em", { children: "\u2014" })] }), _jsx("div", { className: "diff-label", children: "\u2192" }), _jsxs("div", { children: [_jsx("div", { className: "diff-label", children: "expected" }), rec.expected ? _jsx(ArcGridView, { grid: rec.expected, cellSize: 6 }) : _jsx("em", { children: "\u2014" })] }), _jsx("div", { className: "diff-label", children: "vs" }), _jsxs("div", { children: [_jsx("div", { className: "diff-label", children: "actual" }), rec.actual ? _jsx(ArcGridView, { grid: rec.actual, cellSize: 6 }) : _jsx("em", { children: "error" })] })] }));
}
