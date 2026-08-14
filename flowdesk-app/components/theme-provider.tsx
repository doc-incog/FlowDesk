"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "light" | "dark" | "system"

const STORAGE_KEY = "flowdesk.theme"

type ThemeContextValue = {
  theme: Theme
  resolved: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle("dark", isDark)
  root.style.colorScheme = isDark ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolved, setResolved] = useState<"light" | "dark">("light")

  useEffect(() => {
    let stored: Theme = "system"
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw
    } catch {
      // ignore corrupted preference
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time theme hydration from localStorage
    setThemeState(stored)
    applyTheme(stored)
    setResolved(stored === "system" ? (systemPrefersDark() ? "dark" : "light") : stored)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        setResolved(e.matches ? "dark" : "light")
        applyTheme("system")
      }
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    setResolved(next === "system" ? (systemPrefersDark() ? "dark" : "light") : next)
    applyTheme(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable — theme stays in memory
    }
  }

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider")
  return ctx
}
