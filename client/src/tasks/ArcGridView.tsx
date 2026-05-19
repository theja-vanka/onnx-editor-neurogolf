import { ARC_PALETTE } from "../palette";
import type { ArcGrid } from "../types";

export function ArcGridView({ grid, cellSize = 8 }: { grid: ArcGrid; cellSize?: number }) {
  if (!grid || grid.length === 0) {
    return <div style={{ color: "var(--fg-muted)", fontSize: 11 }}>(empty)</div>;
  }
  const cols = Math.max(...grid.map((r) => r.length));
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
      }}
    >
      {grid.map((row, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const v = row[c];
          const color = v === undefined ? "transparent" : ARC_PALETTE[v] ?? "transparent";
          return (
            <div
              key={`${r}-${c}`}
              className="grid-cell"
              style={{ width: cellSize, height: cellSize, background: color }}
            />
          );
        }),
      )}
    </div>
  );
}
