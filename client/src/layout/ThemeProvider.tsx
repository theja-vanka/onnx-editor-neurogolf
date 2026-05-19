import { useEffect } from "react";
import { useEditor } from "../store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useEditor((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return <>{children}</>;
}
