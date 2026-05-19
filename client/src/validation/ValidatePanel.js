import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { api } from "../api";
import { useEditor } from "../store";
import { DiffRow } from "./DiffGrids";
import { ScoreCard } from "./ScoreCard";
export function ValidateDock() {
    const taskNum = useEditor((s) => s.currentTask);
    const toSpec = useEditor((s) => s.toSpec);
    const [open, setOpen] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const validate = async () => {
        if (!taskNum) {
            setError("pick a task first");
            return;
        }
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const r = await api.validate(toSpec(), taskNum);
            setResult(r);
            if (!r.ok && r.error)
                setError(r.error);
        }
        catch (e) {
            setError(String(e.message ?? e));
        }
        finally {
            setBusy(false);
        }
    };
    const exportOnnx = async () => {
        try {
            const r = await api.build(toSpec());
            const bytes = Uint8Array.from(atob(r.onnxB64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `task${String(taskNum).padStart(3, "0")}.onnx`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (e) {
            setError(String(e.message ?? e));
        }
    };
    if (!open) {
        return (_jsx("div", { className: "validate-dock", style: { height: 36, maxHeight: 36 }, children: _jsx("header", { children: _jsx("button", { onClick: () => setOpen(true), children: "\u25B2 Validate" }) }) }));
    }
    return (_jsxs("div", { className: "validate-dock", children: [_jsxs("header", { children: [_jsx("span", { children: "Validation" }), _jsx("span", { style: { flex: 1 } }), _jsx("button", { className: "primary", disabled: busy, onClick: validate, children: busy ? "running…" : "Validate" }), _jsx("button", { onClick: exportOnnx, children: "Export .onnx" }), _jsx("button", { onClick: () => setOpen(false), title: "collapse", children: "\u2212" })] }), _jsxs("div", { className: "body", children: [error && _jsx("div", { className: "error-banner", children: error }), result && (_jsxs(_Fragment, { children: [_jsx(ScoreCard, { result: result }), result.summary && (_jsx("div", { style: { display: "flex", gap: 6, fontSize: 11, marginBottom: 8 }, children: Object.entries(result.summary).map(([k, v]) => (_jsxs("span", { className: "pill", children: [k, ": ", v.pass, "\u2713 / ", v.fail, "\u2717"] }, k))) })), _jsx("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: result.perExample.map((rec, i) => (_jsx(DiffRow, { rec: rec }, i))) })] }))] })] }));
}
