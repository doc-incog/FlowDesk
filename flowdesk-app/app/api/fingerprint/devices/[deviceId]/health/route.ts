import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { recordDeviceHealth, requireDeviceAuth } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** GET — Get recent health records for a device (admin only). */
export async function GET(_request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { deviceId } = await params
  const db = getDb()
  const health = db
    .prepare(
      `SELECT sensor_connected, sensor_capacity, free_memory, wifi_rssi, uptime_seconds, recorded_at
       FROM fingerprint_device_health WHERE device_id = ?
       ORDER BY recorded_at DESC LIMIT 50`,
    )
    .all(deviceId)

  return NextResponse.json({ health })
}

/** POST — ESP reports health data. */
export async function POST(request: Request, { params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId: paramDeviceId } = await params

  // Try device auth
  let deviceId = await requireDeviceAuth(request)
  if (!deviceId) deviceId = paramDeviceId

  let body: {
    sensorConnected?: boolean
    sensorCapacity?: number
    freeMemory?: number
    wifiRssi?: number
    uptimeSeconds?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  recordDeviceHealth(deviceId, {
    sensorConnected: body.sensorConnected ?? false,
    sensorCapacity: body.sensorCapacity,
    freeMemory: body.freeMemory,
    wifiRssi: body.wifiRssi,
    uptimeSeconds: body.uptimeSeconds,
  })

  return NextResponse.json({ ok: true })
}
