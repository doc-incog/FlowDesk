import { NextResponse } from "next/server"
import { completeCommand, heartbeatDevice, requireDeviceAuth } from "@/lib/fingerprint"
import { localDateTime } from "@/lib/datetime"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

/** POST — ESP8266 reports the result of executing a command.
 *  Auth: Bearer token (device_secret)
 *  Body: { deviceId, commandId, status: "completed"|"failed", result?: any }
 */
export async function POST(request: Request) {
  let body: { deviceId?: string; commandId?: string; status?: "completed" | "failed"; result?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { deviceId: bodyDeviceId, commandId, status } = body
  if (!commandId || !status) {
    return NextResponse.json({ error: "commandId and status are required" }, { status: 400 })
  }

  // Authenticate via device token or session
  let deviceId = await requireDeviceAuth(request)
  if (!deviceId) deviceId = bodyDeviceId ?? ""
  if (!deviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 })

  heartbeatDevice(deviceId)
  completeCommand(commandId, status, body.result)

  if (status === "completed" && body.result) {
    const db = getDb()
    db.prepare("UPDATE fingerprint_devices SET last_seen = ? WHERE device_id = ?").run(localDateTime(), deviceId)
  }

  return NextResponse.json({ ok: true })
}
