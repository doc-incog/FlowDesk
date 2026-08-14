"use client"

import { useState } from "react"
import { CalendarDays, Check, Clock, Download, MapPin, Plus, Trash2, TrendingUp } from "lucide-react"
import {
  EXAMINATIONS,
  RESULTS,
  gradeFor,
  percentage,
  seatFor,
  type Exam,
  type ExamType,
  type ResultRow,
} from "@/lib/data/exams"
import { SCHEDULE, STUDENTS, type Role, type UserProfile } from "@/lib/mock-data"
import { DEMO_USERS } from "@/lib/mock-data"
import { downloadHtml } from "@/lib/download"
import { useLocalStorage } from "@/lib/storage"
import { Card, SectionHeading, StatCard } from "@/components/dashboard/primitives"
import { SectionTabs, type TabItem } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const TYPE_BADGE: Record<ExamType, string> = {
  midterm: "bg-chart-1/10 text-chart-1",
  final: "bg-chart-5/10 text-chart-5",
  practical: "bg-chart-2/15 text-chart-2",
}

const TYPE_LABEL: Record<ExamType, string> = {
  midterm: "Mid-term",
  final: "Final",
  practical: "Practical",
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
  const [exams, setExams] = useLocalStorage<Exam[]>("flowdesk.exams", EXAMINATIONS)
  const [results, setResults] = useLocalStorage<ResultRow[]>("flowdesk.results", RESULTS)
  const [tab, setTab] = useState<string>("schedule")

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Exams & Results"
        description="Exam schedules, seating plans, mark entry and auto-calculated report cards."
      />
      <SectionTabs tabs={tabsFor(role)} active={tab} onChange={setTab} />

      {tab === "schedule" && <ExamSchedule exams={exams} />}
      {tab === "seating" && <SeatingView exams={exams} />}
      {tab === "entry" && <MarkEntry exams={exams} results={results} setResults={setResults} />}
      {tab === "results" && role === "student" && <ReportCardView student={DEMO_USERS.student} exams={exams} results={results} />}
      {tab === "results" && role !== "student" && <AllResults exams={exams} results={results} />}
      {tab === "manage" && role === "admin" && <ManageExams exams={exams} setExams={setExams} />}
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
            <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", TYPE_BADGE[ex.type])}>
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
      {icon} {label}
    </p>
  )
}

function SeatingView({ exams }: { exams: Exam[] }) {
  const [examId, setExamId] = useState(exams[0]?.id ?? "")
  const exam = exams.find((e) => e.id === examId)
  const mySeat = seatFor(DEMO_USERS.student.id)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card>
        <p className="mb-3 text-sm font-semibold">Select exam</p>
        <div className="space-y-2">
          {exams.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setExamId(ex.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                examId === ex.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary",
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
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                Your seat: {mySeat}
              </span>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Room layout ({STUDENTS.length} seats)
              </p>
              <div className="grid grid-cols-5 gap-3">
                {STUDENTS.map((s, i) => {
                  const seat = i + 1
                  const mine = seat === mySeat
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-xl border p-3 text-center",
                        mine
                          ? "border-primary bg-primary/10 text-primary"
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

  const download = () => {
    const body = `
    <div class="head">
      <div>
        <h1>FlowDesk — Digital Report Card</h1>
        <p class="muted">Semester 5 · Academic Year 2025–26</p>
      </div>
      <span class="badge">${gradeFor(overall)}</span>
    </div>
    <div class="grid">
      <div><p class="muted">Student</p><b>${student.name}</b></div>
      <div><p class="muted">Roll No</p><b>${student.rollNo}</b></div>
      <div><p class="muted">Department</p><b>${student.department}</b></div>
      <div><p class="muted">Semester</p><b>${student.semester}</b></div>
    </div>
    <table>
      <thead><tr><th>Exam</th><th>Module</th><th class="right">Max</th><th class="right">Marks</th><th class="right">%</th><th class="right">Grade</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) =>
              `<tr><td>${r.exam.title}</td><td>${r.exam.moduleCode}</td><td class="right">${r.max}</td><td class="right">${r.marks}</td><td class="right">${r.pct}</td><td class="right"><span class="badge">${r.grade}</span></td></tr>`,
          )
          .join("")}
        <tr class="total"><td colspan="2">Total</td><td class="right">${totalMax}</td><td class="right">${totalMarks}</td><td class="right">${overall}%</td><td class="right">${gradeFor(overall)}</td></tr>
      </tbody>
    </table>
    <p class="note">This is a digitally generated report card from FlowDesk. Marks are auto-calculated from entered examination results.</p>`
    downloadHtml(`report-card-${student.id}.html`, "Report Card", body)
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
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{r.grade}</span>
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
                className={cn("w-full max-w-12 rounded-t-lg", r.pct >= 60 ? "bg-primary" : "bg-warning")}
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

function AllResults({ exams, results }: { exams: Exam[]; results: ResultRow[] }) {
  const [studentId, setStudentId] = useState(STUDENTS[0]?.id ?? "")
  const student = STUDENTS.find((s) => s.id === studentId) ?? STUDENTS[0]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Student:</span>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {STUDENTS.map((s) => (
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
}: {
  exams: Exam[]
  results: ResultRow[]
  setResults: React.Dispatch<React.SetStateAction<ResultRow[]>>
}) {
  const [examId, setExamId] = useState(exams[0]?.id ?? "")
  const [marks, setMarks] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState(false)
  const exam = exams.find((e) => e.id === examId)

  const selectExam = (id: string) => {
    setExamId(id)
    const map: Record<string, number> = {}
    for (const r of results) if (r.examId === id) map[r.studentId] = r.marks
    setMarks(map)
    setSaved(false)
  }

  const save = () => {
    if (!exam) return
    setResults((prev) => {
      const others = prev.filter((r) => r.examId !== examId)
      const rows: ResultRow[] = STUDENTS.map((s) => ({
        id: `${examId}-${s.id}`,
        examId,
        studentId: s.id,
        marks: marks[s.id] ?? 0,
        maxMarks: exam.maxMarks,
      }))
      return [...others, ...rows]
    })
    setSaved(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Exam:</span>
        <select
          value={examId}
          onChange={(e) => selectExam(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
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
            {STUDENTS.map((s) => {
              const m = marks[s.id] ?? 0
              const pct = exam ? percentage(m, exam.maxMarks) : 0
              return (
                <tr key={s.id}>
                  <td className="py-2.5 font-medium">{s.name}</td>
                  <td className="py-2.5 font-mono text-muted-foreground">{s.rollNo}</td>
                  <td className="py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      max={exam?.maxMarks ?? 0}
                      value={marks[s.id] ?? ""}
                      onChange={(e) => setMarks((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))}
                      className="w-24 rounded-lg border border-input bg-card px-2 py-1.5 text-right font-mono text-sm outline-none focus:border-primary"
                    />
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{gradeFor(pct)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Check className="h-4 w-4" aria-hidden /> Save marks
        </button>
        {saved && <span className="text-sm font-medium text-success">Marks saved — grades updated on report cards.</span>}
      </div>
    </div>
  )
}

function ManageExams({
  exams,
  setExams,
}: {
  exams: Exam[]
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>
}) {
  const modules = Array.from(new Map(SCHEDULE.map((s) => [s.code, s.module])).entries())
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

  const add = () => {
    if (!form.moduleName || !form.date || !form.room) {
      setError("Module, date and room are required.")
      return
    }
    setExams((prev) => [
      ...prev,
      {
        id: `E${Date.now()}`,
        title: `${TYPE_LABEL[form.type]} Examination`,
        moduleCode: form.moduleCode,
        moduleName: form.moduleName,
        type: form.type,
        date: form.date,
        start: form.start,
        end: form.end,
        room: form.room,
        maxMarks: Number(form.maxMarks) || 50,
      },
    ])
    setForm((f) => ({ ...f, moduleCode: "", moduleName: "", date: "", room: "" }))
    setError("")
  }

  const inputCls =
    "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <SectionHeading title="Schedule a new exam" />
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Module</label>
              <select
                value={form.moduleCode}
                onChange={(e) => {
                  const m = modules.find(([code]) => code === e.target.value)
                  setForm((f) => ({
                    ...f,
                    moduleCode: e.target.value,
                    moduleName: m ? m[1] : "",
                  }))
                }}
                className={inputCls}
              >
                <option value="">Select…</option>
                {modules.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} · {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <select
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
              <label className="text-sm font-medium">Date</label>
              <input value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} placeholder="28 Jun 2026" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Room</label>
              <input value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} placeholder="B-204" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start</label>
              <input value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End</label>
              <input value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Max marks</label>
              <input type="number" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={add}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden /> Create exam & assign seats
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
                onClick={() => setExams((prev) => prev.filter((e) => e.id !== ex.id))}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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
