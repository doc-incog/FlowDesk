export type Assignment = {
  id: string
  moduleCode: string
  moduleName: string
  title: string
  description: string
  assignedDate: string
  dueDate: string // ISO yyyy-mm-dd
  maxMarks: number
}

export type Submission = {
  id: string
  assignmentId: string
  studentId: string
  studentName: string
  submittedAt: string
  fileName: string
  marks: number | null
  feedback: string
}

export const ASSIGNMENTS: Assignment[] = [
  {
    id: "A1",
    moduleCode: "CS301",
    moduleName: "Data Structures",
    title: "Balanced BST implementation",
    description: "Implement an AVL tree with insert, delete and rotations. Write a short report on complexity.",
    assignedDate: "05 Aug 2026",
    dueDate: "2026-08-22",
    maxMarks: 20,
  },
  {
    id: "A2",
    moduleCode: "CS304",
    moduleName: "Database Systems",
    title: "ER model for the campus library",
    description: "Design an ER model covering books, members, loans and fines. Include cardinality constraints.",
    assignedDate: "06 Aug 2026",
    dueDate: "2026-08-27",
    maxMarks: 15,
  },
  {
    id: "A3",
    moduleCode: "CS302",
    moduleName: "Operating Systems",
    title: "CPU scheduling simulator",
    description: "Simulate Round Robin and SRTF scheduling. Report average turnaround and waiting time.",
    assignedDate: "10 Aug 2026",
    dueDate: "2026-09-05",
    maxMarks: 25,
  },
  {
    id: "A4",
    moduleCode: "CS305",
    moduleName: "Computer Networks",
    title: "Subnetting worksheet",
    description: "Solve the given VLSM worksheet and submit the completed sheet.",
    assignedDate: "02 Aug 2026",
    dueDate: "2026-08-10",
    maxMarks: 10,
  },
]

export const SUBMISSIONS: Submission[] = [
  { id: "S1", assignmentId: "A1", studentId: "STU-2044", studentName: "Dev Patel", submittedAt: "18 Aug 2026", fileName: "bst_avl.c", marks: 17, feedback: "Good work; handle duplicate keys on delete." },
  { id: "S2", assignmentId: "A1", studentId: "STU-2045", studentName: "Sara Lin", submittedAt: "20 Aug 2026", fileName: "avl.py", marks: 15, feedback: "Rotations correct, missing edge case tests." },
  { id: "S3", assignmentId: "A1", studentId: "STU-2047", studentName: "Liam Wong", submittedAt: "21 Aug 2026", fileName: "avl.cpp", marks: 18, feedback: "Clean implementation with tests." },
  { id: "S4", assignmentId: "A4", studentId: "STU-2043", studentName: "Aisha Karim", submittedAt: "09 Aug 2026", fileName: "subnetting_ws.pdf", marks: 9, feedback: "All correct." },
]

export function daysUntil(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}
