import { useEffect, useState } from "react";
import { api } from "../api";
import { useEditor } from "../store";
import type { ArcTask } from "../types";
import { ArcGridView } from "./ArcGridView";

export function ExamplesPanel() {
  const taskNum = useEditor((s) => s.currentTask);
  const [task, setTask] = useState<ArcTask | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setTask(null);
    if (!taskNum) return;
    api
      .getTask(taskNum)
      .then((r) => setTask(r.task))
      .catch((e) => setError(String(e.message ?? e)));
  }, [taskNum]);

  if (!taskNum) {
    return (
      <div className="examples-empty">
        Pick a task to see its train / test / arc-gen examples.
      </div>
    );
  }
  if (error) return <div className="error-banner" style={{ margin: 8 }}>{error}</div>;
  if (!task) return <div className="examples-empty">loading…</div>;

  return (
    <div className="examples-row">
      <ExampleGroup label="train" examples={task.train} />
      <ExampleGroup label="test" examples={task.test} />
      {task["arc-gen"] && task["arc-gen"]!.length > 0 && (
        <ExampleGroup label="arc-gen" examples={task["arc-gen"]!} />
      )}
    </div>
  );
}

function ExampleGroup({
  label,
  examples,
}: {
  label: string;
  examples: { input: number[][]; output: number[][] }[];
}) {
  return (
    <div className="example-group">
      <div className="example-group-label">
        <span>{label}</span>
        <span className="count">{examples.length}</span>
      </div>
      <div className="example-group-items">
        {examples.map((e, i) => (
          <div key={`${label}-${i}`} className="example-pair">
            <ArcGridView grid={e.input} cellSize={6} />
            <span className="example-arrow">→</span>
            <ArcGridView grid={e.output} cellSize={6} />
          </div>
        ))}
      </div>
    </div>
  );
}
