import { jsx as _jsx } from "react/jsx-runtime";
import { ARC_PALETTE } from "../palette";
export function ArcGridView({ grid, cellSize = 8 }) {
    if (!grid || grid.length === 0) {
        return _jsx("div", { style: { color: "var(--fg-muted)", fontSize: 11 }, children: "(empty)" });
    }
    const cols = Math.max(...grid.map((r) => r.length));
    return (_jsx("div", { className: "grid", style: {
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        }, children: grid.map((row, r) => Array.from({ length: cols }).map((_, c) => {
            const v = row[c];
            const color = v === undefined ? "transparent" : ARC_PALETTE[v] ?? "transparent";
            return (_jsx("div", { className: "grid-cell", style: { width: cellSize, height: cellSize, background: color } }, `${r}-${c}`));
        })) }));
}
