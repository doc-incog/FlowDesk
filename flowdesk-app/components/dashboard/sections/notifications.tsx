"use client"

import { useEffect, useState } from "react"
import { BookOpen, CalendarHeart, TriangleAlert, Cog, Check, Send } from "lucide-react"
import type { NotificationItem, Role } from "@/lib/seed-data/core"
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

export function NotificationsSection({ role }: { role: Role }) {
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Compose state (admin only)
  const [composing, setComposing] = useState(false)
  const [composeTitle, setComposeTitle] = useState("")
  const [composeBody, setComposeBody] = useState("")
  const [composeCategory, setComposeCategory] = useState<NotificationItem["category"]>("system")
  const [composeTarget, setComposeTarget] = useState<"all" | "staff" | "students">("all")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  useEffect(() => {
    let alive = true
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.error) setError(d.error)
        else setItems(d.notifications ?? [])
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!items) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const visible = filter === "all" ? items : items.filter((n) => n.category === filter)
  const unread = items.filter((n) => n.unread).length

  const markAllRead = () => {
    setItems((prev) => (prev ?? []).map((n) => ({ ...n, unread: false })))
    fetch("/api/notifications", { method: "POST" }).catch(() => {})
  }
  const toggle = (id: string) =>
    setItems((prev) => (prev ?? []).map((n) => (n.id === id ? { ...n, unread: false } : n)))

  const sendNotification = async () => {
    if (!composeTitle.trim()) return
    setSending(true)
    setSendError(null)
    setSendSuccess(false)
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: composeTitle.trim(),
          body: composeBody.trim(),
          category: composeCategory,
          target: composeTarget,
        }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        setSendError(data?.error ?? "Failed to send")
      } else {
        setSendSuccess(true)
        setComposeTitle("")
        setComposeBody("")
        setTimeout(() => {
          setComposing(false)
          setSendSuccess(false)
        }, 1500)
      }
    } catch {
      setSendError("Failed to send notification")
    } finally {
      setSending(false)
    }
  }

  const inputCls =
    "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Notifications"
        description={unread > 0 ? `${unread} unread notice${unread > 1 ? "s" : ""}` : "You're all caught up"}
        action={
          <div className="flex items-center gap-2">
            {role === "admin" && (
              <button
                onClick={() => setComposing(!composing)}
                className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Send className="h-4 w-4" aria-hidden /> Send notification
              </button>
            )}
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Check className="h-4 w-4" aria-hidden /> Mark all read
            </button>
          </div>
        }
      />

      {/* Admin compose form */}
      {role === "admin" && composing && (
        <Card className="space-y-4">
          <SectionHeading title="Compose notification" description="Send a notification to students, staff, or everyone." />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="notif-title" className="text-sm font-medium">Title</label>
              <input
                id="notif-title"
                value={composeTitle}
                onChange={(e) => setComposeTitle(e.target.value)}
                placeholder="e.g. Campus holiday announcement"
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="notif-body" className="text-sm font-medium">Message</label>
              <textarea
                id="notif-body"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Notification details…"
                rows={3}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="notif-category" className="text-sm font-medium">Category</label>
                <select
                  id="notif-category"
                  value={composeCategory}
                  onChange={(e) => setComposeCategory(e.target.value as NotificationItem["category"])}
                  className={inputCls}
                >
                  <option value="academic">Academic</option>
                  <option value="event">Event</option>
                  <option value="alert">Alert</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="notif-target" className="text-sm font-medium">Send to</label>
                <select
                  id="notif-target"
                  value={composeTarget}
                  onChange={(e) => setComposeTarget(e.target.value as "all" | "staff" | "students")}
                  className={inputCls}
                >
                  <option value="all">Everyone</option>
                  <option value="students">Students only</option>
                  <option value="staff">Staff only</option>
                </select>
              </div>
            </div>
            {sendError && <p role="alert" className="text-sm text-destructive">{sendError}</p>}
            {sendSuccess && <p className="text-sm text-success font-medium">Notification sent!</p>}
            <button
              onClick={sendNotification}
              disabled={!composeTitle.trim() || sending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden /> {sending ? "Sending…" : "Send notification"}
            </button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
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
                  {n.unread && (
                    <>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span className="sr-only">Unread</span>
                    </>
                  )}
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
