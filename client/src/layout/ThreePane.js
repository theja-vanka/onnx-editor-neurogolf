import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ThreePane({ left, center, right, }) {
    return (_jsxs("div", { className: "three-pane", children: [_jsx("aside", { className: "pane left", children: left }), _jsx("main", { className: "pane middle", children: center }), _jsx("aside", { className: "pane right", children: right })] }));
}
