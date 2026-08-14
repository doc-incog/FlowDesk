"use client"

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
import {
  CAMPUS_STATS,
  NOTIFICATIONS,
  SCHEDULE,
  STUDENTS,
  type Role,
} from "@/lib/mock-data"
import { Card, SectionHeading, StatCard, StatusBadge } from "@/components/dashboard/primitives"
import type { SectionId } from "@/components/dashboard/shell"

const GREETING = () => {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 17) return "Good afternoon"
  return "Good evening"
}

export function OverviewSection({ role, onNavigate }: { role: Role; onNavigate: (s: SectionId) => void }) {
  const todaysClasses = SCHEDULE.filter((s) => s.day === "Mon")
  const unread = NOTIFICATIONS.filter((n) => n.unread)

  return (
    <div className="space-y-6">
      <SectionHeading
        title={`${GREETING()} — here is your campus at a glance`}
        description="A live snapshot of attendance, schedule and campus activity."
      />

      {/* Stats — role aware */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {role === "admin" && (
          <>
            <StatCard label="Total students" value={CAMPUS_STATS.totalStudents.toLocaleString()} icon={<GraduationCap className="h-5 w-5" />} tone="primary" />
            <StatCard label="Total staff" value={CAMPUS_STATS.totalStaff} icon={<Users className="h-5 w-5" />} tone="chart-5" />
            <StatCard label="Present today" value={CAMPUS_STATS.presentToday.toLocaleString()} hint={`${CAMPUS_STATS.avgAttendance}% attendance`} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
            <StatCard label="Biometric devices" value={`${CAMPUS_STATS.devicesOnline}/${CAMPUS_STATS.biometricDevices}`} hint="online" icon={<Fingerprint className="h-5 w-5" />} tone="warning" />
          </>
        )}
        {role === "staff" && (
          <>
            <StatCard label="My mentees" value={12} icon={<UserRound className="h-5 w-5" />} tone="primary" />
            <StatCard label="Classes today" value={todaysClasses.length} icon={<CalendarClock className="h-5 w-5" />} tone="chart-5" />
            <StatCard label="Present today" value={`${CAMPUS_STATS.avgAttendance}%`} hint="across your modules" icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
            <StatCard label="Unread alerts" value={unread.length} icon={<Bell className="h-5 w-5" />} tone="warning" />
          </>
        )}
        {role === "student" && (
          <>
            <StatCard label="My attendance" value="92%" hint="this semester" icon={<TrendingUp className="h-5 w-5" />} tone="success" />
            <StatCard label="Classes today" value={todaysClasses.length} icon={<CalendarClock className="h-5 w-5" />} tone="primary" />
            <StatCard label="Check-in status" value="Done" hint="08:42 AM · on time" icon={<Fingerprint className="h-5 w-5" />} tone="chart-5" />
            <StatCard label="Unread notices" value={unread.length} icon={<Bell className="h-5 w-5" />} tone="warning" />
          </>
        )}
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
          <ul className="space-y-3">
            {todaysClasses.map((s) => (
              <li key={s.id} className="flex items-center gap-4 rounded-xl border border-border p-3">
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
            <ul className="space-y-3">
              {unread.slice(0, 3).map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {role !== "student" && (
        <Card>
          <SectionHeading
            title="Recent student check-ins"
            action={
              <button onClick={() => onNavigate("checkin")} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View log <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            }
          />
          <ul className="divide-y divide-border">
            {STUDENTS.slice(0, 4).map((st, i) => (
              <li key={st.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{st.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{st.rollNo}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">0{8 + (i % 2)}:{i}5 AM</span>
                  <StatusBadge status={i === 3 ? "late" : "on-time"} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
    >
      <span className="text-primary">{icon}</span>
      {label}
    </button>
  )
}
