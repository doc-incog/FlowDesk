import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = getDb()
    .prepare(
      `SELECT id, title, body, time, category, unread
       FROM notifications
       WHERE (user_id IS NULL AND (target_role IS NULL OR target_role = ?)) OR user_id = ?
       ORDER BY CASE category WHEN 'alert' THEN 0 WHEN 'academic' THEN 1 WHEN 'event' THEN 2 ELSE 3 END, time`,
    )
    .all(user.role, user.id) as { id: string; title: string; body: string; time: string; category: string; unread: number }[]

  return NextResponse.json({
    notifications: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      time: n.time,
      category: n.category,
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
    // No JSON body — mark all as read (legacy behavior)
    db.prepare("UPDATE notifications SET unread = 0 WHERE user_id IS NULL OR user_id = ?").run(user.id)
    return NextResponse.json({ ok: true })
  }

  // Mark a single notification as read
  if (body.id) {
    db.prepare("UPDATE notifications SET unread = 0 WHERE id = ? AND (user_id IS NULL OR user_id = ?)").run(
      body.id,
      user.id,
    )
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

    const time = "Just now"
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    if (target === "all") {
      // Broadcast to everyone
      db.prepare(
        "INSERT INTO notifications (id, title, body, time, category, unread, user_id, target_role) VALUES (?, ?, ?, ?, ?, 1, NULL, NULL)",
      ).run(id, title, notifBody, time, category)
    } else if (target === "staff" || target === "students") {
      // Role-targeted broadcast: one shared row filtered by role on read.
      const roleKey = target === "staff" ? "staff" : "student"
      db.prepare(
        "INSERT INTO notifications (id, title, body, time, category, unread, user_id, target_role) VALUES (?, ?, ?, ?, ?, 1, NULL, ?)",
      ).run(id, title, notifBody, time, category, roleKey)
    }

    return NextResponse.json({ ok: true, id })
  }

  // Default: mark all as read
  db.prepare("UPDATE notifications SET unread = 0 WHERE user_id IS NULL OR user_id = ?").run(user.id)
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
