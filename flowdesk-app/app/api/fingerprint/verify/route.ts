import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { matchTemplate, heartbeatDevice, requireDeviceAuth } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** POST — Match an incoming fingerprint template against stored templates.
 *  Auth: Bearer token (device_secret) or session
 *  Body: { template: string (base64), deviceId: string }
 */
export async function POST(request: Request) {
  let body: { template?: string; deviceId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { template, deviceId: bodyDeviceId } = body
  if (!template || !bodyDeviceId) {
    return NextResponse.json({ error: "template and deviceId are required" }, { status: 400 })
  }

  // Try device auth first
  let deviceId = await requireDeviceAuth(request)
  if (!deviceId) deviceId = bodyDeviceId

  const templateBuf = Buffer.from(template, "base64")
  if (templateBuf.length === 0) {
    return NextResponse.json({ error: "Invalid template data" }, { status: 400 })
  }

  heartbeatDevice(deviceId)

  const result = matchTemplate(templateBuf, deviceId)

  if (!result) {
    return NextResponse.json({ matched: false, userId: null, confidence: 0 })
  }

  const db = getDb()
  const userRow = db.prepare("SELECT name FROM users WHERE id = ?").get(result.userId) as { name: string } | undefined

  return NextResponse.json({
    matched: true,
    userId: result.userId,
    userName: userRow?.name ?? "Unknown",
    fingerId: result.fingerId,
    confidence: result.confidence,
  })
}
