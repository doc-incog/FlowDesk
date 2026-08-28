import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { getMaxSlots } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** GET — Get detailed info for a single device. */
export async function GET(_request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { deviceId } = await params
  const db = getDb()
  const device = db
    .prepare(
      `SELECT device_id, label, location, sensor_type, status, device_secret, last_seen, enrolled_count, slots_total, created_at
       FROM fingerprint_devices WHERE device_id = ?`,
    )
    .get(deviceId) as Record<string, unknown> | undefined

  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

  // Get recent health records
  const health = db
    .prepare(
      `SELECT sensor_connected, sensor_capacity, free_memory, wifi_rssi, uptime_seconds, recorded_at
       FROM fingerprint_device_health WHERE device_id = ?
       ORDER BY recorded_at DESC LIMIT 10`,
    )
    .all(deviceId)

  // Get enrolled fingerprints
  const enrollments = db
    .prepare(
      `SELECT ft.id, ft.finger_id, ft.user_id, u.name, ft.enrolled_by, ft.enrolled_at
       FROM fingerprint_templates ft
       JOIN users u ON u.id = ft.user_id
       WHERE ft.device_id = ?
       ORDER BY ft.finger_id`,
    )
    .all(deviceId)

  return NextResponse.json({ device, health, enrollments })
}

/** PATCH — Update device info. */
export async function PATCH(request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { deviceId } = await params
  let body: { label?: string; location?: string; sensorType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const db = getDb()
  const existing = db.prepare("SELECT device_id FROM fingerprint_devices WHERE device_id = ?").get(deviceId)
  if (!existing) return NextResponse.json({ error: "Device not found" }, { status: 404 })

  const updates: string[] = []
  const params_: (string | number)[] = []
  if (body.label !== undefined) { updates.push("label = ?"); params_.push(body.label) }
  if (body.location !== undefined) { updates.push("location = ?"); params_.push(body.location) }
  if (body.sensorType !== undefined) {
    updates.push("sensor_type = ?")
    params_.push(body.sensorType)
    updates.push("slots_total = ?")
    params_.push(getMaxSlots(body.sensorType))
  }

  if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })

  params_.push(deviceId)
  db.prepare(`UPDATE fingerprint_devices SET ${updates.join(", ")} WHERE device_id = ?`).run(...params_)

  return NextResponse.json({ ok: true })
}

/** DELETE — Remove a single device. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { deviceId } = await params
  const db = getDb()
  const existing = db.prepare("SELECT device_id FROM fingerprint_devices WHERE device_id = ?").get(deviceId)
  if (!existing) return NextResponse.json({ error: "Device not found" }, { status: 404 })

  const enrolled = (db.prepare("SELECT COUNT(*) AS n FROM fingerprint_templates WHERE device_id = ?").get(deviceId) as { n: number }).n
  if (enrolled > 0) {
    return NextResponse.json({ error: `Cannot delete device with ${enrolled} enrolled fingerprint(s). Remove enrollments first.` }, { status: 409 })
  }

  db.prepare("DELETE FROM fingerprint_devices WHERE device_id = ?").run(deviceId)
  return NextResponse.json({ ok: true })
}
