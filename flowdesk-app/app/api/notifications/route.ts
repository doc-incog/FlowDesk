import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const rows = db
    .prepare(
      `SELECT n.id, n.title, n.body, n.time, n.category, n.created_at,
        CASE WHEN nr.user_id IS NOT NULL THEN 0 ELSE 1 END as unread
       FROM notifications n
       LEFT JOIN notification_reads nr ON nr.notification_id = n.id AND nr.user_id = ?
       WHERE (n.user_id IS NULL AND (n.target_role IS NULL OR n.target_role = ?)) OR n.user_id = ?
       ORDER BY CASE n.category WHEN 'alert' THEN 0 WHEN 'academic' THEN 1 WHEN 'event' THEN 2 ELSE 3 END, n.created_at DESC`,
    )
    .all(user.id, user.role, user.id) as {
    id: string
    title: string
    body: string
    time: string
    category: string
    created_at: string
    unread: number
  }[]

  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      time: n.time,
      category: n.category,
      createdAt: n.created_at || undefined,
      unread: n.unread === 1,
    })),
  })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  // Try to parse body — if empty or no JSON, treat as "mark all read"
  let body: { id?: string; title?: string; body?: string; category?: string; target?: string } = {}
  try {
    body = await request.json()
  } catch {
    // No JSON body — mark all as read for this user
    markAllRead(db, user.id, user.role)
    return NextResponse.json({ ok: true })
  }

  // Mark a single notification as read
  if (body.id) {
    markSingleRead(db, body.id, user.id)
    return NextResponse.json({ ok: true })
  }

  // If title is provided, this is a notification creation request (admin only)
  if (body.title) {
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Only admins can send notifications" }, { status: 403 })
    }

    const title = body.title.trim()
    const notifBody = (body.body ?? "").trim()
    const category = body.category ?? "system"
    const target = body.target ?? "all"

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const displayTime = formatRelativeTime(now)
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (target === "all") {
      db.prepare(
        "INSERT INTO notifications (id, title, body, time, category, unread, user_id, target_role, created_at) VALUES (?, ?, ?, ?, ?, 1, NULL, NULL, ?)",
      ).run(id, title, notifBody, displayTime, category, now)
    } else if (target === "staff" || target === "students") {
      const roleKey = target === "staff" ? "staff" : "student"
      db.prepare(
        "INSERT INTO notifications (id, title, body, time, category, unread, user_id, target_role, created_at) VALUES (?, ?, ?, ?, ?, 1, NULL, ?, ?)",
      ).run(id, title, notifBody, displayTime, category, roleKey, now)
    }

    return NextResponse.json({ ok: true, id })
  }

  // Default: mark all as read
  markAllRead(db, user.id, user.role)
  return NextResponse.json({ ok: true })
}

/** Deletes a notification for everyone it targets (admin only). */
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(request.url)
  const id = url.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Notification id is required" }, { status: 400 })

  const result = getDb().prepare("DELETE FROM notifications WHERE id = ?").run(id)
  if (result.changes === 0) {
    return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

function markSingleRead(db: ReturnType<typeof getDb>, notifId: string, userId: string) {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT OR IGNORE INTO notification_reads (notification_id, user_id, read_at) VALUES (?, ?, ?)`,
  ).run(notifId, userId, now)
}

function markAllRead(db: ReturnType<typeof getDb>, userId: string, role: string) {
  const now = new Date().toISOString()
  // Mark all notifications visible to this user as read
  const notifs = db
    .prepare(
      `SELECT id FROM notifications
       WHERE ((user_id IS NULL AND (target_role IS NULL OR target_role = ?)) OR user_id = ?)`,
    )
    .all(role, userId) as { id: string }[]

  const insert = db.prepare(
    "INSERT OR IGNORE INTO notification_reads (notification_id, user_id, read_at) VALUES (?, ?, ?)",
  )
  for (const n of notifs) {
    insert.run(n.id, userId, now)
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
