import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function AttributeForm({ schema, values, onChange }) {
    if (schema.attributes.length === 0) {
        return (_jsxs("div", { style: { color: "var(--fg-muted)", fontSize: 12 }, children: ["No attributes for ", schema.name, "."] }));
    }
    return (_jsx("div", { className: "attr-form", children: schema.attributes.map((attr) => (_jsx(AttrRow, { attr: attr, value: values[attr.name] ?? attr.default, set: (v) => onChange({ ...values, [attr.name]: v }), clear: () => {
                const next = { ...values };
                delete next[attr.name];
                onChange(next);
            } }, attr.name))) }));
}
function AttrRow({ attr, value, set, clear, }) {
    return (_jsxs("div", { className: "attr-row", children: [_jsxs("label", { title: attr.description, children: [attr.name, _jsxs("span", { style: { color: "var(--fg-muted)" }, children: [" ", "\u00B7 ", attr.type, attr.required ? " · required" : ""] })] }), renderEditor(attr, value, set), !attr.required && (_jsx("button", { style: { alignSelf: "flex-start", marginTop: 2 }, onClick: clear, children: "unset" }))] }));
}
function renderEditor(attr, value, set) {
    switch (attr.type) {
        case "int":
            return (_jsx("input", { type: "number", value: value === undefined || value === null ? "" : String(value), onChange: (e) => set(e.target.value === "" ? undefined : parseInt(e.target.value, 10)) }));
        case "float":
            return (_jsx("input", { type: "number", step: "any", value: value === undefined || value === null ? "" : String(value), onChange: (e) => set(e.target.value === "" ? undefined : parseFloat(e.target.value)) }));
        case "string":
            return (_jsx("input", { type: "text", value: value === undefined || value === null ? "" : String(value), onChange: (e) => set(e.target.value) }));
        case "ints":
        case "floats": {
            const cur = Array.isArray(value) ? value.join(",") : "";
            const isFloat = attr.type === "floats";
            return (_jsx("input", { type: "text", placeholder: "comma-separated", value: cur, onChange: (e) => {
                    const parts = e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                    const arr = parts.map((p) => (isFloat ? parseFloat(p) : parseInt(p, 10)));
                    set(arr.some((n) => Number.isNaN(n)) ? value : arr);
                } }));
        }
        case "strings": {
            const cur = Array.isArray(value) ? value.join(",") : "";
            return (_jsx("input", { type: "text", placeholder: "comma-separated", value: cur, onChange: (e) => set(e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)) }));
        }
        default:
            return (_jsx("input", { type: "text", placeholder: `(${attr.type}) JSON`, value: value === undefined ? "" : JSON.stringify(value), onChange: (e) => {
                    try {
                        set(e.target.value === "" ? undefined : JSON.parse(e.target.value));
                    }
                    catch {
                        // ignore until valid JSON
                    }
                } }));
    }
}
