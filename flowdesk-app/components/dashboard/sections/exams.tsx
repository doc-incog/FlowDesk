"use client"

import { useEffect, useState } from "react"
import { CalendarDays, Check, Clock, Download, MapPin, Plus, Trash2, TrendingUp } from "lucide-react"
import type { Role, ScheduleSlot, UserProfile } from "@/lib/seed-data/core"
import { Card, SectionHeading, StatCard } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type ExamType = "midterm" | "final" | "practical"

type Exam = {
  id: string
  title: string
  moduleCode: string
  moduleName: string
  type: ExamType
  date: string
  start: string
  end: string
  room: string
  maxMarks: number
  result?: { marks: number; maxMarks: number }
}

type ResultRow = {
  id: string
  examId: string
  studentId: string
  marks: number
  maxMarks: number
}

const TYPE_BADGE: Record<ExamType, string> = {
  midterm: "pill bg-chart-1/10 text-chart-1",
  final: "pill bg-chart-5/10 text-chart-5",
  practical: "pill bg-chart-2/15 text-chart-2",
}

const TYPE_LABEL: Record<ExamType, string> = {
  midterm: "Mid-term",
  final: "Final",
  practical: "Practical",
}

function percentage(marks: number, max: number): number {
  return max > 0 ? Math.round((marks / max) * 100) : 0
}

function gradeFor(pct: number): string {
  if (pct >= 90) return "A+"
  if (pct >= 80) return "A"
  if (pct >= 70) return "B+"
  if (pct >= 60) return "B"
  if (pct >= 50) return "C+"
  if (pct >= 40) return "C"
  return "D"
}

function seatFor(studentId: string, students: UserProfile[]): number {
  const idx = students.findIndex((s) => s.id === studentId)
  return idx >= 0 ? idx + 1 : 0
}

const tabsFor = (role: Role): TabItem[] => {
  if (role === "student") {
    return [
      { id: "schedule", label: "Exam schedule" },
      { id: "seating", label: "My seating" },
      { id: "results", label: "Report card" },
    ]
  }
  if (role === "staff") {
    return [
      { id: "schedule", label: "Exam schedule" },
      { id: "entry", label: "Mark entry" },
      { id: "results", label: "All results" },
      { id: "manage", label: "Manage exams" },
    ]
  }
  return [
    { id: "schedule", label: "Exam schedule" },
    { id: "entry", label: "Mark entry" },
    { id: "results", label: "All results" },
    { id: "manage", label: "Manage exams" },
  ]
}

export function ExamsSection({ role }: { role: Role }) {
  const [exams, setExams] = useState<Exam[] | null>(null)
  const [results, setResults] = useState<ResultRow[]>([])
  const [students, setStudents] = useState<UserProfile[]>([])
  const [me, setMe] = useState<UserProfile | null>(null)
  const [modules, setModules] = useState<[string, string][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("schedule")
  const seesAllResults = role === "staff" || role === "admin"

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch("/api/exams").then((r) => r.json()),
      fetch("/api/directory").then((r) => r.json()),
      fetch("/api/schedule").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([e, d, s, m]) => {
        if (!alive) return
        if (e?.error) {
          setError(e.error)
        } else {
          const examsList = e.exams ?? []
          setExams(examsList)
          const myId = m?.user?.id ?? ""
          if (seesAllResults && Array.isArray(e.results)) {
            // Staff/admin receive every student's marks for the entry grid.
            setResults(
              e.results.map(
                (r: { examId: string; studentId: string; marks: number; maxMarks: number }) => ({
                  id: `${r.examId}-${r.studentId}`,
                  examId: r.examId,
                  studentId: r.studentId,
                  marks: r.marks,
                  maxMarks: r.maxMarks,
                }),
              ),
            )
          } else {
            setResults(
              examsList.flatMap((ex: Exam) =>
                ex.result
                  ? [{ id: `${ex.id}-${myId}`, examId: ex.id, studentId: myId, marks: ex.result.marks, maxMarks: ex.result.maxMarks }]
                  : [],
              ),
            )
          }
        }
        if (d?.students) setStudents(d.students)
        if (s?.schedule) {
          setModules(
            Array.from(new Map((s.schedule as ScheduleSlot[]).map((slot) => [slot.code, slot.module])).entries()),
          )
        }
        if (m?.user) setMe(m.user)
        else if (m?.error && !e?.error) setError(m.error)
      })
      .catch(() => alive && setError("Failed to load"))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [seesAllResults])

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>
  if (!exams || !me) return <p role="status" className="text-sm text-muted-foreground">Loading…</p>

  const setExamsSafe: React.Dispatch<React.SetStateAction<Exam[]>> = (updater) =>
    setExams((prev) => (typeof updater === "function" ? updater(prev ?? []) : updater))

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Exams & Results"
        description="Exam schedules, seating plans, mark entry and auto-calculated report cards."
      />
      <SectionTabs tabs={tabsFor(role)} active={tab} onChange={setTab} />

      {tab === "schedule" && <ExamSchedule exams={exams} />}
      {tab === "seating" && <SeatingView exams={exams} students={students} me={me} />}
      {tab === "entry" && <MarkEntry exams={exams} results={results} setResults={setResults} students={students} />}
      {tab === "results" && role === "student" && <ReportCardView student={me} exams={exams} results={results} />}
      {tab === "results" && role !== "student" && <AllResults exams={exams} results={results} students={students} />}
      {tab === "manage" && role !== "student" && <ManageExams exams={exams} setExams={setExamsSafe} modules={modules} />}
    </div>
  )
}

function ExamSchedule({ exams }: { exams: Exam[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {exams.map((ex) => (
        <Card key={ex.id} className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{ex.moduleName}</p>
              <p className="font-mono text-xs text-muted-foreground">{ex.moduleCode}</p>
            </div>
            <span className={cn("shrink-0", TYPE_BADGE[ex.type])}>
              {TYPE_LABEL[ex.type]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{ex.title}</p>
          <dl className="space-y-1.5 border-t border-border pt-3 text-sm">
            <Row icon={<CalendarDays className="h-3.5 w-3.5" />} label={ex.date} />
            <Row icon={<Clock className="h-3.5 w-3.5" />} label={`${ex.start} – ${ex.end}`} />
            <Row icon={<MapPin className="h-3.5 w-3.5" />} label={`${ex.room} · Max ${ex.maxMarks} marks`} />
          </dl>
        </Card>
      ))}
    </div>
  )
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-2 text-muted-foreground">
      <span aria-hidden>{icon}</span> {label}
    </p>
  )
}

function SeatingView({ exams, students, me }: { exams: Exam[]; students: UserProfile[]; me: UserProfile }) {
  const [examId, setExamId] = useState(exams[0]?.id ?? "")
  const exam = exams.find((e) => e.id === examId)
  const mySeat = seatFor(me.id, students)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card>
        <p className="mb-3 text-sm font-semibold">Select exam</p>
        <div className="space-y-2">
          {exams.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setExamId(ex.id)}
              aria-pressed={examId === ex.id}
              className={cn(
                "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-sm transition-colors",
                examId === ex.id ? "border-primary bg-primary/[0.04]" : "border-border hover:bg-secondary",
              )}
            >
              <span className="font-medium">{ex.moduleCode}</span>
              <span className="font-mono text-xs text-muted-foreground">{ex.date}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-2">
        {exam ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{exam.moduleName} — {exam.title}</p>
                <p className="text-sm text-muted-foreground">{exam.date} · {exam.room} · {exam.start}–{exam.end}</p>
              </div>
              <span className="pill bg-primary/10 text-primary">
                Your seat: {mySeat}
              </span>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Room layout ({students.length} seats)
              </p>
              <div className="grid grid-cols-5 gap-3">
                {students.map((s, i) => {
                  const seat = i + 1
                  const mine = seat === mySeat
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-md border p-3 text-center",
                        mine
                          ? "border-primary bg-primary/[0.04] text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground",
                      )}
                    >
                      <p className="font-mono text-sm font-bold">{seat}</p>
                      <p className="mt-1 max-w-full truncate text-xs">{mine ? "You" : s.avatarInitials}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">No exams scheduled.</p>
        )}
      </Card>
    </div>
  )
}

type ReportRow = {
  exam: Exam
  marks: number
  max: number
  pct: number
  grade: string
}

function buildReport(student: UserProfile, exams: Exam[], results: ResultRow[]): ReportRow[] {
  return exams
    .map((ex) => {
      const r = results.find((x) => x.examId === ex.id && x.studentId === student.id)
      if (!r) return null
      const pct = percentage(r.marks, r.maxMarks)
      return { exam: ex, marks: r.marks, max: r.maxMarks, pct, grade: gradeFor(pct) }
    })
    .filter((x): x is ReportRow => x !== null)
}

function ReportCardView({ student, exams, results }: { student: UserProfile; exams: Exam[]; results: ResultRow[] }) {
  const rows = buildReport(student, exams, results)
  const totalMarks = rows.reduce((s, r) => s + r.marks, 0)
  const totalMax = rows.reduce((s, r) => s + r.max, 0)
  const overall = percentage(totalMarks, totalMax)

  const download = async () => {
    const res = await fetch("/api/exams/report-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: student.name,
        studentId: student.id,
        rollNo: student.rollNo,
        department: student.department,
        semester: student.semester,
        rows,
        totalMax,
        totalMarks,
        overall,
        grade: gradeFor(overall),
      }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `report-card-${student.id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-lg font-bold">{student.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{student.id} · {student.rollNo} · {student.semester}</p>
          </div>
        </div>
        <button
          onClick={download}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Download className="h-4 w-4" aria-hidden /> Download report card
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total marks" value={`${totalMarks}/${totalMax}`} icon={<Check className="h-5 w-5" />} tone="primary" />
        <StatCard label="Overall" value={`${overall}%`} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Grade" value={gradeFor(overall)} icon={<CalendarDays className="h-5 w-5" />} tone="warning" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">Exam</th>
              <th className="pb-2 font-medium">Module</th>
              <th className="pb-2 text-right font-medium">Max</th>
              <th className="pb-2 text-right font-medium">Marks</th>
              <th className="pb-2 text-right font-medium">%</th>
              <th className="pb-2 text-right font-medium">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.exam.id}>
                <td className="py-2.5">{r.exam.title}</td>
                <td className="py-2.5 font-mono text-muted-foreground">{r.exam.moduleCode}</td>
                <td className="py-2.5 text-right text-muted-foreground">{r.max}</td>
                <td className="py-2.5 text-right font-semibold">{r.marks}</td>
                <td className="py-2.5 text-right text-muted-foreground">{r.pct}%</td>
                <td className="py-2.5 text-right">
                  <span className="pill bg-primary/10 text-primary">{r.grade}</span>
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2.5">Total</td>
              <td className="py-2.5" />
              <td className="py-2.5 text-right">{totalMax}</td>
              <td className="py-2.5 text-right">{totalMarks}</td>
              <td className="py-2.5 text-right">{overall}%</td>
              <td className="py-2.5 text-right">{gradeFor(overall)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card>
        <SectionHeading title="Grade trend" description="Percentage across examinations this semester." />
        <div className="flex h-40 items-end justify-around gap-4">
          {rows.map((r) => (
            <div key={r.exam.id} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-xs font-semibold text-primary">{r.pct}%</span>
              <div
                className={cn("w-full max-w-12 rounded-t-sm", r.pct >= 60 ? "bg-primary" : "bg-warning")}
                style={{ height: `${Math.max(8, r.pct)}%` }}
              />
              <span className="font-mono text-[10px] text-muted-foreground">{r.exam.moduleCode}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function AllResults({ exams, results, students }: { exams: Exam[]; results: ResultRow[]; students: UserProfile[] }) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "")
  const student = students.find((s) => s.id === studentId) ?? students[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="exam-student" className="text-sm font-medium">Student:</label>
        <select
          id="exam-student"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.rollNo}
            </option>
          ))}
        </select>
      </div>
      {student && <ReportCardView student={student} exams={exams} results={results} />}
    </div>
  )
}

function MarkEntry({
  exams,
  results,
  setResults,
  students,
}: {
  exams: Exam[]
  results: ResultRow[]
  setResults: React.Dispatch<React.SetStateAction<ResultRow[]>>
  students: UserProfile[]
}) {
  const [examId, setExamId] = useState(exams[0]?.id ?? "")
  const [marks, setMarks] = useState<Record<string, number | "">>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const exam = exams.find((e) => e.id === examId)

  // Marks already saved for this exam pre-fill the grid; `marks` holds only
  // unsaved local edits on top of them.
  const savedForExam: Record<string, number> = {}
  for (const r of results) if (r.examId === examId) savedForExam[r.studentId] = r.marks
  const valueFor = (studentId: string): number | "" =>
    studentId in marks ? marks[studentId] : savedForExam[studentId] ?? ""

  const selectExam = (id: string) => {
    setExamId(id)
    setMarks({})
    setSaved(false)
    setError("")
  }

  const save = async () => {
    if (!exam || saving) return
    setSaving(true)
    setError("")
    try {
      const payloadRows = students
        .map((s) => ({ studentId: s.id, value: valueFor(s.id) }))
        .filter(({ value }) => value !== "")
      const responses = await Promise.all(
        payloadRows.map(({ studentId, value }) =>
          fetch("/api/exams/results", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ examId, studentId, marks: value }),
          }).then((r) => r.json()),
        ),
      )
      const failed = responses.find((d) => d?.error)
      if (failed) {
        setError(failed.error)
        return
      }
      setResults((prev) => {
        const others = prev.filter((r) => r.examId !== examId)
        const rows = students.flatMap((s) => {
          const savedRow = responses.find((d) => d?.result?.studentId === s.id)?.result
          return savedRow
            ? [{ id: `${examId}-${s.id}`, examId, studentId: s.id, marks: savedRow.marks, maxMarks: savedRow.maxMarks }]
            : []
        })
        return [...others, ...rows]
      })
      setMarks({})
      setSaved(true)
    } catch {
      setError("Network error while saving marks.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="exam-select" className="text-sm font-medium">Exam:</label>
        <select
          id="exam-select"
          value={examId}
          onChange={(e) => selectExam(e.target.value)}
          className="rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.moduleCode} · {e.title} ({e.date})
            </option>
          ))}
        </select>
        {exam && <span className="text-sm text-muted-foreground">Max {exam.maxMarks} marks</span>}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 font-medium">Student</th>
              <th className="pb-2 font-medium">Roll No</th>
              <th className="pb-2 text-right font-medium">Marks / {exam?.maxMarks ?? 0}</th>
              <th className="pb-2 text-right font-medium">Grade (auto)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((s) => {
              const m = valueFor(s.id)
              const numeric = m === "" ? 0 : Number(m)
              const pct = exam ? percentage(numeric, exam.maxMarks) : 0
              return (
                <tr key={s.id}>
                  <td className="py-2.5 font-medium">{s.name}</td>
                  <td className="py-2.5 font-mono text-muted-foreground">{s.rollNo}</td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      max={exam?.maxMarks ?? 0}
                      value={m}
                      onChange={(e) =>
                        setMarks((prev) => ({
                          ...prev,
                          [s.id]: e.target.value === "" ? "" : Number(e.target.value),
                        }))
                      }
                      aria-label={`Marks for ${s.name}`}
                      className="w-24 rounded-sm border border-input bg-card px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-primary"
                    />
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="pill bg-primary/10 text-primary">{gradeFor(pct)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check className="h-4 w-4" aria-hidden /> {saving ? "Saving…" : "Save marks"}
        </button>
        {saved && !error && <span role="status" className="text-sm font-medium text-success">Marks saved — grades updated on report cards.</span>}
      </div>
    </div>
  )
}

function ManageExams({
  exams,
  setExams,
  modules,
}: {
  exams: Exam[]
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>
  modules: [string, string][]
}) {
  const [form, setForm] = useState({
    moduleCode: "",
    moduleName: "",
    type: "midterm" as ExamType,
    date: "",
    start: "09:00",
    end: "11:00",
    room: "",
    maxMarks: 50,
  })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!form.moduleCode || !form.moduleName || !form.date || !form.room) {
      setError("Course code, course name, date and room are required.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: `${TYPE_LABEL[form.type]} Examination`,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d?.error ?? "Could not create the exam.")
        return
      }
      if (d?.exam) setExams((prev) => [...prev, d.exam])
      setForm((f) => ({ ...f, moduleCode: "", moduleName: "", date: "", room: "" }))
    } catch {
      setError("Network error while creating the exam.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/exams/${id}`, { method: "DELETE" })
      if (res.ok) setExams((prev) => prev.filter((e) => e.id !== id))
    } catch {
      // List refreshes on next visit
    }
  }

  const inputCls =
    "w-full rounded-sm border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <SectionHeading title="Schedule a new exam" />
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="exam-code" className="text-sm font-medium">Course code</label>
              <input
                id="exam-code"
                value={form.moduleCode}
                onChange={(e) => setForm((f) => ({ ...f, moduleCode: e.target.value.toUpperCase() }))}
                placeholder="CS301"
                list="exam-course-codes"
                className={inputCls}
              />
              <datalist id="exam-course-codes">
                {modules.map(([code]) => (
                  <option key={code} value={code} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="exam-name" className="text-sm font-medium">Course name</label>
              <input
                id="exam-name"
                value={form.moduleName}
                onChange={(e) => setForm((f) => ({ ...f, moduleName: e.target.value }))}
                placeholder="Data Structures"
                list="exam-course-names"
                className={inputCls}
              />
              <datalist id="exam-course-names">
                {modules.map(([code, name]) => (
                  <option key={code} value={name}>
                    {code}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="exam-type" className="text-sm font-medium">Type</label>
              <select
                id="exam-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ExamType }))}
                className={inputCls}
              >
                <option value="midterm">Mid-term</option>
                <option value="final">Final</option>
                <option value="practical">Practical</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="exam-date" className="text-sm font-medium">Date</label>
              <input id="exam-date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} placeholder="28 Jun 2026" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="exam-room" className="text-sm font-medium">Room</label>
              <input id="exam-room" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} placeholder="B-204" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="exam-start" className="text-sm font-medium">Start</label>
              <input id="exam-start" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="exam-end" className="text-sm font-medium">End</label>
              <input id="exam-end" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="exam-maxmarks" className="text-sm font-medium">Max marks</label>
              <input id="exam-maxmarks" type="number" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button
            onClick={add}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden /> {saving ? "Creating…" : "Create exam & assign seats"}
          </button>
          <p className="text-xs text-muted-foreground">
            Seats are auto-assigned to enrolled students in roll-number order.
          </p>
        </div>
      </Card>

      <Card>
        <SectionHeading title="Scheduled exams" />
        <ul className="divide-y divide-border">
          {exams.map((ex) => (
            <li key={ex.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{ex.moduleName} — {ex.title}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {ex.date} · {ex.room} · {ex.start}–{ex.end}
                </p>
              </div>
              <button
                onClick={() => remove(ex.id)}
                className="rounded-sm p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${ex.moduleCode}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
          {exams.length === 0 && (
            <li className="py-8 text-center text-sm text-muted-foreground">No exams scheduled.</li>
          )}
        </ul>
      </Card>
    </div>
  )
}
