import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const db = getDb()

  // Verify user is a participant
  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rows = db
    .prepare(`
      SELECT m.id, m.sender_id, u.name as sender_name, u.avatar_initials as sender_initials, u.is_deleted as sender_deleted, m.content, m.type, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `)
    .all(id) as {
    id: string
    sender_id: string
    sender_name: string
    sender_initials: string
    sender_deleted: number
    content: string
    type: string
    created_at: string
  }[]

  // Mark conversation as read for this user
  const now = new Date().toISOString()
  db.prepare(
    "UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?",
  ).run(now, id, user.id)

  return NextResponse.json({
    messages: rows.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: r.sender_deleted === 1 ? "Unknown User" : r.sender_name,
      senderInitials: r.sender_deleted === 1 ? "?" : r.sender_initials,
      senderDeleted: r.sender_deleted === 1,
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
  const db = getDb()

  // Verify user is a participant
  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { content?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const content = body.content?.trim()
  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 })
  }

  const now = new Date().toISOString()
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  db.prepare(
    "INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, 'text', ?)",
  ).run(msgId, id, user.id, content, now)

  // Update conversation timestamp
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, id)

  // Update sender's last_read_at so their own message doesn't count as unread
  db.prepare(
    "UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?",
  ).run(now, id, user.id)

  return NextResponse.json(
    {
      message: {
        id: msgId,
        senderId: user.id,
        senderName: user.name,
        senderInitials: user.avatarInitials,
        content,
        type: "text",
        createdAt: now,
      },
    },
    { status: 201 },
  )
}
