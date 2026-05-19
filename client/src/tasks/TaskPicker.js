import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../api";
import { useEditor } from "../store";
export function TaskPicker() {
    const [tasks, setTasks] = useState([]);
    const current = useEditor((s) => s.currentTask);
    const setCurrent = useEditor((s) => s.setCurrentTask);
    useEffect(() => {
        api.listTasks().then(setTasks).catch(() => setTasks([]));
    }, []);
    return (_jsxs("div", { className: "task-picker", children: [_jsx("span", { className: "pill", children: "task" }), _jsxs("select", { value: current, onChange: (e) => setCurrent(parseInt(e.target.value, 10)), children: [_jsx("option", { value: 0, children: "\u2014 pick \u2014" }), tasks.map((t) => (_jsx("option", { value: t.num, children: String(t.num).padStart(3, "0") }, t.num)))] }), _jsx("input", { type: "number", min: 1, max: 400, placeholder: "jump", style: { width: 64 }, onKeyDown: (e) => {
                    if (e.key === "Enter") {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isFinite(v) && v > 0)
                            setCurrent(v);
                    }
                } })] }));
}
