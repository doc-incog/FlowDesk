import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

// POST /api/admissions/programs — create a new course/program (admin only)
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: { name?: string; duration?: string; seats?: unknown; deadline?: string; fee?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const name = body.name?.trim()
  const duration = body.duration?.trim() ?? "4 years"
  const deadline = body.deadline?.trim()
  if (!name || !deadline) {
    return NextResponse.json({ error: "Course name and deadline are required" }, { status: 400 })
  }

  const seats = Number(body.seats)
  if (!Number.isFinite(seats) || seats < 1) {
    return NextResponse.json({ error: "Seats must be a positive number" }, { status: 400 })
  }

  const fee = Number(body.fee)
  if (!Number.isFinite(fee) || fee < 0) {
    return NextResponse.json({ error: "Fee must be a positive number" }, { status: 400 })
  }

  const db = getDb()
  const exists = db.prepare("SELECT id FROM programs WHERE lower(name) = lower(?)").get(name) as { id: string } | undefined
  if (exists) return NextResponse.json({ error: "A course with that name already exists" }, { status: 409 })

  const id = `P-${Date.now().toString(36).toUpperCase()}`
  db.prepare("INSERT INTO programs (id, name, duration, seats, deadline, fee) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    name,
    duration,
    seats,
    deadline,
    fee,
  )

  return NextResponse.json(
    {
      program: { id, name, duration, seats, deadline, fee },
    },
    { status: 201 },
  )
}
