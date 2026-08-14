"use client"

import { useEffect, useState } from "react"

/**
 * State persisted to localStorage, seeded from `initial` on first visit.
 * Reads synchronously on first render (client-only components; safe because
 * these views only render after the dashboard is ready).
 */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage unavailable
    }
  }, [key, value])

  return [value, setValue] as const
}
