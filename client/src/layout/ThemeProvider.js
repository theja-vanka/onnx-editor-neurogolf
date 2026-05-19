import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from "react";
import { useEditor } from "../store";
export function ThemeProvider({ children }) {
    const theme = useEditor((s) => s.theme);
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);
    return _jsx(_Fragment, { children: children });
}
