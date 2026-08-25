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
  let body: { status?: string; comment?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const db = getDb()
  const complaint = db
    .prepare("SELECT id, status, comments, raised_by_id FROM complaints WHERE id = ?")
    .get(id) as
    | { id: string; status: string; comments: string; raised_by_id: string }
    | undefined

  if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 })

  // Students can only update their own complaints
  if (user.role === "student" && complaint.raised_by_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updates: string[] = []
  const values: (string | number)[] = []

  if (body.status && ["open", "in-progress", "resolved"].includes(body.status)) {
    updates.push("status = ?")
    values.push(body.status)
  }

  if (body.comment?.trim()) {
    const comments = JSON.parse(complaint.comments) as string[]
    comments.push(`${user.name}: ${body.comment.trim()}`)
    updates.push("comments = ?")
    values.push(JSON.stringify(comments))
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No valid updates provided" }, { status: 400 })
  }

  values.push(id)
  db.prepare(`UPDATE complaints SET ${updates.join(", ")} WHERE id = ?`).run(...values)

  // Re-fetch the updated complaint
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
      comments: JSON.parse(updated.comments) as string[],
    },
  })
}
