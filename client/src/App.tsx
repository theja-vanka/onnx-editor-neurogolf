import { useEffect, useState } from "react";
import { api } from "./api";
import { Canvas } from "./graph/Canvas";
import { OpPalette } from "./graph/OpPalette";
import { ThemeProvider } from "./layout/ThemeProvider";
import { ThreePane } from "./layout/ThreePane";
import { PropertiesPanel } from "./properties/PropertiesPanel";
import { ExamplesPanel } from "./tasks/ExamplesPanel";
import { TaskPicker } from "./tasks/TaskPicker";
import { useEditor } from "./store";
import type { OpSchema } from "./types";

export default function App() {
  const [ops, setOps] = useState<OpSchema[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useEditor((s) => s.theme);
  const toggleTheme = useEditor((s) => s.toggleTheme);
  const loadForTask = useEditor((s) => s.loadForTask);
  const resetGraph = useEditor((s) => s.resetGraph);
  const fromSpec = useEditor((s) => s.fromSpec);
  const toSpec = useEditor((s) => s.toSpec);

  useEffect(() => {
    api
      .listOps()
      .then((list) => {
        setOps(list);
        loadForTask(useEditor.getState().currentTask, list);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [loadForTask]);

  const importJson = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const spec = JSON.parse(text);
        fromSpec(spec);
      } catch (e) {
        setError(`import failed: ${String((e as Error).message ?? e)}`);
      }
    };
    input.click();
  };

  const exportJson = () => {
    const spec = toSpec();
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-task${String(useEditor.getState().currentTask).padStart(3, "0")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ThemeProvider>
      <div className="app">
        <header className="topbar">
          <span className="title">ONNX Editor</span>
          <span className="pill">NeuroGolf 2026</span>
          <TaskPicker />
          <span className="spacer" />
          <button onClick={importJson}>Import .json</button>
          <button onClick={exportJson}>Export .json</button>
          <button onClick={resetGraph}>Reset</button>
          <button onClick={toggleTheme} title="toggle theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </header>
        {error && (
          <div style={{ padding: 8 }}>
            <div className="error-banner">{error}</div>
          </div>
        )}
        <section className="examples-strip">
          <ExamplesPanel />
        </section>
        {ops ? (
          <ThreePane
            left={
              <>
                <h3>Ops · opset 10 · {ops.length}</h3>
                <div className="body" style={{ padding: 0 }}>
                  <OpPalette ops={ops} />
                </div>
              </>
            }
            center={<Canvas ops={ops} />}
            right={
              <>
                <h3>Properties</h3>
                <div className="body">
                  <PropertiesPanel ops={ops} />
                </div>
              </>
            }
          />
        ) : (
          <div style={{ padding: 16, color: "var(--fg-muted)" }}>loading ops…</div>
        )}
      </div>
    </ThemeProvider>
  );
}
