import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()

  const programs = db
    .prepare("SELECT id, name, duration, seats, deadline, fee FROM programs ORDER BY name")
    .all() as {
    id: string
    name: string
    duration: string
    seats: number
    deadline: string
    fee: number
  }[]

  const applications = db
    .prepare(
      "SELECT id, applicant_name, email, program_id, program_name, score, docs, status, submitted_at, notes FROM admission_applications ORDER BY submitted_at DESC",
    )
    .all() as {
    id: string
    applicant_name: string
    email: string
    program_id: string
    program_name: string
    score: number
    docs: string
    status: "submitted" | "reviewing" | "accepted" | "rejected"
    submitted_at: string
    notes: string
  }[]

  return NextResponse.json({
    programs: programs.map((p) => ({ id: p.id, name: p.name, duration: p.duration, seats: p.seats, deadline: p.deadline, fee: p.fee })),
    applications: applications.map((a) => ({
      id: a.id,
      applicantName: a.applicant_name,
      email: a.email,
      programId: a.program_id,
      programName: a.program_name,
      score: a.score,
      docs: a.docs,
      status: a.status,
      submittedAt: a.submitted_at,
      notes: a.notes,
    })),
  })
}

/** Public submission from the /apply form. */
export async function POST(request: Request) {
  let body: { applicantName?: string; email?: string; programId?: string; score?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const applicantName = body.applicantName?.trim()
  const email = body.email?.trim()
  const programId = body.programId?.trim()
  if (!applicantName || !email || !programId) {
    return NextResponse.json({ error: "applicantName, email and programId are required" }, { status: 400 })
  }

  let score = 0
  if (body.score !== undefined) {
    score = Number(body.score)
    if (!Number.isFinite(score)) {
      return NextResponse.json({ error: "score must be a number" }, { status: 400 })
    }
  }

  const db = getDb()
  const program = db
    .prepare("SELECT id, name FROM programs WHERE id = ?")
    .get(programId) as { id: string; name: string } | undefined
  if (!program) return NextResponse.json({ error: "Unknown program" }, { status: 400 })

  const id = `aa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const submittedAt = new Date().toISOString()

  db.prepare(
    `INSERT INTO admission_applications (id, applicant_name, email, program_id, program_name, score, docs, status, submitted_at, notes)
     VALUES (?, ?, ?, ?, ?, ?, '', 'submitted', ?, '')`,
  ).run(id, applicantName, email, programId, program.name, score, submittedAt)

  return NextResponse.json({
    ok: true,
    application: {
      id,
      applicantName,
      email,
      programId,
      programName: program.name,
      score,
      docs: [],
      status: "submitted",
      submittedAt,
      notes: "",
    },
  })
}
