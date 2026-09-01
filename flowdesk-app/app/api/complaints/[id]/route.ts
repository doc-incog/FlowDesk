import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  let body: { comment?: string; status?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const db = getDb()
  const row = db
    .prepare("SELECT id, comments, status, raised_by_id FROM complaints WHERE id = ?")
    .get(id) as { id: string; comments: string; status: string; raised_by_id: string | null } | undefined
  if (!row) return NextResponse.json({ error: "Complaint not found" }, { status: 404 })

  // Students can only update their own complaints; staff/admin can update any
  if (user.role === "student" && row.raised_by_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (body.comment) {
    const comments = JSON.parse(row.comments) as string[]
    comments.push(`${user.name}: ${body.comment}`)
    db.prepare("UPDATE complaints SET comments = ? WHERE id = ?").run(JSON.stringify(comments), id)
  }

  if (body.status) {
    const validStatuses = ["open", "in-progress", "resolved"]
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    db.prepare("UPDATE complaints SET status = ? WHERE id = ?").run(body.status, id)
  }

  const updated = db
    .prepare("SELECT id, category, subject, description, status, created_at, raised_by_name, raised_by_role, comments FROM complaints WHERE id = ?")
    .get(id) as {
    id: string
    category: string
    subject: string
    description: string
    status: string
    created_at: string
    raised_by_name: string
    raised_by_role: string
    comments: string
  }

  return NextResponse.json({
    complaint: {
      id: updated.id,
      category: updated.category,
      subject: updated.subject,
      description: updated.description,
      status: updated.status,
      createdAt: updated.created_at,
      raisedByName: updated.raised_by_name,
      raisedByRole: updated.raised_by_role,
      comments: JSON.parse(updated.comments),
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const db = getDb()

  const row = db
    .prepare("SELECT id, raised_by_id FROM complaints WHERE id = ?")
    .get(id) as { id: string; raised_by_id: string | null } | undefined
  if (!row) return NextResponse.json({ error: "Complaint not found" }, { status: 404 })

  // Only admin or the person who raised it can delete
  if (user.role !== "admin" && row.raised_by_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  db.prepare("DELETE FROM complaints WHERE id = ?").run(id)
  return NextResponse.json({ ok: true })
}
