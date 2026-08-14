"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { ADMIN_CREDS, DEMO_USERS, STAFF, STUDENTS, type Role, type UserProfile } from "@/lib/mock-data"

const STORAGE_KEY = "flowdesk.session"

type AuthContextValue = {
  user: UserProfile | null
  ready: boolean
  login: (email: string, password: string) => UserProfile | null
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const role = JSON.parse(raw) as Role
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time session hydration from localStorage
        if (DEMO_USERS[role]) setUser(DEMO_USERS[role])
      }
    } catch {
      // ignore corrupted session
    }
    setReady(true)
  }, [])

  const login = (email: string, password: string): UserProfile | null => {
    const normalized = email.trim().toLowerCase()

    if (normalized === ADMIN_CREDS.email && password === ADMIN_CREDS.password) {
      const profile = DEMO_USERS.admin
      setUser(profile)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify("admin"))
      } catch {
        // storage unavailable — session stays in memory
      }
      return profile
    }

    const known = [...STUDENTS, ...STAFF].find((u) => u.email.toLowerCase() === normalized)
    if (!known) return null

    const profile = known.role === "staff" ? DEMO_USERS.staff : DEMO_USERS.student
    setUser(profile)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile.role))
    } catch {
      // storage unavailable — session stays in memory
    }
    return profile
  }

  const logout = () => {
    setUser(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
