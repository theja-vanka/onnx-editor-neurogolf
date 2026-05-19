import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
export default function App() {
    const [ops, setOps] = useState(null);
    const [error, setError] = useState(null);
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
            if (!file)
                return;
            try {
                const text = await file.text();
                const spec = JSON.parse(text);
                fromSpec(spec);
            }
            catch (e) {
                setError(`import failed: ${String(e.message ?? e)}`);
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
    return (_jsx(ThemeProvider, { children: _jsxs("div", { className: "app", children: [_jsxs("header", { className: "topbar", children: [_jsx("span", { className: "title", children: "ONNX Editor" }), _jsx("span", { className: "pill", children: "NeuroGolf 2026" }), _jsx(TaskPicker, {}), _jsx("span", { className: "spacer" }), _jsx("button", { onClick: importJson, children: "Import .json" }), _jsx("button", { onClick: exportJson, children: "Export .json" }), _jsx("button", { onClick: resetGraph, children: "Reset" }), _jsx("button", { onClick: toggleTheme, title: "toggle theme", children: theme === "dark" ? "☀" : "☾" })] }), error && (_jsx("div", { style: { padding: 8 }, children: _jsx("div", { className: "error-banner", children: error }) })), _jsx("section", { className: "examples-strip", children: _jsx(ExamplesPanel, {}) }), ops ? (_jsx(ThreePane, { left: _jsxs(_Fragment, { children: [_jsxs("h3", { children: ["Ops \u00B7 opset 10 \u00B7 ", ops.length] }), _jsx("div", { className: "body", style: { padding: 0 }, children: _jsx(OpPalette, { ops: ops }) })] }), center: _jsx(Canvas, { ops: ops }), right: _jsxs(_Fragment, { children: [_jsx("h3", { children: "Properties" }), _jsx("div", { className: "body", children: _jsx(PropertiesPanel, { ops: ops }) })] }) })) : (_jsx("div", { style: { padding: 16, color: "var(--fg-muted)" }, children: "loading ops\u2026" }))] }) }));
}
