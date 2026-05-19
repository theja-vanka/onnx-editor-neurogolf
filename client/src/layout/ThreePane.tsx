import type { ReactNode } from "react";

export function ThreePane({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="three-pane">
      <aside className="pane left">{left}</aside>
      <main className="pane middle">{center}</main>
      <aside className="pane right">{right}</aside>
    </div>
  );
}
