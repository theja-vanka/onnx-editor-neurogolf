import { useEffect, useState } from "react";
import { api } from "../api";
import { useEditor } from "../store";
import type { TaskSummary } from "../types";

export function TaskPicker() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const current = useEditor((s) => s.currentTask);
  const setCurrent = useEditor((s) => s.setCurrentTask);

  useEffect(() => {
    api.listTasks().then(setTasks).catch(() => setTasks([]));
  }, []);

  return (
    <div className="task-picker">
      <span className="pill">task</span>
      <select
        value={current}
        onChange={(e) => setCurrent(parseInt(e.target.value, 10))}
      >
        <option value={0}>— pick —</option>
        {tasks.map((t) => (
          <option key={t.num} value={t.num}>
            {String(t.num).padStart(3, "0")}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={400}
        placeholder="jump"
        style={{ width: 64 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = parseInt((e.target as HTMLInputElement).value, 10);
            if (Number.isFinite(v) && v > 0) setCurrent(v);
          }
        }}
      />
    </div>
  );
}
