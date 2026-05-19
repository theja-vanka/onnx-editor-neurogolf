import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
const MODES = ["literal", "preset", "formula", "upload"];
export function InitializerEditor({ initializers, onChange, }) {
    const update = (i, patch) => {
        const next = initializers.slice();
        next[i] = { ...next[i], ...patch };
        onChange(next);
    };
    const remove = (i) => {
        const next = initializers.slice();
        next.splice(i, 1);
        onChange(next);
    };
    const add = () => {
        onChange([
            ...initializers,
            {
                name: `W${initializers.length + 1}`,
                dtype: "float",
                shape: [10, 10, 3, 3],
                mode: "preset",
                preset: "zeros",
            },
        ]);
    };
    return (_jsxs("div", { className: "initializer-list", children: [initializers.map((it, i) => (_jsx(Card, { value: it, onChange: (p) => update(i, p), onRemove: () => remove(i) }, i))), _jsx("button", { onClick: add, children: "+ add initializer" })] }));
}
function Card({ value, onChange, onRemove, }) {
    const [shapeText, setShapeText] = useState(value.shape.join(","));
    const [valuesText, setValuesText] = useState((value.values ?? []).join(","));
    const setShape = (text) => {
        setShapeText(text);
        const parts = text.split(",").map((s) => parseInt(s.trim(), 10));
        if (parts.every((n) => Number.isFinite(n) && n > 0))
            onChange({ shape: parts });
    };
    return (_jsxs("div", { className: "initializer-card", children: [_jsxs("div", { style: { display: "flex", gap: 4, marginBottom: 4 }, children: [_jsx("input", { style: { flex: 1 }, value: value.name, onChange: (e) => onChange({ name: e.target.value }), placeholder: "name (e.g. W)" }), _jsx("button", { onClick: onRemove, children: "\u2715" })] }), _jsxs("div", { className: "attr-row", children: [_jsx("label", { children: "dtype" }), _jsxs("select", { value: value.dtype, onChange: (e) => onChange({ dtype: e.target.value }), children: [_jsx("option", { children: "float" }), _jsx("option", { children: "float64" }), _jsx("option", { children: "int32" }), _jsx("option", { children: "int64" }), _jsx("option", { children: "bool" })] })] }), _jsxs("div", { className: "attr-row", children: [_jsx("label", { children: "shape" }), _jsx("input", { value: shapeText, onChange: (e) => setShape(e.target.value), placeholder: "e.g. 10,10,3,3" })] }), _jsx("div", { className: "tabs", children: MODES.map((m) => (_jsx("button", { className: value.mode === m ? "active" : "", onClick: () => onChange({ mode: m }), children: m }, m))) }), value.mode === "literal" && (_jsxs("div", { className: "attr-row", children: [_jsx("label", { children: "values (flat, row-major)" }), _jsx("textarea", { rows: 3, value: valuesText, onChange: (e) => {
                            setValuesText(e.target.value);
                            const parts = e.target.value
                                .split(/[,\s]+/)
                                .map((s) => s.trim())
                                .filter((s) => s.length > 0)
                                .map((s) => parseFloat(s));
                            if (parts.every((n) => Number.isFinite(n)))
                                onChange({ values: parts });
                        } })] })), value.mode === "preset" && (_jsxs("div", { className: "attr-row", children: [_jsx("label", { children: "preset" }), _jsxs("select", { value: value.preset ?? "zeros", onChange: (e) => onChange({ preset: e.target.value }), children: [_jsx("option", { value: "zeros", children: "zeros" }), _jsx("option", { value: "ones", children: "ones" }), _jsx("option", { value: "identity", children: "identity (last two dims)" })] })] })), value.mode === "formula" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "attr-row", children: [_jsx("label", { children: "vars (one per shape dim)" }), _jsx("input", { value: (value.vars ?? []).join(","), onChange: (e) => onChange({
                                    vars: e.target.value
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter((s) => s.length > 0),
                                }), placeholder: "o,i,r,c" })] }), _jsxs("div", { className: "attr-row", children: [_jsx("label", { children: "expr (math, comparisons, ternary)" }), _jsx("textarea", { rows: 3, value: value.expr ?? "", onChange: (e) => onChange({ expr: e.target.value }), placeholder: "1.0 if (o == i and r == 0 and c == 0) else 0.0" })] })] })), value.mode === "upload" && (_jsxs("div", { className: "attr-row", children: [_jsx("label", { children: "file (.npy or raw bytes)" }), _jsx("input", { type: "file", onChange: async (e) => {
                            const file = e.target.files?.[0];
                            if (!file)
                                return;
                            const buf = await file.arrayBuffer();
                            const bytes = new Uint8Array(buf);
                            const offset = parseNpyHeader(bytes);
                            const slice = bytes.subarray(offset);
                            let bin = "";
                            for (let i = 0; i < slice.length; i++)
                                bin += String.fromCharCode(slice[i]);
                            const b64 = btoa(bin);
                            onChange({ data_b64: b64 });
                        } }), value.data_b64 && (_jsxs("span", { style: { fontSize: 11, color: "var(--fg-muted)" }, children: [Math.round((value.data_b64.length * 3) / 4), " bytes loaded"] }))] }))] }));
}
function parseNpyHeader(bytes) {
    // .npy magic: \x93NUMPY ; if not, treat as raw bytes (offset 0).
    if (bytes.length < 10 || bytes[0] !== 0x93)
        return 0;
    const head = String.fromCharCode(...bytes.subarray(1, 6));
    if (head !== "NUMPY")
        return 0;
    const headerLen = bytes[8] | (bytes[9] << 8);
    return 10 + headerLen;
}
