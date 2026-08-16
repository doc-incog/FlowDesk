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
