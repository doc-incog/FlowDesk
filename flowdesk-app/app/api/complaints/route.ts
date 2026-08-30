import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDateTime } from "@/lib/datetime"

export const runtime = "nodejs"

const CATEGORIES = ["Academic", "Facilities", "IT / Portal", "Hostel", "Other"]

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  // Students see only their own complaints; staff and admin see all.
  const showAll = user.role === "admin" || user.role === "staff"
  const rows = db
    .prepare(
      `SELECT id, category, subject, description, status, created_at, raised_by_name, raised_by_role, comments
       FROM complaints
       ${showAll ? "" : "WHERE raised_by_id = ?"}
       ORDER BY created_at DESC`,
    )
    .all(...(showAll ? [] : [user.id])) as {
    id: string
    category: string
    subject: string
    description: string
    status: "open" | "in-progress" | "resolved"
    created_at: string
    raised_by_name: string
    raised_by_role: string
    comments: string
  }[]

  return NextResponse.json({
    categories: CATEGORIES,
    complaints: rows.map((c) => ({
      id: c.id,
      category: c.category,
      subject: c.subject,
      description: c.description,
      status: c.status,
      createdAt: c.created_at,
      raisedByName: c.raised_by_name,
      raisedByRole: c.raised_by_role,
      comments: JSON.parse(c.comments) as string[],
    })),
  })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { category?: string; subject?: string; description?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const category = body.category?.trim()
  const subject = body.subject?.trim()
  const description = body.description?.trim()
  if (!category || !subject || !description) {
    return NextResponse.json({ error: "category, subject and description are required" }, { status: 400 })
  }

  const db = getDb()
  const id = `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  db.prepare(
    `INSERT INTO complaints (id, category, subject, description, status, created_at, raised_by_name, raised_by_role, raised_by_id, comments)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, '[]')`,
  ).run(id, category, subject, description, localDateTime(), user.name, user.role, user.id)

  return NextResponse.json({ complaint: { id, category, subject, description, status: "open", createdAt: localDateTime(), raisedByName: user.name, raisedByRole: user.role, comments: [] } }, { status: 201 })
}
