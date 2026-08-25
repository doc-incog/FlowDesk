import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = getDb()
    .prepare("SELECT id, day, start, end, module, code, room, staff FROM schedule_slots ORDER BY day, start")
    .all() as {
    id: string
    day: string
    start: string
    end: string
    module: string
    code: string
    room: string
    staff: string
  }[]

  // Students see the full class timetable; staff only their own classes.
  const schedule =
    user.role === "staff" ? rows.filter((s) => s.staff === user.name) : rows

  return NextResponse.json({
    schedule: schedule.map((s) => ({
      id: s.id,
      day: s.day,
      start: s.start,
      end: s.end,
      module: s.module,
      code: s.code,
      room: s.room,
      staff: s.staff,
    })),
  })
}

/** Persists a new class slot (admin only). */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { day?: string; start?: string; end?: string; code?: string; module?: string; room?: string; staff?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const day = body.day?.trim()
  const start = body.start?.trim()
  const end = body.end?.trim()
  const code = body.code?.trim()
  const moduleName = body.module?.trim()
  const room = body.room?.trim()
  const staff = body.staff?.trim() ?? ""
  if (!day || !start || !end || !code || !moduleName || !room) {
    return NextResponse.json({ error: "day, start, end, code, module and room are required" }, { status: 400 })
  }

  const db = getDb()
  const clash = db
    .prepare("SELECT module FROM schedule_slots WHERE day = ? AND room = ? AND start < ? AND ? < end")
    .all(day, room, end, start) as { module: string }[]
  // An empty faculty selection must not clash against other unassigned slots.
  const staffClash = staff
    ? (db
        .prepare("SELECT module FROM schedule_slots WHERE day = ? AND staff = ? AND start < ? AND ? < end")
        .all(day, staff, end, start) as { module: string }[])
    : []
  const allClashes = [...clash, ...staffClash]
  if (allClashes.length > 0) {
    return NextResponse.json(
      { error: `Clash with ${[...new Set(allClashes.map((c) => c.module))].join(", ")} — same room or staff member.` },
      { status: 409 },
    )
  }

  const id = `s${Date.now()}`
  db.prepare("INSERT INTO schedule_slots (id, day, start, end, module, code, room, staff) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    id, day, start, end, moduleName, code, room, staff,
  )

  return NextResponse.json({
    ok: true,
    slot: { id, day, start, end, module: moduleName, code, room, staff },
  }, { status: 201 })
}
