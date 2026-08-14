import { STUDENTS } from "@/lib/mock-data"

export type ExamType = "midterm" | "final" | "practical"

export type Exam = {
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
}

export type ResultRow = {
  id: string
  examId: string
  studentId: string
  marks: number
  maxMarks: number
}

export const EXAMINATIONS: Exam[] = [
  { id: "E1", title: "Mid-term Examination", moduleCode: "CS301", moduleName: "Data Structures", type: "midterm", date: "10 Mar 2026", start: "09:00", end: "11:00", room: "B-204", maxMarks: 50 },
  { id: "E2", title: "Mid-term Examination", moduleCode: "CS304", moduleName: "Database Systems", type: "midterm", date: "12 Mar 2026", start: "11:00", end: "13:00", room: "B-210", maxMarks: 50 },
  { id: "E3", title: "Mid-term Examination", moduleCode: "CS302", moduleName: "Operating Systems", type: "midterm", date: "14 Mar 2026", start: "09:00", end: "11:00", room: "A-101", maxMarks: 50 },
  { id: "E4", title: "Final Examination", moduleCode: "CS301", moduleName: "Data Structures", type: "final", date: "28 May 2026", start: "09:00", end: "12:00", room: "B-204", maxMarks: 100 },
  { id: "E5", title: "Practical Examination", moduleCode: "CS305", moduleName: "Computer Networks", type: "practical", date: "05 Jun 2026", start: "14:00", end: "16:00", room: "Lab-2", maxMarks: 30 },
]

const r = (id: string, examId: string, studentId: string, marks: number, max: number): ResultRow => ({
  id,
  examId,
  studentId,
  marks,
  maxMarks: max,
})

export const RESULTS: ResultRow[] = [
  r("E1-STU-2043", "E1", "STU-2043", 42, 50),
  r("E1-STU-2044", "E1", "STU-2044", 38, 50),
  r("E1-STU-2045", "E1", "STU-2045", 35, 50),
  r("E1-STU-2046", "E1", "STU-2046", 28, 50),
  r("E1-STU-2047", "E1", "STU-2047", 44, 50),
  r("E2-STU-2043", "E2", "STU-2043", 40, 50),
  r("E2-STU-2044", "E2", "STU-2044", 33, 50),
  r("E2-STU-2045", "E2", "STU-2045", 29, 50),
  r("E2-STU-2046", "E2", "STU-2046", 22, 50),
  r("E2-STU-2047", "E2", "STU-2047", 41, 50),
  r("E3-STU-2043", "E3", "STU-2043", 45, 50),
  r("E3-STU-2044", "E3", "STU-2044", 36, 50),
  r("E3-STU-2045", "E3", "STU-2045", 31, 50),
  r("E3-STU-2046", "E3", "STU-2046", 30, 50),
  r("E3-STU-2047", "E3", "STU-2047", 39, 50),
  r("E4-STU-2043", "E4", "STU-2043", 88, 100),
  r("E4-STU-2044", "E4", "STU-2044", 74, 100),
  r("E4-STU-2045", "E4", "STU-2045", 69, 100),
  r("E4-STU-2046", "E4", "STU-2046", 55, 100),
  r("E4-STU-2047", "E4", "STU-2047", 82, 100),
  r("E5-STU-2043", "E5", "STU-2043", 26, 30),
  r("E5-STU-2044", "E5", "STU-2044", 22, 30),
  r("E5-STU-2045", "E5", "STU-2045", 24, 30),
  r("E5-STU-2046", "E5", "STU-2046", 20, 30),
  r("E5-STU-2047", "E5", "STU-2047", 27, 30),
]

export function percentage(marks: number, max: number): number {
  return max > 0 ? Math.round((marks / max) * 100) : 0
}

export function gradeFor(pct: number): string {
  if (pct >= 90) return "A+"
  if (pct >= 80) return "A"
  if (pct >= 70) return "B+"
  if (pct >= 60) return "B"
  if (pct >= 50) return "C+"
  if (pct >= 40) return "C"
  return "D"
}

/**
 * Deterministic seat allocation: students are seated in enrolment order
 * (seat = index + 1) in the exam room.
 */
export function seatFor(studentId: string): number {
  const idx = STUDENTS.findIndex((s) => s.id === studentId)
  return idx >= 0 ? idx + 1 : 0
}
