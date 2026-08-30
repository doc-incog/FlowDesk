import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const rows = db
    .prepare(`
      SELECT c.id, c.type, c.title, c.created_at, c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sender_id,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND created_at > COALESCE(cp.last_read_at, '')) as unread_count
      FROM conversations c
      JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE cp.user_id = ? AND cp.is_hidden = 0
      ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC
    `)
    .all(user.id) as {
    id: string
    type: string
    title: string | null
    created_at: string
    updated_at: string
    last_message: string | null
    last_sender_id: string | null
    last_message_at: string | null
    unread_count: number
  }[]

  // Fetch participants for each conversation
  const conversations = rows.map((r) => {
    const participants = db
      .prepare(`
        SELECT u.id, u.name, u.avatar_initials, u.role, u.is_deleted
        FROM conversation_participants cp
        JOIN users u ON u.id = cp.user_id
        WHERE cp.conversation_id = ?
      `)
      .all(r.id) as { id: string; name: string; avatar_initials: string; role: string; is_deleted: number }[]

    return {
      id: r.id,
      type: r.type,
      title: r.title ?? participants.map((p) => p.name).join(", "),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastMessage: r.last_message,
      lastSenderId: r.last_sender_id,
      lastMessageAt: r.last_message_at,
      unreadCount: r.unread_count,
      participants: participants.map((p) => ({
        id: p.id,
        name: p.is_deleted === 1 ? "Unknown User" : p.name,
        avatarInitials: p.is_deleted === 1 ? "?" : p.avatar_initials,
        role: p.role,
        deleted: p.is_deleted === 1,
      })),
    }
  })

  return NextResponse.json({ conversations })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  let body: { participantIds?: string[]; title?: string; type?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const participantIds = body.participantIds ?? []
  if (participantIds.length === 0) {
    return NextResponse.json({ error: "At least one participant is required" }, { status: 400 })
  }

  // Reject deleted users — they can't be messaged.
  const invalid: string[] = []
  for (const pid of new Set(participantIds)) {
    if (pid === user.id) continue
    const p = db.prepare("SELECT id FROM users WHERE id = ? AND is_deleted = 0").get(pid) as { id: string } | undefined
    if (!p) invalid.push(pid)
  }
  if (invalid.length > 0) {
    return NextResponse.json({ error: "One or more selected users are no longer available" }, { status: 400 })
  }

  // For direct chats, check if one already exists between these two users
  if (participantIds.length === 1) {
    const otherId = participantIds[0]
    const existing = db
      .prepare(`
        SELECT c.id FROM conversations c
        WHERE c.type = 'direct'
        AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = ?)
        AND EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = c.id AND user_id = ?)
      `)
      .get(user.id, otherId) as { id: string } | undefined

    if (existing) {
      // Unhide the conversation for both participants so it reappears in their sidebar
      db.prepare(
        "UPDATE conversation_participants SET is_hidden = 0 WHERE conversation_id = ?",
      ).run(existing.id)
      return NextResponse.json({ conversationId: existing.id })
    }
  }

  const now = new Date().toISOString()
  const convId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  db.prepare(
    "INSERT INTO conversations (id, type, title, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(convId, body.type ?? "direct", body.title ?? null, user.id, now, now)

  // Add creator
  db.prepare(
    "INSERT INTO conversation_participants (conversation_id, user_id, joined_at) VALUES (?, ?, ?)",
  ).run(convId, user.id, now)

  // Add other participants
  for (const pid of participantIds) {
    if (pid !== user.id) {
      db.prepare(
        "INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id, joined_at) VALUES (?, ?, ?)",
      ).run(convId, pid, now)
    }
  }

  return NextResponse.json({ conversationId: convId }, { status: 201 })
}
