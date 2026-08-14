"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Building2, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { ADMIN_CREDS } from "@/lib/mock-data"
import { ThemeToggle } from "@/components/theme-toggle"

export default function LoginPage() {
  const router = useRouter()
  const { user, ready, login } = useAuth()
  const [email, setEmail] = useState("aisha.karim@campus.edu")
  const [password, setPassword] = useState("campus123")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (ready && user) router.replace("/dashboard")
  }, [ready, user, router])

  const handleLogin = (e: FormEvent) => {
    e.preventDefault()
    const profile = login(email, password)
    if (!profile) {
      setError("Invalid credentials. Use a registered campus email, or the admin credentials shown below.")
      return
    }
    router.push("/dashboard")
  }

  return (
    <main className="ambient flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 lg:flex-row lg:gap-14 lg:px-14">
      {/* Brand panel */}
      <section className="relative z-10 w-full max-w-md pb-10 lg:pb-0">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-5.5 w-5.5" aria-hidden />
          </div>
          <span className="text-2xl font-semibold tracking-tight">FlowDesk</span>
        </div>

        <h1 className="mt-10 text-balance text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
          One platform for your entire campus.
        </h1>
        <p className="mt-4 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Attendance, notices, mentors and routines — unified for students, staff and administrators.
        </p>

        <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> Sign in with your campus email
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> Role-aware dashboards for every member
          </li>
          <li className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden /> Attendance, notices and mentor guidance
          </li>
        </ul>
      </section>

      {/* Form panel */}
      <section className="relative z-10 w-full max-w-md">
        <div className="glass-strong rounded-2xl p-7 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter your campus email to continue.</p>

          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Campus ID / Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                autoComplete="username"
                className="w-full rounded-lg border border-input bg-card/70 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                autoComplete="current-password"
                className="w-full rounded-lg border border-input bg-card/70 px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.99]"
            >
              Sign in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </form>

          <div className="mt-6 rounded-xl bg-secondary/60 p-4">
            <p className="text-xs font-semibold text-foreground">Demo credentials</p>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Student</span> — any student email, e.g.{" "}
                <span className="font-mono">aisha.karim@campus.edu</span>
              </li>
              <li>
                <span className="font-medium text-foreground">Staff</span> — any staff email, e.g.{" "}
                <span className="font-mono">rahul.menon@campus.edu</span>
              </li>
              <li>
                <span className="font-medium text-foreground">Admin</span> —{" "}
                <span className="font-mono">{ADMIN_CREDS.email}</span> /{" "}
                <span className="font-mono">{ADMIN_CREDS.password}</span>
              </li>
            </ul>
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            New to the campus?{" "}
            <Link href="/apply" className="font-semibold text-primary hover:underline">
              Apply for admission
            </Link>
          </p>
        </div>

        <div className="mt-5 flex justify-center lg:hidden">
          <ThemeToggle />
        </div>
      </section>

      {/* Theme toggle — desktop, top right */}
      <div className="fixed right-5 top-5 z-20 hidden lg:block">
        <ThemeToggle />
      </div>
    </main>
  )
}
