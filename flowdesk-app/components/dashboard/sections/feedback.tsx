"use client"

import { useEffect, useState } from "react"
import { MessageSquareText, Star } from "lucide-react"
import type { UserProfile } from "@/lib/seed-data/core"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { RatingStars } from "@/components/ui/rating-stars"
import { Progress } from "@/components/ui/progress"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

type FeedbackTarget = {
  id: string
  type: "teacher" | "event"
  name: string
  subtitle: string
}

type FeedbackEntry = {
  id: string
  targetId: string
  rating: number
  comment: string
  byName: string
  createdAt: string
}

function averageRating(entries: FeedbackEntry[]): number {
  if (entries.length === 0) return 0
  return entries.reduce((sum, e) => sum + e.rating, 0) / entries.length
}

type Filter = "all" | "teacher" | "event"

export function FeedbackSection() {
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null)
  const [targets, setTargets] = useState<FeedbackTarget[]>([])
  const [me, setMe] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [target, setTarget] = useState<FeedbackTarget | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch("/api/feedback").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([f, m]) => {
        if (!alive) return
        if (f?.error) setError(f.error)
        else {
          setTargets(f.targets ?? [])
          setEntries(f.entries ?? [])
        }
        if (m?.user) setMe(m.user)
        else if (m?.error && !f?.error) setError(m.error)
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (!entries || !me) return <p className="text-sm text-muted-foreground">Loading…</p>

  const visibleTargets = targets.filter((t) => filter === "all" || t.type === filter)

  const openModal = (t: FeedbackTarget) => {
    setTarget(t)
    setRating(5)
    setComment("")
    setSubmitted(false)
  }

  const submit = () => {
    if (!target) return
    setEntries((prev) => [
      ...(prev ?? []),
      {
        id: `F${Date.now()}`,
        targetId: target.id,
        rating,
        comment: comment.trim(),
        byName: me.name,
        createdAt: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
      },
    ])
    setSubmitted(true)
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Feedback"
        description="Rate your teachers and campus events. Responses help improve quality — aggregated views for faculty."
      />

      <div className="flex flex-wrap gap-2">
        {(["all", "teacher", "event"] as const).map((f) => (
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTargets.map((t) => {
          const tEntries = entries.filter((e) => e.targetId === t.id)
          const avg = averageRating(tEntries)
          return (
            <Card key={t.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.type === "teacher" ? "Teacher" : "Event"} · {t.subtitle}
                  </p>
                </div>
                <span className="shrink-0 pill bg-primary/10 text-primary">
                  {avg > 0 ? avg.toFixed(1) : "—"}
                </span>
              </div>
              <div className="my-3 flex-1">
                <RatingStars value={avg} size="h-4 w-4" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {tEntries.length} rating{tEntries.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => openModal(t)}
                className="flex w-full items-center justify-center gap-2 rounded-sm border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                <Star className="h-4 w-4" aria-hidden /> Rate
              </button>
            </Card>
          )
        })}
      </div>

      <Modal open={target !== null} onClose={() => setTarget(null)} title={`Rate — ${target?.name ?? ""}`}>
        {target && !submitted ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <RatingStars value={rating} size="h-7 w-7" onChange={setRating} />
              <p className="text-sm font-medium">
                {rating === 5 ? "Excellent" : rating === 4 ? "Good" : rating === 3 ? "Average" : rating === 2 ? "Poor" : "Very poor"}
              </p>
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Anything specific you'd like to add? (optional)"
              className="w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <button
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden /> Submit feedback
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Feedback is shown aggregated — individual responses are anonymous to faculty.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <MessageSquareText className="h-8 w-8" aria-hidden />
            </span>
            <p className="font-bold">Thank you for your feedback!</p>
            <p className="text-sm text-muted-foreground">Your rating for {target?.name} has been recorded.</p>
            <button
              onClick={() => setTarget(null)}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        )}
      </Modal>

      <Card>
        <SectionHeading title="Rating distribution" description="How ratings are spread across targets (average of 1–5)." />
        <div className="space-y-3">
          {targets.map((t) => {
            const tEntries = entries.filter((e) => e.targetId === t.id)
            const avg = averageRating(tEntries)
            const pct = Math.round((avg / 5) * 100)
            return (
              <div key={t.id} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-sm">{t.name}</span>
                <Progress value={pct} className="h-2 flex-1" />
                <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {avg > 0 ? `${avg.toFixed(1)}★` : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
