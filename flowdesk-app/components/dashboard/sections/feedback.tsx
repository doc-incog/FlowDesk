"use client"

import { useEffect, useState } from "react"
import { MessageSquareText, Plus, Star, Trash2 } from "lucide-react"
import type { Role, UserProfile } from "@/lib/seed-data/core"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { RatingStars } from "@/components/ui/rating-stars"
import { Progress } from "@/components/ui/progress"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

type FeedbackTarget = {
  id: string
  type: string
  name: string
  subtitle: string
}

type FeedbackEntry = {
  id: string
  targetId: string
  rating: number
  // Only present for admins — individual responses are private otherwise.
  comment?: string
  byName?: string
  createdAt: string
}

function averageRating(entries: FeedbackEntry[]): number {
  if (entries.length === 0) return 0
  return entries.reduce((sum, e) => sum + e.rating, 0) / entries.length
}

type Filter = "all" | string

const inputCls =
  "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

export function FeedbackSection({ role }: { role: Role }) {
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

  // Admin: create / manage feedback forms
  const [form, setForm] = useState({ type: "event", name: "", subtitle: "" })
  const [creatingForm, setCreatingForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const isAdmin = role === "admin"

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

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!entries || !me) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const visibleTargets = targets.filter((t) => filter === "all" || t.type === filter)
  const knownTypes = [...new Set(targets.map((t) => t.type))].sort()

  const openModal = (t: FeedbackTarget) => {
    setTarget(t)
    setRating(5)
    setComment("")
    setSubmitted(false)
  }

  const submit = async () => {
    if (!target) return
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: target.id, rating, comment: comment.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.entry) {
        setEntries((prev) => {
          const filteredPrev = (prev ?? []).filter((e) => e.targetId !== target.id)
          return [...filteredPrev, data.entry]
        })
      }
    } catch {
      // Optimistic fallback
      setEntries((prev) => [
        ...(prev ?? []),
        {
          id: `F${Date.now()}`,
          targetId: target.id,
          rating,
          comment: comment.trim(),
          createdAt: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
        },
      ])
    }
    setSubmitted(true)
  }

  const createForm = async () => {
    if (!form.name.trim() || creatingForm) return
    setCreatingForm(true)
    setFormError(null)
    try {
      const res = await fetch("/api/feedback/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data?.error ?? "Could not create the form.")
        return
      }
      setTargets((prev) => [...prev, data.target])
      setForm({ type: form.type, name: "", subtitle: "" })
    } catch {
      setFormError("Network error while creating the form.")
    } finally {
      setCreatingForm(false)
    }
  }

  const removeTarget = async (id: string) => {
    try {
      const res = await fetch(`/api/feedback/targets/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? "Could not delete the form.")
        return
      }
      setTargets((prev) => prev.filter((t) => t.id !== id))
      setEntries((prev) => (prev ?? []).filter((e) => e.targetId !== id))
    } catch {
      setError("Network error while deleting the form.")
    } finally {
      setDeleteTargetId(null)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Feedback"
        description={
          isAdmin
            ? "Create feedback forms for any event or topic, then review exactly who wrote what."
            : "Rate your teachers, events and campus topics. Responses help improve quality."
        }
      />

      {/* Admin: create a feedback form */}
      {isAdmin && (
        <Card className="border-primary/30 space-y-3">
          <div>
            <p className="font-bold">Create a feedback form</p>
            <p className="text-xs text-muted-foreground">Students and staff will be able to rate it here.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="fb-form-name" className="text-sm font-medium">Title</label>
              <input
                id="fb-form-name"
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Tech Fest 2026"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fb-form-type" className="text-sm font-medium">Category</label>
              <input
                id="fb-form-type"
                className={inputCls}
                list="fb-form-type-options"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="event"
              />
              <datalist id="fb-form-type-options">
                {["teacher", "event", ...knownTypes.filter((t) => t !== "teacher" && t !== "event")].map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="fb-form-subtitle" className="text-sm font-medium">Short note</label>
              <input
                id="fb-form-subtitle"
                className={inputCls}
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          <button
            onClick={createForm}
            disabled={!form.name.trim() || creatingForm}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" aria-hidden /> {creatingForm ? "Creating…" : "Create form"}
          </button>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(["all", ...knownTypes] as Filter[]).map((f) => (
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTargets.map((t) => {
          const tEntries = entries.filter((e) => e.targetId === t.id)
          const avg = averageRating(tEntries)
          return (
            <Card key={t.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {t.type} · {t.subtitle}
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
              {isAdmin && (
                <div className="mb-3 min-h-[28px]">
                  {deleteTargetId === t.id ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5">
                      <span className="text-xs">Delete this form?</span>
                      <span className="flex gap-1.5">
                        <button
                          onClick={() => removeTarget(t.id)}
                          className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(null)}
                          className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors hover:bg-secondary"
                        >
                          Cancel
                        </button>
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteTargetId(t.id)}
                      title="Delete this feedback form"
                      className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
              )}
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
              rows={5}
              placeholder="Anything specific you'd like to add? (optional)"
              aria-label="Comment"
              className="min-h-[120px] w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <button
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden /> Submit feedback
            </button>
            <p className="text-center text-xs text-muted-foreground">
              {isAdmin
                ? "As an admin you can later see who wrote each response."
                : "Feedback is shown aggregated — individual responses are anonymous."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <MessageSquareText className="h-8 w-8" aria-hidden />
            </span>
            <p role="status" className="font-bold">Thank you for your feedback!</p>
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

      {/* Admin only: exactly who wrote what */}
      {isAdmin && (
        <Card>
          <SectionHeading
            title="Individual responses"
            description="Only visible to admins — every response with its author."
          />
          {entries.some((e) => e.byName) ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Written by</th>
                    <th className="pb-2 font-medium">Form</th>
                    <th className="pb-2 font-medium">Rating</th>
                    <th className="pb-2 font-medium">Comment</th>
                    <th className="pb-2 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((e) => {
                    const t = targets.find((x) => x.id === e.targetId)
                    return (
                      <tr key={e.id}>
                        <td className="py-2.5 font-medium">{e.byName ?? "—"}</td>
                        <td className="py-2.5">{t?.name ?? e.targetId}</td>
                        <td className="py-2.5"><RatingStars value={e.rating} size="h-3.5 w-3.5" /></td>
                        <td className="max-w-72 py-2.5 text-muted-foreground">{e.comment || "—"}</td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{e.createdAt}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No written comments yet — ratings arrive anonymously aggregated above.
            </p>
          )}
        </Card>
      )}

      {!isAdmin && (
        <Card>
          <SectionHeading title="Rating distribution" description="How ratings are spread across forms (average of 1–5)." />
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
      )}
    </div>
  )
}
