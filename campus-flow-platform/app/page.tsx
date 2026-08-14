"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, Users, ShieldCheck, ArrowRight, Fingerprint, Building2 } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { ROLE_META, type Role } from "@/lib/mock-data"
import { BiometricScanner } from "@/components/biometric-scanner"
import { cn } from "@/lib/utils"

const ROLE_ORDER: Role[] = ["student", "staff", "admin"]

const ROLE_ICON: Record<Role, typeof GraduationCap> = {
  student: GraduationCap,
  staff: Users,
  admin: ShieldCheck,
}

const DEMO_ID: Record<Role, string> = {
  student: "aisha.karim@campus.edu",
  staff: "rahul.menon@campus.edu",
  admin: "priya.sharma@campus.edu",
}

export default function LoginPage() {
  const router = useRouter()
  const { user, ready, login } = useAuth()
  const [role, setRole] = useState<Role>("student")
  const [mode, setMode] = useState<"password" | "biometric">("password")

  useEffect(() => {
    if (ready && user) router.replace("/dashboard")
  }, [ready, user, router])

  const handleLogin = () => {
    login(role)
    router.push("/dashboard")
  }

  const Icon = ROLE_ICON[role]

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-sidebar px-8 py-10 text-sidebar-foreground lg:w-[44%] lg:px-14 lg:py-14">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="h-5 w-5" aria-hidden />
          </div>
          <span className="text-lg font-bold tracking-tight">CampusFlow</span>
        </div>

        <div className="relative z-10 my-12 max-w-md">
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
            One platform for your entire campus.
          </h1>
          <p className="mt-4 text-pretty text-sm leading-relaxed text-sidebar-foreground/70">
            Biometric check-in, notifications, mentor guidance and module routines — unified for students, staff and
            administrators.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              { icon: Fingerprint, text: "Fingerprint & WebAuthn secured access" },
              { icon: Users, text: "Role-aware dashboards for every member" },
              { icon: ShieldCheck, text: "Real-time attendance and alerts" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3 text-sm text-sidebar-foreground/85">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent">
                  <item.icon className="h-4 w-4 text-sidebar-primary" aria-hidden />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 font-mono text-xs text-sidebar-foreground/50">
          Frontend demo — credentials are pre-filled, any password works.
        </p>

        {/* subtle grid decoration */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
      </section>

      {/* Form panel */}
      <section className="flex flex-1 items-center justify-center px-6 py-10 lg:px-14">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Select your role to continue to your dashboard.</p>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Select role">
            {ROLE_ORDER.map((r) => {
              const RIcon = ROLE_ICON[r]
              const active = role === r
              return (
                <button
                  key={r}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                    active
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <RIcon className={cn("h-5 w-5", active && "text-primary")} aria-hidden />
                  <span className="text-xs font-semibold">{ROLE_META[r].label}</span>
                </button>
              )
            })}
          </div>

          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
            {ROLE_META[role].blurb}
          </p>

          {/* Method switch */}
          <div className="mt-6 flex rounded-lg border border-border bg-secondary p-1 text-sm">
            <button
              onClick={() => setMode("password")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
                mode === "password" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Password
            </button>
            <button
              onClick={() => setMode("biometric")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-medium transition-colors",
                mode === "biometric" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              Fingerprint
            </button>
          </div>

          {mode === "password" ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                handleLogin()
              }}
            >
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Campus ID / Email
                </label>
                <input
                  id="email"
                  type="email"
                  defaultValue={DEMO_ID[role]}
                  key={role}
                  className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  defaultValue="campus123"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Sign in as {ROLE_META[role].label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </form>
          ) : (
            <div className="mt-8 flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-6">
              <BiometricScanner
                label={`Scan to sign in as ${ROLE_META[role].label}`}
                onVerified={() => setTimeout(handleLogin, 700)}
              />
              <p className="text-center text-xs text-muted-foreground">
                Uses your device biometrics via WebAuthn where supported, otherwise a simulated scan.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
