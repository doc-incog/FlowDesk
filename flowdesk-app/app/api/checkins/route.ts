import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb, findUserById, mapUser } from "@/lib/db"
import { clockTime, localDate, localDateTime } from "@/lib/datetime"
import { statusFor } from "@/lib/attendance"
import { matchTemplate, lookupByFingerId, heartbeatDevice } from "@/lib/fingerprint"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") ?? localDate()
  const db = getDb()

  // For staff, find mentee IDs so we can filter to only their students.
  let menteeIds: string[] | null = null
  if (user.role === "staff") {
    const mentorRow = db
      .prepare("SELECT id FROM mentors WHERE name = ?")
      .get(user.name) as { id: string } | undefined
    if (mentorRow) {
      const menteeRows = db
        .prepare("SELECT id FROM users WHERE mentor_id = ? AND is_deleted = 0")
        .all(mentorRow.id) as { id: string }[]
      menteeIds = menteeRows.map((r) => r.id)
    }
  }

  let query = `SELECT id, user_id, name, role, time, status, method, source
       FROM check_ins WHERE substr(created_at, 1, 10) = ?`
  const params: (string | number)[] = [date]

  if (user.role === "student") {
    query += ` AND user_id = ?`
    params.push(user.id)
  } else if (user.role === "staff" && menteeIds && menteeIds.length > 0) {
    const placeholders = menteeIds.map(() => "?").join(",")
    query += ` AND user_id IN (${placeholders})`
    params.push(...menteeIds)
  }
  // Admin sees all records (no extra filter)

  query += ` ORDER BY created_at DESC`

  const rows = db.prepare(query).all(...params) as {
    id: string
    user_id: string
    name: string
    role: string
    time: string
    status: string
    method: string
    source: string
  }[]

  const filtered = rows

  const records = filtered.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    role: r.role,
    time: r.time,
    status: r.status,
    method: r.method,
    source: r.source,
  }))

  return NextResponse.json({ date, records })
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { method?: string; deviceId?: string; source?: "web" | "device"; studentId?: string; fingerId?: number; fingerprintTemplate?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const db = getDb()

  // Web check-ins are attributed to the session user. Device posts (the future
  // ESP32 flow) identify the student explicitly via studentId, fingerprint
  // template matching, or finger_id lookup.
  let target = sessionUser
  if (body.source === "device") {
    const deviceId = body.deviceId?.trim()
    if (deviceId) heartbeatDevice(deviceId)

    let studentId = body.studentId?.trim()

    // If no studentId provided but a fingerprint template is sent, match it server-side
    if (!studentId && body.fingerprintTemplate && deviceId) {
      const templateBuf = Buffer.from(body.fingerprintTemplate, "base64")
      const match = matchTemplate(templateBuf, deviceId)
      if (match) studentId = match.userId
    }

    // If still no studentId but a fingerId is sent, look up the user mapping
    if (!studentId && body.fingerId != null && deviceId) {
      const lookup = lookupByFingerId(deviceId, body.fingerId)
      if (lookup) studentId = lookup.userId
    }

    if (!studentId) {
      return NextResponse.json({ error: "Unable to identify student. Provide studentId, fingerId, or fingerprintTemplate." }, { status: 400 })
    }

    const row = findUserById(studentId)
    if (!row) return NextResponse.json({ error: "Unknown student" }, { status: 404 })
    target = mapUser(row)
  }

  const method = body.method ?? (body.source === "device" ? "device" : "biometric")
  const deviceId = body.deviceId?.trim() || null

  const today = localDate()
  const existing = db
    .prepare(
      "SELECT * FROM check_ins WHERE user_id = ? AND substr(created_at, 1, 10) = ?",
    )
    .get(target.id, today) as
    | { id: string; time: string; status: string; method: string; device_id: string | null; source: string }
    | undefined

  if (existing) {
    return NextResponse.json({
      record: {
        id: existing.id,
        name: target.name,
        role: target.role,
        time: existing.time,
        status: existing.status,
        method: existing.method,
        deviceId: existing.device_id,
        source: existing.source,
      },
      alreadyCheckedIn: true,
    })
  }

  const time = clockTime()
  const status = statusFor(time)
  const id = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  db.prepare(
    `INSERT INTO check_ins (id, user_id, name, role, time, status, method, device_id, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, target.id, target.name, target.role, time, status, method, deviceId, body.source ?? "web", localDateTime())

  return NextResponse.json({
    record: {
      id,
      name: target.name,
      role: target.role,
      time,
      status,
      method,
      deviceId,
      source: body.source ?? "web",
    },
    alreadyCheckedIn: false,
  })
}
