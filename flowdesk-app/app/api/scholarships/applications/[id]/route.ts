import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

const STATUSES = ["submitted", "under-review", "approved", "rejected", "withdrawn"] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  let body: { status?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const status = body.status?.trim()
  if (!status || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: "Status must be submitted, under-review, approved, rejected or withdrawn" },
      { status: 400 },
    )
  }

  const db = getDb()

  // Admins may change status to anything.
  if (user.role === "admin") {
    const result = db
      .prepare("UPDATE scholarship_applications SET status = ? WHERE id = ?")
      .run(status, id)
    if (result.changes === 0) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    return NextResponse.json({ ok: true, status })
  }

  // Students may only withdraw their own pending application.
  if (status !== "withdrawn") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const app = db
    .prepare("SELECT id, student_id, status FROM scholarship_applications WHERE id = ?")
    .get(id) as { id: string; student_id: string; status: string } | undefined
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  if (app.student_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (app.status !== "submitted" && app.status !== "under-review") {
    return NextResponse.json({ error: "Only a pending application can be withdrawn" }, { status: 400 })
  }

  db.prepare("UPDATE scholarship_applications SET status = 'withdrawn' WHERE id = ?").run(id)
  return NextResponse.json({ ok: true, status: "withdrawn" })
}
