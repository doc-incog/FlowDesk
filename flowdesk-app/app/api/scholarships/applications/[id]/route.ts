import { NextResponse } from "next/server"
import { existsSync, unlinkSync } from "node:fs"
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

// DELETE /api/scholarships/applications/[id] — admin removes a decided
// (approved or rejected) application, also removing any uploaded doc files.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const db = getDb()
  const row = db
    .prepare("SELECT id, status, docs FROM scholarship_applications WHERE id = ?")
    .get(id) as { id: string; status: string; docs: string } | undefined

  if (!row) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  if (row.status !== "approved" && row.status !== "rejected") {
    return NextResponse.json(
      { error: "Only an approved or rejected application can be deleted" },
      { status: 400 },
    )
  }

  let docs: { path?: string | null }[] = []
  try {
    const parsed = JSON.parse(row.docs)
    if (Array.isArray(parsed)) docs = parsed
  } catch {
    docs = []
  }
  for (const d of docs) {
    if (d.path && existsSync(d.path)) {
      try {
        unlinkSync(d.path)
      } catch {
        // Best-effort: leave orphan file if it cannot be removed
      }
    }
  }

  db.prepare("DELETE FROM scholarship_applications WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
