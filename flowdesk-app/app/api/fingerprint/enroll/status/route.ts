import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { notifyEnrollmentEvent, requireDeviceAuth } from "@/lib/fingerprint"

export const runtime = "nodejs"

/** GET — Check if a user has a fingerprint enrolled on any device.
 *  Query: ?userId=STU-0001
 */
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId") ?? user.id

  const db = getDb()
  const rows = db
    .prepare(
      `SELECT ft.id, ft.finger_id, ft.device_id, fd.label, fd.location, ft.enrolled_at
       FROM fingerprint_templates ft
       LEFT JOIN fingerprint_devices fd ON fd.device_id = ft.device_id
       WHERE ft.user_id = ?
       ORDER BY ft.enrolled_at DESC`,
    )
    .all(userId) as {
    id: string
    finger_id: number
    device_id: string
    label: string | null
    location: string | null
    enrolled_at: string
  }[]

  return NextResponse.json({
    enrolled: rows.length > 0,
    enrollments: rows.map((r) => ({
      id: r.id,
      fingerId: r.finger_id,
      deviceId: r.device_id,
      label: r.label || r.device_id,
      location: r.location || "",
      enrolledAt: r.enrolled_at,
    })),
  })
}

/** POST — ESP reports enrollment progress (pushed to SSE subscribers).
 *  Auth: Bearer token (device_secret)
 *  Body: { userId, step: "first-capture"|"second-capture"|"matched"|"stored"|"error", message?: string }
 */
export async function POST(request: Request) {
  const deviceId = await requireDeviceAuth(request)
  if (!deviceId) {
    return NextResponse.json({ error: "Device auth required" }, { status: 401 })
  }

  let body: { userId?: string; step?: string; message?: string; fingerId?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { userId, step, message, fingerId } = body
  if (!userId || !step) {
    return NextResponse.json({ error: "userId and step are required" }, { status: 400 })
  }

  const validSteps = ["first-capture", "second-capture", "matched", "stored", "error"]
  if (!validSteps.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 })
  }

  const eventType = step === "stored" ? "enrollment-complete" :
    step === "error" ? "enrollment-failed" : "enrollment-progress"

  notifyEnrollmentEvent(deviceId, {
    type: eventType as "enrollment-progress" | "enrollment-complete" | "enrollment-failed",
    userId,
    fingerId,
    step,
    message,
  })

  return NextResponse.json({ ok: true })
}
