import { NextResponse } from "next/server"
import { lookupByFingerId, heartbeatDevice, requireDeviceAuth } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** GET — Look up which user owns a given finger_id on a device.
 *  Auth: Bearer token (device_secret)
 *  Query: ?deviceId=ESP-XXXXXXXX&fingerId=1
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fingerId = parseInt(searchParams.get("fingerId") ?? "", 10)

  // Try device auth first
  let deviceId = await requireDeviceAuth(request)
  if (!deviceId) deviceId = searchParams.get("deviceId")

  if (!deviceId || isNaN(fingerId)) {
    return NextResponse.json({ error: "deviceId and fingerId are required" }, { status: 400 })
  }

  heartbeatDevice(deviceId)

  const result = lookupByFingerId(deviceId, fingerId)
  if (!result) {
    return NextResponse.json({ found: false, userId: null, name: null })
  }

  return NextResponse.json({ found: true, userId: result.userId, name: result.name })
}
