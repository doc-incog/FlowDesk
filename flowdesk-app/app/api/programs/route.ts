import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

/** Public catalog for the admissions form (/apply). */
export async function GET() {
  const rows = getDb().prepare("SELECT id, name, duration, seats, deadline, fee FROM programs ORDER BY name").all() as {
    id: string
    name: string
    duration: string
    seats: number
    deadline: string
    fee: number
  }[]

  return NextResponse.json({
    programs: rows.map((p) => ({ id: p.id, name: p.name, duration: p.duration, seats: p.seats, deadline: p.deadline, fee: p.fee })),
  })
}
