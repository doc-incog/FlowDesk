import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDateTime } from "@/lib/datetime"

export const runtime = "nodejs"

const STATUSES = ["pending", "approved", "rejected"] as const

// PATCH /api/withdrawals/[id] — admin approves or rejects a withdrawal request.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  let body: { status?: string; decisionNote?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const status = body.status?.trim()
  if (!status || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: "Status must be pending, approved or rejected" },
      { status: 400 },
    )
  }

  const db = getDb()
  const result = db
    .prepare("UPDATE withdrawals SET status = ?, decided_at = ?, decision_note = ? WHERE id = ?")
    .run(status, localDateTime(), (body.decisionNote ?? "").trim() || null, id)
  if (result.changes === 0) {
    return NextResponse.json({ error: "Withdrawal request not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, status })
}