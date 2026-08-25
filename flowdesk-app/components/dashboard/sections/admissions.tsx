"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, FileText, UserPlus, XCircle } from "lucide-react"
import { Card, SectionHeading, StatCard } from "@/components/dashboard/primitives"
import { cn } from "@/lib/utils"

type AdmissionStatus = "submitted" | "reviewing" | "accepted" | "rejected"

type AdmissionApplication = {
  id: string
  programId: string
  programName: string
  applicantName: string
  email: string
  submittedAt: string
  status: AdmissionStatus
  docs: string[]
  score: number
  notes: string
}

type Program = {
  id: string
  name: string
  fee: number
}

function nextAdmissionStatus(status: AdmissionStatus): AdmissionStatus | null {
  if (status === "submitted") return "reviewing"
  if (status === "reviewing") return "accepted"
  return null
}

function normalizeDocs(docs: string[] | string): string[] {
  if (Array.isArray(docs)) return docs
  try {
    const parsed = JSON.parse(docs)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const STATUS_BADGE: Record<AdmissionStatus, string> = {
  submitted: "pill bg-primary/10 text-primary",
  reviewing: "pill bg-warning/15 text-warning",
  accepted: "pill bg-success/10 text-success",
  rejected: "pill bg-destructive/10 text-destructive",
}

const STATUS_LABEL: Record<AdmissionStatus, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  accepted: "Accepted",
  rejected: "Rejected",
}

export function AdmissionsSection() {
  const [applications, setApplications] = useState<AdmissionApplication[] | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<"all" | AdmissionStatus>("all")
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    let alive = true
    fetch("/api/admissions")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d?.error) setError(d.error)
        else {
          setApplications(
            (d.applications ?? []).map((a: AdmissionApplication) => ({ ...a, docs: normalizeDocs(a.docs) })),
          )
          setPrograms(d.programs ?? [])
        }
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!applications) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const list = applications.filter((a) => filter === "all" || a.status === filter)

  const counts = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "submitted" || a.status === "reviewing").length,
    accepted: applications.filter((a) => a.status === "accepted").length,
  }

  const setStatus = (id: string, status: AdmissionStatus, note?: string) =>
    setApplications((prev) =>
      (prev ?? []).map((a) => (a.id === id ? { ...a, status, notes: note !== undefined ? note : a.notes } : a)),
    )

  const advance = (a: AdmissionApplication) => {
    const next = nextAdmissionStatus(a.status)
    if (!next) return
    setStatus(a.id, next, next === "accepted" ? "Offer letter ready." : a.notes)
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Admissions — Review queue"
        description="Applications for the 2026 intake. Move applications from Submitted → Reviewing → Accepted, or reject with a note."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total applications" value={counts.total} icon={<FileText className="h-5 w-5" />} tone="primary" />
        <StatCard label="In review" value={counts.pending} icon={<UserPlus className="h-5 w-5" />} tone="warning" />
        <StatCard label="Accepted" value={counts.accepted} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "submitted", "reviewing", "accepted", "rejected"] as const).map((f) => (
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

      <div className="space-y-4">
        {list.map((a) => {
          const program = programs.find((p) => p.id === a.programId)
          return (
            <Card key={a.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{a.applicantName}</p>
                    <span className={cn(STATUS_BADGE[a.status])}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {a.id} · {a.email} · Submitted {a.submittedAt}
                  </p>
                  <p className="mt-1 text-sm">
                    {a.programName}
                    <span className="ml-2 pill bg-secondary text-muted-foreground">
                      Score {a.score}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Docs: {a.docs.join(", ") || "—"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {a.status === "accepted" && (
                    <span className="pill bg-success/10 text-success">
                      {program ? `Fee Rs. ${program.fee.toLocaleString("en-NP")}/yr` : ""}
                    </span>
                  )}
                  {nextAdmissionStatus(a.status) && (
                    <button
                      onClick={() => advance(a)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Advance to {STATUS_LABEL[nextAdmissionStatus(a.status)!]}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center">
                <input
                  defaultValue={a.notes}
                  onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                  placeholder="Add a review note…"
                  aria-label="Review note"
                  className="flex-1 rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
                />
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setStatus(a.id, "accepted", notes[a.id] ?? "Offer letter ready.")}
                    disabled={a.status === "accepted"}
                    className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Accept
                  </button>
                  <button
                    onClick={() => setStatus(a.id, "rejected", notes[a.id] ?? a.notes)}
                    disabled={a.status === "rejected"}
                    className="flex items-center gap-1.5 rounded-sm border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
                  >
                    <XCircle className="h-4 w-4" aria-hidden /> Reject
                  </button>
                </div>
              </div>
            </Card>
          )
        })}
        {list.length === 0 && (
          <Card className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No applications in this view.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
