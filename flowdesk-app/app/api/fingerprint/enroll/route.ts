import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { nextAvailableSlot, heartbeatDevice, enqueueCommand, notifyEnrollmentEvent } from "@/lib/fingerprint"
import { localDateTime } from "@/lib/datetime"

export const runtime = "nodejs"

/** GET — List all fingerprint enrollments (admin) or enrollments for a device. */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get("deviceId")

  const db = getDb()
  let rows
  if (deviceId) {
    rows = db
      .prepare(
        `SELECT ft.id, ft.user_id, u.name AS user_name, ft.finger_id, ft.device_id, ft.enrolled_by, ft.enrolled_at
         FROM fingerprint_templates ft JOIN users u ON u.id = ft.user_id
         WHERE ft.device_id = ? ORDER BY ft.enrolled_at DESC`,
      )
      .all(deviceId)
  } else {
    rows = db
      .prepare(
        `SELECT ft.id, ft.user_id, u.name AS user_name, ft.finger_id, ft.device_id, ft.enrolled_by, ft.enrolled_at
         FROM fingerprint_templates ft JOIN users u ON u.id = ft.user_id
         ORDER BY ft.enrolled_at DESC`,
      )
      .all()
  }

  return NextResponse.json({ enrollments: rows })
}

/** POST — Store a new fingerprint enrollment (called by ESP8266 after capturing template). */
export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { userId?: string; fingerId?: number; deviceId?: string; template?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { userId, fingerId, deviceId, template } = body
  if (!userId || !deviceId) {
    return NextResponse.json({ error: "userId and deviceId are required" }, { status: 400 })
  }

  const db = getDb()

  const userRow = db.prepare("SELECT id, name FROM users WHERE id = ?").get(userId) as { id: string; name: string } | undefined
  if (!userRow) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const templateBuf = template ? Buffer.from(template, "base64") : null
  if (template && templateBuf && templateBuf.length === 0) {
    return NextResponse.json({ error: "Invalid template data" }, { status: 400 })
  }

  const resolvedFingerId = fingerId ?? nextAvailableSlot(deviceId)
  if (resolvedFingerId < 1) {
    return NextResponse.json({ error: "No available fingerprint slots on this device" }, { status: 409 })
  }

  const id = `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const now = localDateTime()

  const existing = db
    .prepare("SELECT id FROM fingerprint_templates WHERE user_id = ? AND device_id = ?")
    .get(userId, deviceId) as { id: string } | undefined

  if (existing) {
    db.prepare(
      "UPDATE fingerprint_templates SET finger_id = ?, template = ?, enrolled_by = ?, enrolled_at = ? WHERE id = ?",
    ).run(resolvedFingerId, templateBuf, sessionUser.name, now, existing.id)
    heartbeatDevice(deviceId)
    return NextResponse.json({
      id: existing.id,
      userId,
      userName: userRow.name,
      fingerId: resolvedFingerId,
      deviceId,
      enrolledAt: now,
      updated: true,
    })
  }

  db.prepare(
    "INSERT INTO fingerprint_templates (id, user_id, finger_id, device_id, template, enrolled_by, enrolled_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(id, userId, resolvedFingerId, deviceId, templateBuf, sessionUser.name, now)

  heartbeatDevice(deviceId)
  notifyEnrollmentEvent(deviceId, { type: "enrollment-complete", userId, fingerId: resolvedFingerId })

  return NextResponse.json({
    id,
    userId,
    userName: userRow.name,
    fingerId: resolvedFingerId,
    deviceId,
    enrolledAt: now,
    updated: false,
  })
}

/** DELETE — Remove an enrollment. */
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const db = getDb()
  const row = db.prepare("SELECT id, device_id, finger_id FROM fingerprint_templates WHERE id = ?").get(id) as { id: string; device_id: string; finger_id: number } | undefined
  if (!row) return NextResponse.json({ error: "Enrollment not found" }, { status: 404 })

  db.prepare("DELETE FROM fingerprint_templates WHERE id = ?").run(id)
  heartbeatDevice(row.device_id)

  // Enqueue sensor delete to free the physical slot
  enqueueCommand(row.device_id, "delete", { fingerId: row.finger_id })

  return NextResponse.json({ ok: true })
}
