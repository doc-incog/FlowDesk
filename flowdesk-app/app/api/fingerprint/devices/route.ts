import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { heartbeatDevice, generateDeviceSecret, getMaxSlots, requireDeviceAuth } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** GET — List all registered fingerprint devices. */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()
  const devices = db
    .prepare(
      `SELECT device_id, label, location, sensor_type, status, last_seen, enrolled_count, slots_total, created_at
       FROM fingerprint_devices
       ORDER BY
         CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'disabled' THEN 2 END,
         last_seen DESC`,
    )
    .all()

  return NextResponse.json({ devices })
}

/** POST — Register a new device, update info, or approve/disable.
 *  Admin: { deviceId, label?, location?, sensorType? } — create or update
 *  Admin: { action: "approve"|"disable", deviceId } — change status
 *  Device (no session): { deviceId, sensorType? } — auto-register (creates pending device)
 */
export async function POST(request: Request) {
  let body: { deviceId?: string; label?: string; location?: string; sensorType?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 })

  const db = getDb()
  const now = new Date().toISOString()
  const existing = db.prepare("SELECT device_id, device_secret, status FROM fingerprint_devices WHERE device_id = ?").get(body.deviceId) as {
    device_id: string
    device_secret: string | null
    status: string
  } | undefined

  // Handle approve/disable actions
  if (body.action) {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (!existing) return NextResponse.json({ error: "Device not found" }, { status: 404 })
    const validActions = ["approve", "disable"]
    if (!validActions.includes(body.action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 })

    const newStatus = body.action === "approve" ? "approved" : "disabled"
    db.prepare("UPDATE fingerprint_devices SET status = ? WHERE device_id = ?").run(newStatus, body.deviceId)
    return NextResponse.json({ ok: true, status: newStatus })
  }

  // Device auto-registration (no session = ESP device)
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    // ESP device registering itself — create as pending
    if (existing) {
      // Already registered — just heartbeat and return existing secret
      heartbeatDevice(body.deviceId, { sensorType: body.sensorType, sensorCapacity: body.sensorType ? getMaxSlots(body.sensorType) : undefined })
      return NextResponse.json({ ok: true, deviceSecret: existing.device_secret, status: existing.status })
    }

    const secret = generateDeviceSecret()
    const sensorType = body.sensorType ?? "R307"
    const slotsTotal = getMaxSlots(sensorType)
    db.prepare(
      "INSERT INTO fingerprint_devices (device_id, device_secret, sensor_type, status, last_seen, enrolled_count, slots_total, created_at) VALUES (?, ?, ?, 'pending', ?, 0, ?, ?)",
    ).run(body.deviceId, secret, sensorType, now, slotsTotal, now)
    return NextResponse.json({ ok: true, deviceSecret: secret, status: "pending" })
  }

  // Admin creating/updating device
  if (sessionUser.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (existing) {
    const updates: string[] = []
    const params: (string | number)[] = []
    if (body.label !== undefined) { updates.push("label = ?"); params.push(body.label) }
    if (body.location !== undefined) { updates.push("location = ?"); params.push(body.location) }
    if (body.sensorType !== undefined) {
      updates.push("sensor_type = ?")
      params.push(body.sensorType)
      updates.push("slots_total = ?")
      params.push(getMaxSlots(body.sensorType))
    }
    if (updates.length > 0) {
      params.push(body.deviceId)
      db.prepare(`UPDATE fingerprint_devices SET ${updates.join(", ")} WHERE device_id = ?`).run(...params)
    }
  } else {
    const sensorType = body.sensorType ?? "R307"
    const slotsTotal = getMaxSlots(sensorType)
    const secret = generateDeviceSecret()
    db.prepare(
      "INSERT INTO fingerprint_devices (device_id, device_secret, sensor_type, status, label, location, last_seen, enrolled_count, slots_total, created_at) VALUES (?, ?, ?, 'approved', ?, ?, ?, 0, ?, ?)",
    ).run(body.deviceId, secret, sensorType, body.label ?? "", body.location ?? "", now, slotsTotal, now)
    heartbeatDevice(body.deviceId)
    return NextResponse.json({ ok: true, deviceSecret: secret })
  }

  heartbeatDevice(body.deviceId)
  return NextResponse.json({ ok: true })
}

/** DELETE — Remove a device. */
export async function DELETE(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get("deviceId")
  if (!deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 })

  const db = getDb()
  const existing = db.prepare("SELECT device_id FROM fingerprint_devices WHERE device_id = ?").get(deviceId)
  if (!existing) return NextResponse.json({ error: "Device not found" }, { status: 404 })

  // Check for enrolled templates
  const enrolled = (db.prepare("SELECT COUNT(*) AS n FROM fingerprint_templates WHERE device_id = ?").get(deviceId) as { n: number }).n
  if (enrolled > 0) {
    return NextResponse.json({ error: `Cannot delete device with ${enrolled} enrolled fingerprint(s). Remove enrollments first.` }, { status: 409 })
  }

  db.prepare("DELETE FROM fingerprint_devices WHERE device_id = ?").run(deviceId)
  return NextResponse.json({ ok: true })
}
