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

// A supporting document is either a plain label (seed data) or an uploaded
// file with { name, path } metadata (real applications).
type DocEntry = { name: string; path?: string }

type ScholarshipApplication = {
  id: string
  scholarshipId: string
  studentId: string
  studentName: string
  status: ScholarshipStatus
  submittedAt: string
  docs: DocEntry[]
}

function normalizeDocs(docs: DocEntry[] | string | unknown): DocEntry[] {
  if (Array.isArray(docs)) {
    return docs.map((d) =>
      typeof d === "string" ? { name: d } : { name: String(d.name ?? "Document"), path: typeof d.path === "string" ? d.path : undefined },
    )
  }
  if (typeof docs === "string") {
    try {
      const parsed = JSON.parse(docs)
      if (Array.isArray(parsed)) return normalizeDocs(parsed)
    } catch {
      // Fall through to a single-entry list
    }
    return docs.trim() ? [{ name: docs }] : []
  }
  return []
}

function docHref(applicationId: string, doc: DocEntry): string | null {
  if (!doc.path) return null
  return `/api/scholarships/applications/${applicationId}/docs?file=${encodeURIComponent(doc.name)}`
}

function DocList({ applicationId, docs }: { applicationId: string; docs: DocEntry[] }) {
  if (docs.length === 0) return <span>—</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {docs.map((d, i) => {
        const href = docHref(applicationId, d)
        const inner = (
          <>
            <FileText className="h-3 w-3" aria-hidden />
            {d.name}
          </>
        )
        return href ? (
          <a
            key={`${d.name}-${i}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            title="Open document"
            className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-sm border border-border bg-secondary/60 px-1.5 py-0.5 text-xs text-primary underline-offset-2 hover:underline"
          >
            {inner}
          </a>
        ) : (
          <span key={`${d.name}-${i}`} className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-sm border border-border bg-secondary/60 px-1.5 py-0.5 text-xs text-muted-foreground">
            {inner}
          </span>
        )
      })}
    </span>
  )
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
  const [docFiles, setDocFiles] = useState<File[]>([])
  const [applied, setApplied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [applyError, setApplyError] = useState("")
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
    setDocFiles([])
    setApplied(false)
    setApplyError("")
  }

  const submitApplication = async () => {
    if (!applyTarget || submitting) return
    setSubmitting(true)
    setApplyError("")
    try {
      const form = new FormData()
      form.append("scholarshipId", applyTarget.id)
      for (const f of docFiles) form.append("docs", f)
      const res = await fetch("/api/scholarships/applications", { method: "POST", body: form })
      const d = await res.json()
      if (!res.ok) {
        setApplyError(d?.error ?? "Could not submit the application.")
        return
      }
      if (d?.application) {
        setApplications((prev) => [
          { ...d.application, docs: normalizeDocs(d.application.docs) },
          ...prev,
        ])
      }
      setApplied(true)
    } catch {
      setApplyError("Network error while submitting the application.")
    } finally {
      setSubmitting(false)
    }
  }

  if (role === "admin") {
    return <AdminScholarships applications={applications} setApplications={setApplications} scholarships={scholarships} setScholarships={setScholarships} />
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
                <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold">Rs. {applyTarget.amount.toLocaleString("en-NP")}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Eligibility</dt><dd>{applyTarget.eligibility}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Deadline</dt><dd>{applyTarget.deadline}</dd></div>
              </dl>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Supporting documents</label>
              <MockFileUpload
                label="Attach transcript, certificate or income proof"
                onSelect={(file) => file && setDocFiles((d) => [...d, file])}
              />
              {docFiles.length > 0 && (
                <ul className="space-y-1">
                  {docFiles.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-sm border border-border bg-secondary/50 px-3 py-1.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setDocFiles((d) => d.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${f.name}`}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <XCircle className="h-4 w-4" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">Up to 4 documents, 5 MB each.</p>
            </div>
            {applyError && <p role="alert" className="text-sm text-destructive">{applyError}</p>}
            <button
              onClick={submitApplication}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden /> {submitting ? "Submitting…" : "Submit application"}
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
        <div className="flex justify-between"><dt className="text-muted-foreground">Amount</dt><dd className="font-mono font-bold text-primary">Rs. {s.amount.toLocaleString("en-NP")}</dd></div>
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
                {a.id} · Submitted {a.submittedAt} · <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" aria-hidden /> Docs:</span>{" "}<DocList applicationId={a.id} docs={a.docs} />
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
  setScholarships,
}: {
  applications: ScholarshipApplication[]
  setApplications: React.Dispatch<React.SetStateAction<ScholarshipApplication[]>>
  scholarships: Scholarship[]
  setScholarships: React.Dispatch<React.SetStateAction<Scholarship[]>>
}) {
  const [filter, setFilter] = useState<"all" | ScholarshipStatus>("all")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [savingScholarship, setSavingScholarship] = useState(false)
  const [form, setForm] = useState({
    name: "",
    provider: "",
    amount: "",
    eligibility: "",
    seats: "",
    deadline: "",
    description: "",
  })
  const list = applications.filter((a) => filter === "all" || a.status === filter)
  const counts = {
    total: applications.length,
    approved: applications.filter((a) => a.status === "approved").length,
    pending: applications.filter((a) => a.status === "submitted" || a.status === "under-review").length,
  }

  const createScholarship = async () => {
    setSavingScholarship(true)
    setCreateError("")
    try {
      const res = await fetch("/api/scholarships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          provider: form.provider.trim(),
          amount: Number(form.amount),
          eligibility: form.eligibility.trim(),
          seats: Number(form.seats),
          deadline: form.deadline.trim(),
          description: form.description.trim(),
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setCreateError(d?.error ?? "Could not create the scholarship.")
        return
      }
      if (d?.scholarship) {
        setScholarships((prev) => [d.scholarship, ...prev])
      }
      setCreating(false)
      setForm({ name: "", provider: "", amount: "", eligibility: "", seats: "", deadline: "", description: "" })
    } catch {
      setCreateError("Network error while creating the scholarship.")
    } finally {
      setSavingScholarship(false)
    }
  }

  const inputCls =
    "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  const setField = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const setStatus = async (id: string, status: ScholarshipStatus) => {
    try {
      const res = await fetch(`/api/scholarships/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
      }
    } catch {
      // Status refreshes on next visit
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Scholarship applications"
        description="Review and approve scholarship applications from the review queue."
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden /> New scholarship
          </button>
        }
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
                  {a.id} · {s?.name ?? a.scholarshipId} · {s ? `Rs. ${s.amount.toLocaleString("en-NP")}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Submitted {a.submittedAt} ·{" "}
                  <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" aria-hidden /> Docs:</span>{" "}
                  <DocList applicationId={a.id} docs={a.docs} />
                </p>
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

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create scholarship"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className={inputCls} value={form.name} onChange={(e) => setField("name")(e.target.value)} placeholder="e.g. Merit Scholarship 2026" />
            </Field>
            <Field label="Provider">
              <input className={inputCls} value={form.provider} onChange={(e) => setField("provider")(e.target.value)} placeholder="e.g. University Grants Commission" />
            </Field>
            <Field label="Amount (Rs.)">
              <input type="number" min={0} className={inputCls} value={form.amount} onChange={(e) => setField("amount")(e.target.value)} placeholder="e.g. 50000" />
            </Field>
            <Field label="Seats">
              <input type="number" min={1} className={inputCls} value={form.seats} onChange={(e) => setField("seats")(e.target.value)} placeholder="e.g. 10" />
            </Field>
            <Field label="Deadline">
              <input type="date" className={cn(inputCls, "font-mono")} value={form.deadline} onChange={(e) => setField("deadline")(e.target.value)} />
            </Field>
            <Field label="Eligibility">
              <input className={inputCls} value={form.eligibility} onChange={(e) => setField("eligibility")(e.target.value)} placeholder="e.g. CGPA 3.5+, Nepali citizens" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea className={cn(inputCls, "min-h-20 resize-y")} value={form.description} onChange={(e) => setField("description")(e.target.value)} placeholder="Short description shown to students." />
              </Field>
            </div>
          </div>
          {createError && <p role="alert" className="text-sm text-destructive">{createError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setCreating(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={createScholarship}
              disabled={savingScholarship || !form.name.trim() || !form.deadline.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" aria-hidden /> {savingScholarship ? "Creating…" : "Create scholarship"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
