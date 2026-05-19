import { useEffect } from "react";
import { useEditor } from "../store";
export function useKeyboardShortcuts() {
    const deleteSelected = useEditor((s) => s.deleteSelected);
    const duplicateSelected = useEditor((s) => s.duplicateSelected);
    useEffect(() => {
        const onKey = (e) => {
            const tag = e.target?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select")
                return;
            if (e.key === "Delete" || e.key === "Backspace") {
                e.preventDefault();
                deleteSelected();
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
                e.preventDefault();
                duplicateSelected();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [deleteSelected, duplicateSelected]);
}
