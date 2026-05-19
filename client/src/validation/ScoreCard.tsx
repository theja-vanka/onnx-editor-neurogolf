import type { ValidateResult } from "../types";

function fmtBytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function ScoreCard({ result }: { result: ValidateResult }) {
  return (
    <div className="score-card">
      <div className="cell">
        <div className="label">memory</div>
        <div className="value">{fmtBytes(result.memory)}</div>
      </div>
      <div className="cell">
        <div className="label">params</div>
        <div className="value">{result.params === null ? "—" : result.params.toLocaleString()}</div>
      </div>
      <div className="cell">
        <div className="label">points</div>
        <div className="value">{result.points === null ? "—" : result.points.toFixed(3)}</div>
      </div>
      <div className="cell" style={{ gridColumn: "1 / -1" }}>
        <div className="label">file size · limit 1.44 MB</div>
        <div className="value" style={{ fontSize: 12 }}>{fmtBytes(result.fileSize)}</div>
      </div>
    </div>
  );
}
