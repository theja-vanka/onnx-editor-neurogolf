import { useEffect, useState } from "react";
import { api } from "./api";
import { Canvas } from "./graph/Canvas";
import { OpPalette } from "./graph/OpPalette";
import { ThemeProvider } from "./layout/ThemeProvider";
import { ThreePane } from "./layout/ThreePane";
import { PropertiesPanel } from "./properties/PropertiesPanel";
import { ColorLegend } from "./tasks/ColorLegend";
import { ExamplesPanel } from "./tasks/ExamplesPanel";
import { TaskPicker } from "./tasks/TaskPicker";
import { useEditor } from "./store";
import type { OpSchema } from "./types";

// Base64-encode an ArrayBuffer in chunks (avoids blowing the call stack / arg
// limit that String.fromCharCode(...wholeArray) hits on large model files).
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// "task042.onnx" / "task001.onnx" -> 42 / 1, so an exported model re-opens its
// ARC task. Returns null for names that don't follow the task<NNN>.onnx scheme.
function taskNumFromFilename(name: string): number | null {
  const m = /task0*(\d+)\.onnx$/i.exec(name);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function App() {
  const [ops, setOps] = useState<OpSchema[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useEditor((s) => s.theme);
  const toggleTheme = useEditor((s) => s.toggleTheme);
  const loadForTask = useEditor((s) => s.loadForTask);
  const resetGraph = useEditor((s) => s.resetGraph);
  const fromSpec = useEditor((s) => s.fromSpec);
  const toSpec = useEditor((s) => s.toSpec);
  const setCurrentTask = useEditor((s) => s.setCurrentTask);

  useEffect(() => {
    api
      .listOps()
      .then((list) => {
        setOps(list);
        loadForTask(useEditor.getState().currentTask, list);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [loadForTask]);

  const importOnnx = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".onnx,application/octet-stream";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const b64 = arrayBufferToBase64(await file.arrayBuffer());
        const { spec, warnings } = await api.importOnnx(b64);
        // If the file is named like task042.onnx, switch to that ARC task so its
        // examples render alongside the graph. Must run *before* fromSpec, since
        // setCurrentTask clears the graph.
        const taskNum = taskNumFromFilename(file.name);
        if (taskNum != null) setCurrentTask(taskNum);
        fromSpec(spec);
        const taskNote = taskNum != null ? ` · loaded task ${String(taskNum).padStart(3, "0")}` : "";
        setError(
          warnings.length
            ? `Imported "${file.name}"${taskNote} with ${warnings.length} warning(s):\n` +
                warnings.slice(0, 10).join("\n") +
                (warnings.length > 10 ? `\n…and ${warnings.length - 10} more` : "")
            : null,
        );
      } catch (e) {
        setError(`onnx import failed: ${String((e as Error).message ?? e)}`);
      }
    };
    input.click();
  };

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
          <button onClick={importOnnx}>Import .onnx</button>
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
          <ColorLegend />
          <div className="examples-scroll">
            <ExamplesPanel />
          </div>
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
