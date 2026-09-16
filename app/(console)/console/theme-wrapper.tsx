"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useConsoleTheme() {
  return useContext(ThemeContext);
}

export function ConsoleThemeWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tablecraft_console_theme") as Theme | null;
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
      }
    } catch {}
    setMounted(true);
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem("tablecraft_console_theme", next);
    } catch {}
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div data-theme={theme} className="min-h-screen bg-[var(--paper)] text-[var(--ink)] transition-colors duration-150">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
