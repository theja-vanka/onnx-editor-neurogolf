import { ArcGridView } from "../tasks/ArcGridView";
import type { ValidatePerExample } from "../types";

export function DiffRow({ rec }: { rec: ValidatePerExample }) {
  return (
    <div
      className="diff-row"
      style={{
        border: `1px solid ${rec.pass ? "var(--green)" : "var(--red)"}`,
      }}
    >
      <div>
        <div className="diff-label">input</div>
        {rec.input ? <ArcGridView grid={rec.input} cellSize={6} /> : <em>—</em>}
      </div>
      <div className="diff-label">→</div>
      <div>
        <div className="diff-label">expected</div>
        {rec.expected ? <ArcGridView grid={rec.expected} cellSize={6} /> : <em>—</em>}
      </div>
      <div className="diff-label">vs</div>
      <div>
        <div className="diff-label">actual</div>
        {rec.actual ? <ArcGridView grid={rec.actual} cellSize={6} /> : <em>error</em>}
      </div>
    </div>
  );
}
