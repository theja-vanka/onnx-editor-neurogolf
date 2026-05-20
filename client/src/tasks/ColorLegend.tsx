import { ARC_PALETTE, PALETTE_LABELS } from "../palette";

export function ColorLegend() {
  return (
    <div className="color-legend" aria-label="Cell color legend">
      <div className="color-legend-title">Colors</div>
      <div className="color-legend-items">
        {ARC_PALETTE.map((color, i) => (
          <div className="color-legend-item" key={i} title={PALETTE_LABELS[i]}>
            <span className="color-legend-swatch" style={{ background: color }} />
            <span className="color-legend-value">{i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
