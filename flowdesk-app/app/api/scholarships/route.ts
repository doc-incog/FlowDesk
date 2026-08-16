import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const scholarshipRows = db
    .prepare("SELECT id, name, provider, amount, eligibility, seats, deadline, description FROM scholarships ORDER BY deadline")
    .all() as {
    id: string
    name: string
    provider: string
    amount: number
    eligibility: string
    seats: number
    deadline: string
    description: string
  }[]

  const appRows = db
    .prepare(
      "SELECT id, scholarship_id, student_id, student_name, status, submitted_at, docs FROM scholarship_applications WHERE student_id = ?",
    )
    .all(user.id) as {
    id: string
    scholarship_id: string
    student_id: string
    student_name: string
    status: "submitted" | "under-review" | "approved" | "rejected"
    submitted_at: string
    docs: string
  }[]

  return NextResponse.json({
    scholarships: scholarshipRows.map((s) => ({
      id: s.id,
      name: s.name,
      provider: s.provider,
      amount: s.amount,
      eligibility: s.eligibility,
      seats: s.seats,
      deadline: s.deadline,
      description: s.description,
    })),
    applications: appRows.map((a) => ({
      id: a.id,
      scholarshipId: a.scholarship_id,
      studentId: a.student_id,
      studentName: a.student_name,
      status: a.status,
      submittedAt: a.submitted_at,
      docs: a.docs,
    })),
  })
}
