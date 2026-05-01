import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "amel.theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with "dark" on the server so SSR markup matches the
  // initial client render (no hydration mismatch). Real preference is
  // applied in an effect below.
  const [theme, setThemeState] = useState<Theme>("dark");

  // Read stored preference on mount and apply it.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const initial: Theme = stored === "light" || stored === "dark" ? stored : "dark";
      setThemeState(initial);
    } catch { /* ignore */ }
  }, []);

  // Reflect theme on <html> so per-tab accents + Tailwind utilities can react.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((p) => (p === "dark" ? "light" : "dark")), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
