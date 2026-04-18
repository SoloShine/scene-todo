import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export type AccentPreset = "indigo" | "emerald" | "rose" | "slate" | "amber" | "sky";
export type ColorMode = "light" | "dark" | "system";

interface ThemeState {
  accent: AccentPreset;
  mode: ColorMode;
}

interface ThemeContextValue extends ThemeState {
  setAccent: (a: AccentPreset) => void;
  setMode: (m: ColorMode) => void;
  resolvedMode: "light" | "dark";
}

const STORAGE_KEY = "scene-todo-theme";
const DEFAULT: ThemeState = { accent: "indigo", mode: "system" };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemMode(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadState(): ThemeState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { accent: parsed.accent || DEFAULT.accent, mode: parsed.mode || DEFAULT.mode };
    }
  } catch {}
  return DEFAULT;
}

function saveState(state: ThemeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(loadState);
  const resolvedMode = state.mode === "system" ? getSystemMode() : state.mode;

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-accent", state.accent);
    el.classList.toggle("dark", resolvedMode === "dark");
    saveState(state);
  }, [state.accent, resolvedMode]);

  useEffect(() => {
    if (state.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setState((s) => ({ ...s }));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [state.mode]);

  const setAccent = useCallback((accent: AccentPreset) => setState((s) => ({ ...s, accent })), []);
  const setMode = useCallback((mode: ColorMode) => setState((s) => ({ ...s, mode })), []);

  return (
    <ThemeContext.Provider value={{ ...state, setAccent, setMode, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
