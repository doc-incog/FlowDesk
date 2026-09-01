import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDateTime } from "@/lib/datetime"

export const runtime = "nodejs"

type WithdrawalRow = {
  id: string
  student_id: string
  student_name: string
  reason: string
  status: "pending" | "approved" | "rejected"
  submitted_at: string
  decided_at: string | null
  decision_note: string | null
}

// GET /api/withdrawals — students see their own requests, admins see all.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const rows = (
    user.role === "admin"
      ? db
          .prepare("SELECT * FROM withdrawals ORDER BY submitted_at DESC")
          .all()
      : db
          .prepare("SELECT * FROM withdrawals WHERE student_id = ? ORDER BY submitted_at DESC")
          .all(user.id)
  ) as unknown as WithdrawalRow[]

  return NextResponse.json({
    withdrawals: rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      reason: r.reason,
      status: r.status,
      submittedAt: r.submitted_at,
      decidedAt: r.decided_at,
      decisionNote: r.decision_note,
    })),
  })
}

// POST /api/withdrawals — a student requests to withdraw from the programme.
// Only one request may be pending at a time.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const reason = (body.reason ?? "").trim()
  if (!reason) return NextResponse.json({ error: "Please explain your reason for withdrawing" }, { status: 400 })

  const db = getDb()
  const pending = db
    .prepare("SELECT id FROM withdrawals WHERE student_id = ? AND status = 'pending'")
    .get(user.id) as { id: string } | undefined
  if (pending) {
    return NextResponse.json(
      { error: "You already have a pending withdrawal request. Wait for the admin to review it." },
      { status: 409 },
    )
  }

  const id = `wd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const submittedAt = localDateTime()
  db.prepare(
    `INSERT INTO withdrawals (id, student_id, student_name, reason, status, submitted_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(id, user.id, user.name, reason, submittedAt)

  return NextResponse.json(
    {
      ok: true,
      withdrawal: {
        id,
        studentId: user.id,
        studentName: user.name,
        reason,
        status: "pending",
        submittedAt,
        decidedAt: null,
        decisionNote: null,
      },
    },
    { status: 201 },
  )
}