import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const db = getDb()

  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rows = db
    .prepare(
      `SELECT m.id, m.sender_id, m.content, m.type, m.created_at, u.name AS sender_name
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
    )
    .all(id) as {
    id: string
    sender_id: string
    content: string
    type: string
    created_at: string
    sender_name: string
  }[]

  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      content: r.content,
      type: r.type,
      createdAt: r.created_at,
    })),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  let body: { content?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const content = body.content?.trim()
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 })

  const db = getDb()
  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  db.prepare(
    "INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, 'text', ?)",
  ).run(msgId, id, user.id, content, now)
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, id)

  return NextResponse.json({
    ok: true,
    message: { id: msgId, senderId: user.id, senderName: user.name, content, type: "text", createdAt: now },
  })
}
