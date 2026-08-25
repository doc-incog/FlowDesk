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

  // Verify user is a participant
  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100)
  const before = url.searchParams.get("before")

  let query = `
    SELECT m.id, m.sender_id, m.content, m.type, m.created_at, u.name as sender_name, u.avatar_initials
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
  `
  const args: (string | number)[] = [id]

  if (before) {
    query += " AND m.created_at < ?"
    args.push(before)
  }

  query += " ORDER BY m.created_at DESC LIMIT ?"
  args.push(limit)

  const messages = db.prepare(query).all(...args) as {
    id: string
    sender_id: string
    content: string
    type: string
    created_at: string
    sender_name: string
    avatar_initials: string
  }[]

  // Mark as read
  const now = new Date().toISOString()
  db.prepare(
    "UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?",
  ).run(now, id, user.id)

  return NextResponse.json({
    messages: messages.reverse().map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      senderName: m.sender_name,
      senderInitials: m.avatar_initials,
      content: m.content,
      type: m.type,
      createdAt: m.created_at,
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
  if (!content) {
    return NextResponse.json({ error: "Message content is required" }, { status: 400 })
  }

  const db = getDb()

  // Verify user is a participant
  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const now = new Date().toISOString()
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  db.prepare(
    "INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES (?, ?, ?, ?, 'text', ?)",
  ).run(msgId, id, user.id, content, now)

  // Update conversation timestamp
  db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, id)

  // Mark sender as having read
  db.prepare(
    "UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?",
  ).run(now, id, user.id)

  return NextResponse.json({
    message: {
      id: msgId,
      senderId: user.id,
      senderName: user.name,
      senderInitials: user.avatarInitials,
      content,
      type: "text",
      createdAt: now,
    },
  }, { status: 201 })
}
