import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { Role } from "@/lib/seed-data/core"

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-xl p-5", className)}>{children}</div>
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-balance">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = "primary",
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: "primary" | "success" | "warning" | "chart-5"
}) {
  const dotMap: Record<string, string> = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    "chart-5": "bg-muted-foreground",
  }
  return (
    <div className="glass rounded-xl px-5 py-4">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", dotMap[tone])} aria-hidden />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-foreground",
        className,
      )}
    >
      {initials}
    </span>
  )
}

const ROLE_TINT: Record<Role, string> = {
  student: "bg-primary/10 text-primary",
  staff: "bg-chart-3/15 text-chart-3",
  admin: "bg-chart-4/10 text-chart-4",
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={cn("pill capitalize", ROLE_TINT[role])}>{role}</span>
}

export function StatusBadge({ status }: { status: "on-time" | "late" | "absent" }) {
  const map = {
    "on-time": "bg-success/10 text-success",
    late: "bg-warning/15 text-warning",
    absent: "bg-destructive/10 text-destructive",
  }
  const label = { "on-time": "On time", late: "Late", absent: "Absent" }
  return <span className={cn("pill", map[status])}>{label[status]}</span>
}
