"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { DEMO_USERS, type Role, type UserProfile } from "@/lib/mock-data"

const STORAGE_KEY = "campusflow.session"

type AuthContextValue = {
  user: UserProfile | null
  ready: boolean
  login: (role: Role) => UserProfile
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
        if (DEMO_USERS[role]) setUser(DEMO_USERS[role])
      }
    } catch {
      // ignore corrupted session
    }
    setReady(true)
  }, [])

  const login = (role: Role) => {
    const profile = DEMO_USERS[role]
    setUser(profile)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(role))
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
