import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useEditor } from "../store";
import { ArcGridView } from "./ArcGridView";
export function ExamplesPanel() {
    const taskNum = useEditor((s) => s.currentTask);
    const [task, setTask] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        setError(null);
        setTask(null);
        if (!taskNum)
            return;
        api
            .getTask(taskNum)
            .then((r) => setTask(r.task))
            .catch((e) => setError(String(e.message ?? e)));
    }, [taskNum]);
    if (!taskNum) {
        return (_jsx("div", { className: "examples-empty", children: "Pick a task to see its train / test / arc-gen examples." }));
    }
    if (error)
        return _jsx("div", { className: "error-banner", style: { margin: 8 }, children: error });
    if (!task)
        return _jsx("div", { className: "examples-empty", children: "loading\u2026" });
    return (_jsxs("div", { className: "examples-row", children: [_jsx(ExampleGroup, { label: "train", examples: task.train }), _jsx(ExampleGroup, { label: "test", examples: task.test }), task["arc-gen"] && task["arc-gen"].length > 0 && (_jsx(ExampleGroup, { label: "arc-gen", examples: task["arc-gen"] }))] }));
}
function ExampleGroup({ label, examples, }) {
    return (_jsxs("div", { className: "example-group", children: [_jsxs("div", { className: "example-group-label", children: [_jsx("span", { children: label }), _jsx("span", { className: "count", children: examples.length })] }), _jsx("div", { className: "example-group-items", children: examples.map((e, i) => (_jsxs("div", { className: "example-pair", children: [_jsx(ArcGridView, { grid: e.input, cellSize: 6 }), _jsx("span", { className: "example-arrow", children: "\u2192" }), _jsx(ArcGridView, { grid: e.output, cellSize: 6 })] }, `${label}-${i}`))) })] }));
}
