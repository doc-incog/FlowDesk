"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { UserProfile } from "@/lib/seed-data/core"

type AuthContextValue = {
  user: UserProfile | null
  ready: boolean
  login: (email: string, password: string) => Promise<UserProfile | null>
  logout: () => Promise<void>
  refreshUser: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => {
        // session check failed — treated as signed out
      })
      .finally(() => setReady(true))
  }, [])

  const login = async (email: string, password: string): Promise<UserProfile | null> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok || !data?.user) return null
    setUser(data.user)
    return data.user as UserProfile
  }

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // network error — clear local state regardless
    }
    setUser(null)
  }

  const refreshUser = async (): Promise<UserProfile | null> => {
    try {
      const res = await fetch("/api/auth/me")
      const data = await res.json()
      if (data?.user) setUser(data.user)
      return data?.user ?? null
    } catch {
      return null
    }
  }

  return <AuthContext.Provider value={{ user, ready, login, logout, refreshUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
