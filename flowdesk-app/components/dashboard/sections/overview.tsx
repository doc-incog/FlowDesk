"use client"

import { useEffect, useState } from "react"
import {
  Fingerprint,
  Users,
  GraduationCap,
  CalendarClock,
  Bell,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  UserRound,
} from "lucide-react"
import type { NotificationItem, Role, ScheduleSlot } from "@/lib/seed-data/core"
import { Card, SectionHeading, StatCard, StatusBadge } from "@/components/dashboard/primitives"
import type { SectionId } from "@/components/dashboard/shell"

const GREETING = () => {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

type OverviewStat = {
  label: string
  value: string | number
  hint?: string
  tone: "primary" | "chart-5" | "success" | "warning"
  icon: "graduation" | "users" | "shield" | "fingerprint" | "user" | "calendar" | "bell" | "trending"
}

type RecentCheckIn = {
  name: string
  rollNo: string
  time: string
  status: "on-time" | "late"
}

type OverviewData = {
  stats: OverviewStat[]
  todaysClasses: ScheduleSlot[]
  notices: NotificationItem[]
  recentCheckIns: RecentCheckIn[]
}

const STAT_ICONS: Record<OverviewStat["icon"], React.ReactNode> = {
  graduation: <GraduationCap className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  shield: <ShieldCheck className="h-5 w-5" />,
  fingerprint: <Fingerprint className="h-5 w-5" />,
  user: <UserRound className="h-5 w-5" />,
  calendar: <CalendarClock className="h-5 w-5" />,
  bell: <Bell className="h-5 w-5" />,
  trending: <TrendingUp className="h-5 w-5" />,
}

export function OverviewSection({ role, onNavigate }: { role: Role; onNavigate: (s: SectionId) => void }) {
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/overview")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return
        if (j?.error) setError(j.error)
        else setData(j)
      })
      .catch(() => alive && setError("Failed to load"))
    return () => {
      alive = false
    }
  }, [])

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const { stats, todaysClasses, notices, recentCheckIns } = data

  return (
    <div className="space-y-6">
      <SectionHeading
        title={`${GREETING()} — here is your campus at a glance`}
        description="A live snapshot of attendance, schedule and campus activity."
      />

      {/* Stats — role aware */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} tone={s.tone} icon={STAT_ICONS[s.icon]} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's schedule */}
        <Card className="lg:col-span-2">
          <SectionHeading
            title="Today's routine"
            action={
              <button onClick={() => onNavigate("schedule")} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Full schedule <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            }
          />
          {todaysClasses.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">No classes scheduled today.</p>
          ) : (
            <ul className="space-y-3">
              {todaysClasses.map((s) => (
                <li key={s.id} className="flex items-center gap-4 rounded-md border border-border p-3">
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-mono text-sm font-bold">{s.start}</p>
                    <p className="font-mono text-xs text-muted-foreground">{s.end}</p>
                  </div>
                  <div className="h-10 w-px bg-border" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.module}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {s.code} · Room {s.room}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">{s.staff}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Quick actions + notices */}
        <div className="space-y-6">
          <Card>
            <SectionHeading title="Quick actions" />
            <div className="grid grid-cols-2 gap-3">
              <QuickAction icon={<Fingerprint className="h-5 w-5" />} label="Check in" onClick={() => onNavigate("checkin")} />
              <QuickAction icon={<CalendarClock className="h-5 w-5" />} label="Schedule" onClick={() => onNavigate("schedule")} />
              <QuickAction icon={<Bell className="h-5 w-5" />} label="Notices" onClick={() => onNavigate("notifications")} />
              <QuickAction
                icon={role === "admin" ? <Users className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                label={role === "admin" ? "Directory" : "Mentor"}
                onClick={() => onNavigate(role === "admin" ? "students" : "mentor")}
              />
            </div>
          </Card>

          <Card>
            <SectionHeading title="Latest notices" />
            {notices.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">No notices right now.</p>
            ) : (
              <ul className="space-y-3">
                {notices.slice(0, 3).map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {role === "staff" && (
        <Card>
          <SectionHeading
            title="Recent student check-ins"
            action={
              <button onClick={() => onNavigate("checkin")} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View log <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            }
          />
          {recentCheckIns.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">No check-ins yet today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentCheckIns.map((st) => (
                <li key={`${st.name}-${st.time}`} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{st.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{st.rollNo}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{st.time}</span>
                    <StatusBadge status={st.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-md border border-border p-4 text-sm font-medium transition-colors hover:border-primary hover:bg-secondary"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  )
}
