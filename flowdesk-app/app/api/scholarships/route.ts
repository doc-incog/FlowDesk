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

  const appRows = (
    user.role === "admin"
      ? db
          .prepare(
            "SELECT id, scholarship_id, student_id, student_name, status, submitted_at, docs FROM scholarship_applications ORDER BY submitted_at",
          )
          .all()
      : db
          .prepare(
            "SELECT id, scholarship_id, student_id, student_name, status, submitted_at, docs FROM scholarship_applications WHERE student_id = ?",
          )
          .all(user.id)
  ) as {
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

/** Creates a new scholarship (admin only) so students can apply to it. */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
  const name = str(body.name)
  const provider = str(body.provider)
  const eligibility = str(body.eligibility)
  const deadline = str(body.deadline)
  const description = str(body.description)

  const amount = Number(body.amount)
  const seats = Number(body.seats)

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (!deadline) return NextResponse.json({ error: "Deadline is required" }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "A valid amount is required" }, { status: 400 })
  }
  if (!Number.isFinite(seats) || seats < 1) {
    return NextResponse.json({ error: "Seats must be at least 1" }, { status: 400 })
  }

  const db = getDb()
  const id = `sch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  db.prepare(
    `INSERT INTO scholarships (id, name, provider, amount, eligibility, seats, deadline, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name, provider, amount, eligibility, seats, deadline, description)

  return NextResponse.json(
    {
      ok: true,
      scholarship: { id, name, provider, amount, eligibility, seats, deadline, description },
    },
    { status: 201 },
  )
}
