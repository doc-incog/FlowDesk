"use client"

import { useEffect, useState } from "react"
import { CalendarClock, CheckCircle2, FileText, Paperclip, Plus, Trash2 } from "lucide-react"
import type { Role, ScheduleSlot, UserProfile } from "@/lib/seed-data/core"
import { Card, SectionHeading } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { Modal } from "@/components/ui/modal"
import { MockFileUpload } from "@/components/ui/mock-upload"
import { cn } from "@/lib/utils"

type Assignment = {
  id: string
  moduleCode: string
  moduleName: string
  title: string
  description: string
  assignedDate: string
  dueDate: string
  maxMarks: number
}

type Submission = {
  id: string
  assignmentId: string
  studentId: string
  studentName: string
  submittedAt: string
  fileName: string
  marks: number | null
  feedback: string
}

function daysUntil(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

const ALL_TABS: TabItem[] = [
  { id: "mytasks", label: "My tasks" },
  { id: "submissions", label: "Submissions" },
  { id: "manage", label: "Manage assignments" },
]

const STUDENT_TABS: TabItem[] = [{ id: "mytasks", label: "My tasks" }]
const ADMIN_TABS: TabItem[] = [
  { id: "mytasks", label: "My tasks" },
  { id: "submissions", label: "Submissions" },
]

export function AssignmentsSection({ role }: { role: Role }) {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [submissions, setSubmissions] = useState<Submission[] | null>(null)
  const [me, setMe] = useState<UserProfile | null>(null)
  const [modules, setModules] = useState<[string, string][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const tabs = role === "admin" ? ADMIN_TABS : role === "student" ? STUDENT_TABS : ALL_TABS
  const [tab, setTab] = useState<string>(role === "student" ? "mytasks" : role === "admin" ? "mytasks" : "submissions")

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch("/api/assignments").then((r) => r.json()),
      fetch("/api/schedule").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([a, s, m]) => {
        if (!alive) return
        if (a?.error) setError(a.error)
        else {
          setAssignments(a.assignments ?? [])
          setSubmissions(a.submissions ?? [])
        }
        if (s?.schedule) {
          setModules(
            Array.from(new Map((s.schedule as ScheduleSlot[]).map((slot) => [slot.code, slot.module])).entries()),
          )
        }
        if (m?.user) setMe(m.user)
        else if (m?.error && !a?.error) setError(m.error)
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!assignments || !submissions || !me) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const setSubmissionsSafe: React.Dispatch<React.SetStateAction<Submission[]>> = (updater) =>
    setSubmissions((prev) => (typeof updater === "function" ? updater(prev ?? []) : updater))
  const setAssignmentsSafe: React.Dispatch<React.SetStateAction<Assignment[]>> = (updater) =>
    setAssignments((prev) => (typeof updater === "function" ? updater(prev ?? []) : updater))

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Assignments"
        description="Track submissions, due dates and grades in one place."
      />
      <SectionTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "mytasks" && (
        <MyTasks
          assignments={assignments}
          submissions={submissions}
          setSubmissions={setSubmissionsSafe}
          me={me}
          role={role}
        />
      )}
      {tab === "submissions" && role !== "student" && (
        <GradeSubmissions assignments={assignments} submissions={submissions} setSubmissions={setSubmissionsSafe} role={role} />
      )}
      {tab === "manage" && role === "staff" && (
        <ManageAssignments assignments={assignments} setAssignments={setAssignmentsSafe} modules={modules} />
      )}
    </div>
  )
}

function MyTasks({
  assignments,
  submissions,
  setSubmissions,
  me,
  role,
}: {
  assignments: Assignment[]
  submissions: Submission[]
  setSubmissions: React.Dispatch<React.SetStateAction<Submission[]>>
  me: UserProfile
  role: Role
}) {
  const [uploadFor, setUploadFor] = useState<Assignment | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submit = async () => {
    if (!uploadFor || !file) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const form = new FormData()
      form.append("assignmentId", uploadFor.id)
      form.append("file", file)
      const res = await fetch("/api/submissions", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok || !data.submission) throw new Error(data.error ?? "Upload failed")
      setSubmissions((prev) => [data.submission, ...prev])
      setFile(null)
      setUploadFor(null)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setSubmitting(false)
    }
  }

  const items = assignments.map((a) => {
    const sub = submissions.find((s) => s.assignmentId === a.id && s.studentId === me.id)
    let status: "pending" | "overdue" | "submitted" | "graded"
    if (sub?.marks != null) status = "graded"
    else if (sub) status = "submitted"
    else if (daysUntil(a.dueDate) < 0) status = "overdue"
    else status = "pending"
    return { assignment: a, sub, status }
  })

  const order = { overdue: 0, pending: 1, submitted: 2, graded: 3 } as const
  const sorted = [...items].sort((x, y) => order[x.status] - order[y.status])

  return (
    <div className="space-y-3">
      {sorted.map(({ assignment: a, sub, status }) => {
        const days = daysUntil(a.dueDate)
        return (
          <Card key={a.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{a.title}</p>
                <StatusChip status={status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {a.moduleName} ({a.moduleCode}) · Due {a.dueDate}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  {status === "overdue"
                    ? `${Math.abs(days)}d overdue`
                    : status === "pending"
                      ? days === 0
                        ? "Due today"
                        : `${days}d left`
                      : "Submitted"}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" aria-hidden /> Max {a.maxMarks} marks
                </span>
                {sub?.fileName && (
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden /> {sub.fileName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {sub?.marks != null && (
                <div className="text-right">
                  <p className="font-mono text-lg font-bold text-primary">
                    {sub.marks}/{a.maxMarks}
                  </p>
                  {sub.feedback && <p className="max-w-40 text-xs text-muted-foreground">{sub.feedback}</p>}
                </div>
              )}
              {(status === "pending" || status === "overdue") && role !== "admin" && (
                <button
                  onClick={() => setUploadFor(a)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Submit
                </button>
              )}
            </div>
          </Card>
        )
      })}

      <Modal open={uploadFor !== null} onClose={() => setUploadFor(null)} title={`Submit — ${uploadFor?.title ?? ""}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Attach your solution for {uploadFor?.moduleName}. Deadline: {uploadFor?.dueDate}.
          </p>
          <MockFileUpload label="Attach solution file" onSelect={setFile} />
          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
          <button
            onClick={submit}
            disabled={!file || submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden /> {submitting ? "Uploading…" : "Submit assignment"}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function StatusChip({ status }: { status: "pending" | "overdue" | "submitted" | "graded" }) {
  const map = {
    pending: "pill bg-primary/10 text-primary",
    overdue: "pill bg-destructive/10 text-destructive",
    submitted: "pill bg-chart-2/15 text-chart-2",
    graded: "pill bg-success/10 text-success",
  }
  const label = {
    pending: "Pending",
    overdue: "Overdue",
    submitted: "Submitted",
    graded: "Graded",
  }
  return <span className={cn(map[status])}>{label[status]}</span>
}

function GradeSubmissions({
  assignments,
  submissions,
  setSubmissions,
  role,
}: {
  assignments: Assignment[]
  submissions: Submission[]
  setSubmissions: React.Dispatch<React.SetStateAction<Submission[]>>
  role: Role
}) {
  const [assignmentId, setAssignmentId] = useState(assignments[0]?.id ?? "")
  const [marks, setMarks] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const list = submissions.filter((s) => s.assignmentId === assignmentId)

  const save = (sub: Submission) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === sub.id
          ? { ...s, marks: marks[sub.id] !== undefined ? Number(marks[sub.id]) : s.marks, feedback: feedback[sub.id] ?? s.feedback }
          : s,
      ),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="asg-assignment" className="text-sm font-medium">Assignment:</label>
        <select
          id="asg-assignment"
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.moduleCode} · {a.title}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          No submissions yet for this assignment.
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((sub) => (
            <Card key={sub.id} className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{sub.studentName}</p>
                <p className="font-mono text-xs text-muted-foreground">{sub.fileName}</p>
                <p className="text-xs text-muted-foreground">Submitted {sub.submittedAt}</p>
                {sub.feedback && <p className="mt-1 text-xs text-muted-foreground">{sub.feedback}</p>}
              </div>
              <div className="flex items-center gap-2">
                {role === "admin" ? (
                  <>
                    {sub.marks != null && (
                      <span className="font-mono text-sm font-bold text-primary">{sub.marks}/{assignments.find((a) => a.id === sub.assignmentId)?.maxMarks ?? "?"}</span>
                    )}
                    {sub.feedback && <span className="max-w-40 text-xs text-muted-foreground">{sub.feedback}</span>}
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      placeholder="Marks"
                      defaultValue={sub.marks ?? ""}
                      onChange={(e) => setMarks((m) => ({ ...m, [sub.id]: e.target.value }))}
                      aria-label={`Marks for ${sub.studentName}`}
                      className="w-24 rounded-sm border border-input bg-card px-2 py-1.5 font-mono text-sm outline-none focus:border-primary"
                    />
                    <input
                      placeholder="Feedback"
                      defaultValue={sub.feedback}
                      onChange={(e) => setFeedback((f) => ({ ...f, [sub.id]: e.target.value }))}
                      aria-label={`Feedback for ${sub.studentName}`}
                      className="w-40 rounded-sm border border-input bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => save(sub)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ManageAssignments({
  assignments,
  setAssignments,
  modules,
}: {
  assignments: Assignment[]
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>
  modules: [string, string][]
}) {
  const [form, setForm] = useState({
    moduleCode: "",
    moduleName: "",
    title: "",
    description: "",
    dueDate: "",
    maxMarks: 20,
  })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!form.moduleCode || !form.moduleName || !form.title || !form.dueDate) {
      setError("Course code, course name, title and due date are required.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          assignedDate: new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }),
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d?.error ?? "Could not create the assignment.")
        return
      }
      if (d?.assignment) {
        setAssignments((prev) => [
          ...prev,
          { ...d.assignment, submission: undefined } as Assignment,
        ])
      }
      setForm({ moduleCode: "", moduleName: "", title: "", description: "", dueDate: "", maxMarks: 20 })
    } catch {
      setError("Network error while creating the assignment.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" })
      if (res.ok) setAssignments((prev) => prev.filter((x) => x.id !== id))
    } catch {
      // List refreshes on next visit
    }
  }

  const inputCls =
    "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <SectionHeading title="Create assignment" />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="asg-code" className="text-sm font-medium">Course code</label>
              <input
                id="asg-code"
                value={form.moduleCode}
                onChange={(e) => setForm((f) => ({ ...f, moduleCode: e.target.value.toUpperCase() }))}
                placeholder="CS301"
                list="asg-course-codes"
                className={inputCls}
              />
              <datalist id="asg-course-codes">
                {modules.map(([code]) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="asg-name" className="text-sm font-medium">Course name</label>
              <input
                id="asg-name"
                value={form.moduleName}
                onChange={(e) => setForm((f) => ({ ...f, moduleName: e.target.value }))}
                placeholder="Data Structures"
                list="asg-course-names"
                className={inputCls}
              />
              <datalist id="asg-course-names">
                {modules.map(([code, name]) => (
                  <option key={code} value={name}>
                    {code}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="asg-title" className="text-sm font-medium">Title</label>
            <input id="asg-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="asg-description" className="text-sm font-medium">Description</label>
            <textarea
              id="asg-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="asg-due" className="text-sm font-medium">Due date</label>
              <input id="asg-due" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="asg-maxmarks" className="text-sm font-medium">Max marks</label>
              <input id="asg-maxmarks" type="number" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button
            onClick={add}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> {saving ? "Creating…" : "Create assignment"}
          </button>
        </div>
      </Card>

      <Card>
        <SectionHeading title="All assignments" />
        <ul className="divide-y divide-border">
          {assignments.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">No assignments yet.</li>
          )}
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.title}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {a.moduleCode} · Due {a.dueDate} · {a.maxMarks} marks
                </p>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="rounded-sm p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${a.title}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
