"use client"

import { useEffect, useState } from "react"
import { Award, CheckCircle2, Clock, FileText, Plus, XCircle } from "lucide-react"
import type { Role, UserProfile } from "@/lib/seed-data/core"
import { Card, SectionHeading, StatCard } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { Modal } from "@/components/ui/modal"
import { MockFileUpload } from "@/components/ui/mock-upload"
import { cn } from "@/lib/utils"

type Scholarship = {
  id: string
  name: string
  provider: string
  amount: number
  eligibility: string
  seats: number
  deadline: string
  description: string
}

type ScholarshipStatus = "submitted" | "under-review" | "approved" | "rejected"

type ScholarshipApplication = {
  id: string
  scholarshipId: string
  studentId: string
  studentName: string
  status: ScholarshipStatus
  submittedAt: string
  docs: string[]
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

const TABS: TabItem[] = [
  { id: "browse", label: "Browse & apply" },
  { id: "applications", label: "My applications" },
]

const STATUS_BADGE: Record<ScholarshipStatus, string> = {
  submitted: "pill bg-primary/10 text-primary",
  "under-review": "pill bg-warning/15 text-warning",
  approved: "pill bg-success/10 text-success",
  rejected: "pill bg-destructive/10 text-destructive",
}

const STATUS_LABEL: Record<ScholarshipStatus, string> = {
  submitted: "Submitted",
  "under-review": "Under review",
  approved: "Approved",
  rejected: "Rejected",
}

export function ScholarshipsSection({ role }: { role: Role }) {
  const [scholarships, setScholarships] = useState<Scholarship[]>([])
  const [applications, setApplications] = useState<ScholarshipApplication[]>([])
  const [me, setMe] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("browse")
  const [applyTarget, setApplyTarget] = useState<Scholarship | null>(null)
  const [docNames, setDocNames] = useState<string[]>([])
  const [applied, setApplied] = useState(false)
  const isStudent = role === "student"

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch("/api/scholarships").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([s, m]) => {
        if (!alive) return
        if (s?.error) {
          setError(s.error)
        } else {
          setScholarships(s.scholarships ?? [])
          setApplications(
            (s.applications ?? []).map((a: ScholarshipApplication) => ({ ...a, docs: normalizeDocs(a.docs) })),
          )
        }
        if (m?.user) setMe(m.user)
        else if (m?.error && !s?.error) setError(m.error)
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!me) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const openApply = (s: Scholarship) => {
    setApplyTarget(s)
    setDocNames([])
    setApplied(false)
  }

  const submitApplication = () => {
    if (!applyTarget) return
    setApplications((prev) => [
      {
        id: `SA-${Date.now()}`,
        scholarshipId: applyTarget.id,
        studentId: me.id,
        studentName: me.name,
        status: "submitted",
        submittedAt: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
        docs: docNames.filter(Boolean),
      },
      ...prev,
    ])
    setApplied(true)
  }

  if (role === "admin") {
    return <AdminScholarships applications={applications} setApplications={setApplications} scholarships={scholarships} />
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Scholarships"
        description="Merit, need-based and sports scholarships offered across programmes."
      />
      <SectionTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "browse" ? (
        scholarships.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">No scholarships available right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {scholarships.map((s) => (
              <ScholarshipCard key={s.id} s={s} canApply={isStudent} onApply={() => openApply(s)} />
            ))}
          </div>
        )
      ) : (
        <StudentApplications applications={applications} scholarships={scholarships} me={me} />
      )}
      {!isStudent && (
        <p className="text-sm text-muted-foreground">
          Students can apply from the Scholarships section. Staff can view the programme details above.
        </p>
      )}

      <Modal
        open={applyTarget !== null}
        onClose={() => setApplyTarget(null)}
        title={`Apply — ${applyTarget?.name ?? ""}`}
      >
        {applyTarget && !applied ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-secondary/60 px-4 py-3 text-sm">
              <dl className="space-y-1">
                <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">{applyTarget.amount.toLocaleString("en-IN")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Eligibility</dt><dd>{applyTarget.eligibility}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Deadline</dt><dd>{applyTarget.deadline}</dd></div>
              </dl>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Supporting documents</label>
              <MockFileUpload label="Attach transcript, certificate or income proof" onSelect={(file) => file && setDocNames((d) => [...d, file.name])} />
            </div>
            <button
              onClick={submitApplication}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" aria-hidden /> Submit application
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Review typically completes within 2 weeks. Track status in &quot;My applications&quot;.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" aria-hidden />
            </span>
            <p className="font-bold">Application submitted</p>
            <p className="text-sm text-muted-foreground">
              {applyTarget?.name} · Track the status under &quot;My applications&quot;.
            </p>
            <button
              onClick={() => setApplyTarget(null)}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Done
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function ScholarshipCard({ s, canApply, onApply }: { s: Scholarship; canApply: boolean; onApply: () => void }) {
  return (
    <Card className="flex flex-col">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border bg-secondary text-muted-foreground">
        <Award className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 font-semibold leading-snug">{s.name}</p>
      <p className="text-xs text-muted-foreground">{s.provider}</p>
      <div className="my-3 border-t border-border" />
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold text-primary">₹{s.amount.toLocaleString("en-IN")}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Eligibility</dt><dd className="text-right">{s.eligibility}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Seats</dt><dd>{s.seats}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Deadline</dt><dd className="font-medium">{s.deadline}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">{s.description}</p>
      <button
        onClick={onApply}
        disabled={!canApply}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden /> Apply
      </button>
    </Card>
  )
}

function StudentApplications({
  applications,
  scholarships,
  me,
}: {
  applications: ScholarshipApplication[]
  scholarships: Scholarship[]
  me: UserProfile
}) {
  const mine = applications.filter((a) => a.studentId === me.id)

  if (mine.length === 0) {
    return (
      <Card className="py-12 text-center">
        <p className="text-sm text-muted-foreground">You haven&apos;t applied for any scholarships yet.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {mine.map((a) => {
        const s = scholarships.find((x) => x.id === a.scholarshipId)
        return (
          <Card key={a.id} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s?.name ?? a.id}</p>
              <p className="text-xs text-muted-foreground">
                {a.id} · Submitted {a.submittedAt} · Docs: {a.docs.join(", ") || "—"}
              </p>
            </div>
            <span className={cn("self-start", STATUS_BADGE[a.status])}>
              {STATUS_LABEL[a.status]}
            </span>
          </Card>
        )
      })}
    </div>
  )
}

function AdminScholarships({
  applications,
  setApplications,
  scholarships,
}: {
  applications: ScholarshipApplication[]
  setApplications: React.Dispatch<React.SetStateAction<ScholarshipApplication[]>>
  scholarships: Scholarship[]
}) {
  const [filter, setFilter] = useState<"all" | ScholarshipStatus>("all")
  const list = applications.filter((a) => filter === "all" || a.status === filter)
  const counts = {
    total: applications.length,
    approved: applications.filter((a) => a.status === "approved").length,
    pending: applications.filter((a) => a.status === "submitted" || a.status === "under-review").length,
  }

  const setStatus = (id: string, status: ScholarshipStatus) =>
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Scholarship applications"
        description="Review and approve scholarship applications from the review queue."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total applications" value={counts.total} icon={<FileText className="h-5 w-5" />} tone="primary" />
        <StatCard label="Pending review" value={counts.pending} icon={<Clock className="h-5 w-5" />} tone="warning" />
        <StatCard label="Approved" value={counts.approved} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "submitted", "under-review", "approved", "rejected"] as const).map((f) => (
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
        {list.map((a) => {
          const s = scholarships.find((x) => x.id === a.scholarshipId)
          return (
            <Card key={a.id} className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{a.studentName}</p>
                  <span className={cn(STATUS_BADGE[a.status])}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  {a.id} · {s?.name ?? a.scholarshipId} · {s ? `₹${s.amount.toLocaleString("en-IN")}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Submitted {a.submittedAt} · {a.docs.join(", ")}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => setStatus(a.id, "approved")}
                  disabled={a.status === "approved"}
                  className="flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-sm font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve
                </button>
                <button
                  onClick={() => setStatus(a.id, "rejected")}
                  disabled={a.status === "rejected"}
                  className="flex items-center gap-1.5 rounded-sm border border-destructive/40 px-3 py-1.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-40"
                >
                  <XCircle className="h-4 w-4" aria-hidden /> Reject
                </button>
              </div>
            </Card>
          )
        })}
        {list.length === 0 && (
          <Card className="py-10 text-center text-sm text-muted-foreground">No applications in this view.</Card>
        )}
      </div>
    </div>
  )
}
