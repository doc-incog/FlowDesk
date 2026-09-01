import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb, mapUser, nextPrefixId } from "@/lib/db"
import { hashPassword } from "@/lib/db/password"
import { DEFAULT_PASSWORD } from "@/lib/constants"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()

  const students = db
    .prepare("SELECT * FROM users WHERE role = 'student' AND is_deleted = 0 ORDER BY name")
    .all()
    .map((r) => mapUser(r as Parameters<typeof mapUser>[0]))

  const staff = db
    .prepare("SELECT * FROM users WHERE role = 'staff' AND is_deleted = 0 ORDER BY name")
    .all()
    .map((r) => mapUser(r as Parameters<typeof mapUser>[0]))

  // Only list mentors that map to an actual active (non-deleted) staff account,
  // so the mentor dropdown never shows roster-only entries whose staff user was
  // deleted. Mirrors the filtering used by /api/mentees.
  const mentors = db
    .prepare(`SELECT m.id, m.name, m.designation, m.department, m.email, m.phone, m.office, m.office_hours, m.avatar_initials, m.mentees
              FROM mentors m
              JOIN users u ON u.name = m.name AND u.role = 'staff' AND u.is_deleted = 0
              ORDER BY m.name`)
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
  const id = nextPrefixId(db, "users", prefix)
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

  // Staff become mentors too: create their roster row so they can be assigned
  // students in Mentees and show up in the student mentor dropdown. Mentors are
  // linked to staff accounts by name, so this must stay in sync.
  if (role === "staff") {
    const mentorId = nextPrefixId(db, "mentors", "MEN-")
    try {
      db.prepare(
        `INSERT INTO mentors (id, name, designation, department, email, phone, office, office_hours, avatar_initials, mentees)
         VALUES (?, ?, ?, ?, ?, ?, '', '', ?, 0)`,
      ).run(
        mentorId,
        name,
        str(body.designation) ?? "",
        str(body.department) ?? "",
        email.toLowerCase(),
        str(body.phone) ?? "",
        initials,
      )
    } catch {
      // A roster row may already exist for this staff name; not worth failing the add.
    }
  }

  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Parameters<typeof mapUser>[0]
  return NextResponse.json({ ok: true, person: mapUser(row) }, { status: 201 })
}
