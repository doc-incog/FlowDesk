"use client"

import { useState } from "react"
import { BookOpen, CalendarHeart, TriangleAlert, Cog, Check } from "lucide-react"
import { NOTIFICATIONS, type NotificationItem } from "@/lib/mock-data"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

const CATEGORY_META: Record<
  NotificationItem["category"],
  { icon: typeof BookOpen; label: string; className: string }
> = {
  academic: { icon: BookOpen, label: "Academic", className: "bg-chart-1/10 text-chart-1" },
  event: { icon: CalendarHeart, label: "Event", className: "bg-chart-5/10 text-chart-5" },
  alert: { icon: TriangleAlert, label: "Alert", className: "bg-destructive/10 text-destructive" },
  system: { icon: Cog, label: "System", className: "bg-chart-2/15 text-chart-2" },
}

const FILTERS = ["all", "academic", "event", "alert", "system"] as const

export function NotificationsSection() {
  const [items, setItems] = useState<NotificationItem[]>(NOTIFICATIONS)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all")

  const visible = filter === "all" ? items : items.filter((n) => n.category === filter)
  const unread = items.filter((n) => n.unread).length

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, unread: false })))
  const toggle = (id: string) => setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)))

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Notifications"
        description={unread > 0 ? `${unread} unread notice${unread > 1 ? "s" : ""}` : "You're all caught up"}
        action={
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Check className="h-4 w-4" aria-hidden /> Mark all read
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((n) => {
          const meta = CATEGORY_META[n.category]
          return (
            <Card
              key={n.id}
              className={cn(
                "flex items-start gap-4 transition-colors",
                n.unread ? "border-primary/30 bg-primary/[0.03]" : "",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
                <meta.icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{n.title}</p>
                  {n.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{n.body}</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">{n.time}</p>
              </div>
              {n.unread && (
                <button
                  onClick={() => toggle(n.id)}
                  className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="Mark as read"
                >
                  <Check className="h-4 w-4" aria-hidden />
                </button>
              )}
            </Card>
          )
        })}
        {visible.length === 0 && (
          <Card className="py-10 text-center text-sm text-muted-foreground">No notifications in this category.</Card>
        )}
      </div>
    </div>
  )
}
