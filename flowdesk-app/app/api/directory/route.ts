import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb, mapUser } from "@/lib/db"
import { hashPassword } from "@/lib/db/password"
import { DEFAULT_PASSWORD } from "@/lib/seed-data/core"

export const runtime = "nodejs"

function nextUserId(db: ReturnType<typeof getDb>, prefix: string): string {
  const rows = db.prepare("SELECT id FROM users WHERE id LIKE ?").all(`${prefix}%`) as { id: string }[]
  let max = 0
  for (const r of rows) {
    const n = Number(r.id.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const students = db
    .prepare("SELECT * FROM users WHERE role = 'student' ORDER BY name")
    .all()
    .map((r) => mapUser(r as Parameters<typeof mapUser>[0]))

  const staff = db
    .prepare("SELECT * FROM users WHERE role = 'staff' ORDER BY name")
    .all()
    .map((r) => mapUser(r as Parameters<typeof mapUser>[0]))

  const mentors = db
    .prepare("SELECT id, name, designation, department, email, phone, office, office_hours, avatar_initials, mentees FROM mentors ORDER BY name")
    .all() as {
    id: string
    name: string
    designation: string
    department: string
    email: string
    phone: string
    office: string
    office_hours: string
    avatar_initials: string
    mentees: number
  }[]

  return NextResponse.json({
    students,
    staff,
    mentors: mentors.map((m) => ({
      id: m.id,
      name: m.name,
      designation: m.designation,
      department: m.department,
      email: m.email,
      phone: m.phone,
      office: m.office,
      officeHours: m.office_hours,
      avatarInitials: m.avatar_initials,
      mentees: m.mentees,
    })),
  })
}

/** Adds a student or staff member (admin only). New accounts use the default password. */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : ""
    return s === "" ? null : s
  }

  const name = str(body.name)
  const email = str(body.email)
  if (name === null) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (email === null || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }

  const kind = body.kind === "staff" ? "staff" : "students"
  const role = str(body.role) ?? (kind === "staff" ? "staff" : "student")

  const db = getDb()
  const roleExists = db.prepare("SELECT key FROM roles WHERE key = ?").get(role) as { key: string } | undefined
  if (!roleExists) return NextResponse.json({ error: "Unknown role — create it in Roles & permissions first" }, { status: 400 })
  const exists = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email) as { id: string } | undefined
  if (exists) return NextResponse.json({ error: "That email is already in use" }, { status: 409 })

  const prefix = kind === "staff" ? "STF-" : "STU-"
  const id = nextUserId(db, prefix)
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
    .padStart(2, name[0]?.toUpperCase() ?? "U")

  const subjects = Array.isArray(body.subjects)
    ? JSON.stringify(body.subjects.map((s) => String(s).trim()).filter(Boolean))
    : null

  try {
    db.prepare(
      `INSERT INTO users (id, name, role, email, password_hash, avatar_initials, department, batch, semester, roll_no, mentor_id, designation, subjects, phone, address, guardian_name, guardian_phone, emergency_contact, dob)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      name,
      role,
      email.toLowerCase(),
      hashPassword(DEFAULT_PASSWORD),
      initials,
      str(body.department) ?? "",
      str(body.batch),
      str(body.semester),
      str(body.rollNo),
      str(body.mentorId),
      str(body.designation),
      subjects,
      str(body.phone),
      str(body.address),
      str(body.guardianName),
      str(body.guardianPhone),
      str(body.emergencyContact),
      str(body.dob),
    )
  } catch (err) {
    const message = err instanceof Error && /UNIQUE constraint failed/.test(err.message)
      ? "That email is already in use."
      : "Could not add the person."
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Parameters<typeof mapUser>[0]
  return NextResponse.json({ ok: true, person: mapUser(row) }, { status: 201 })
}
