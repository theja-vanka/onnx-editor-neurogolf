import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function fmtBytes(n) {
    if (n === null || n === undefined)
        return "—";
    if (n < 1024)
        return `${n} B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
export function ScoreCard({ result }) {
    return (_jsxs("div", { className: "score-card", children: [_jsxs("div", { className: "cell", children: [_jsx("div", { className: "label", children: "memory" }), _jsx("div", { className: "value", children: fmtBytes(result.memory) })] }), _jsxs("div", { className: "cell", children: [_jsx("div", { className: "label", children: "params" }), _jsx("div", { className: "value", children: result.params === null ? "—" : result.params.toLocaleString() })] }), _jsxs("div", { className: "cell", children: [_jsx("div", { className: "label", children: "points" }), _jsx("div", { className: "value", children: result.points === null ? "—" : result.points.toFixed(3) })] }), _jsxs("div", { className: "cell", style: { gridColumn: "1 / -1" }, children: [_jsx("div", { className: "label", children: "file size \u00B7 limit 1.44 MB" }), _jsx("div", { className: "value", style: { fontSize: 12 }, children: fmtBytes(result.fileSize) })] })] }));
}
