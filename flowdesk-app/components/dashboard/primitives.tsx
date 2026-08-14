import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { Role } from "@/lib/mock-data"

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>{children}</div>
  )
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
        <h2 className="text-xl font-bold tracking-tight text-balance">{title}</h2>
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
  icon,
  tone = "primary",
}: {
  label: string
  value: string | number
  hint?: string
  icon: ReactNode
  tone?: "primary" | "success" | "warning" | "chart-5"
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    "chart-5": "bg-chart-5/10 text-chart-5",
  }
  return (
    <Card className="flex items-center gap-4">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", toneMap[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        <p className="font-mono text-2xl font-bold leading-tight tracking-tight">{value}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  )
}

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground",
        className,
      )}
    >
      {initials}
    </span>
  )
}

const roleStyles: Record<Role, string> = {
  student: "bg-chart-1/10 text-chart-1",
  staff: "bg-chart-2/15 text-chart-2",
  admin: "bg-chart-3/20 text-warning",
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", roleStyles[role])}>{role}</span>
  )
}

export function StatusBadge({ status }: { status: "on-time" | "late" | "absent" }) {
  const map = {
    "on-time": "bg-success/10 text-success",
    late: "bg-warning/15 text-warning",
    absent: "bg-destructive/10 text-destructive",
  }
  const label = { "on-time": "On time", late: "Late", absent: "Absent" }
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", map[status])}>{label[status]}</span>
  )
}
