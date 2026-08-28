import { NextResponse } from "next/server"
import { getNextCommand, heartbeatDevice, requireDeviceAuth } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** GET — ESP8266 polls this to get the next pending command.
 *  Auth: Bearer token (device_secret)
 *  Query: ?deviceId=ESP-XXXXXXXX
 */
export async function GET(request: Request) {
  const deviceId = await requireDeviceAuth(request)
  if (!deviceId) {
    // Fall back to query param for backward compat
    const { searchParams } = new URL(request.url)
    const qDeviceId = searchParams.get("deviceId")
    if (!qDeviceId) return NextResponse.json({ error: "deviceId is required" }, { status: 400 })
    heartbeatDevice(qDeviceId)
    const cmd = getNextCommand(qDeviceId)
    return NextResponse.json(cmd ?? { command: null })
  }

  heartbeatDevice(deviceId)

  const cmd = getNextCommand(deviceId)
  if (!cmd) {
    return NextResponse.json({ command: null })
  }

  return NextResponse.json(cmd)
}
