import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb, mapUser } from "@/lib/db"

export const runtime = "nodejs"

type MentorRow = {
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
}

// GET /api/mentees — admin-only management view of the mentor roster and
// their assigned mentees, plus the pool of unassigned students.
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const db = getDb()

  // Only list mentors that correspond to an actual active (non-deleted) staff
  // account, so every roster entry maps to a real user. Roster-only entries
  // (e.g. a mentor row with no matching staff user) are excluded here.
  const mentorRows = db
    .prepare(
      `SELECT m.id, m.name, m.designation, m.department, m.email, m.phone, m.office, m.office_hours, m.avatar_initials, m.mentees
       FROM mentors m
       JOIN users u ON u.name = m.name AND u.role = 'staff' AND u.is_deleted = 0
       ORDER BY m.name`,
    )
    .all() as MentorRow[]

  const mentors = mentorRows.map((m) => {
    const menteeRows = db
      .prepare("SELECT * FROM users WHERE mentor_id = ? AND is_deleted = 0 ORDER BY name")
      .all(m.id) as Parameters<typeof mapUser>[0][]
    return {
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
      students: menteeRows.map((s) => mapUser(s)),
    }
  })

  // Students not currently assigned to any mentor (the assignable pool)
  const unassignedRows = db
    .prepare("SELECT * FROM users WHERE role = 'student' AND is_deleted = 0 AND (mentor_id IS NULL OR mentor_id = '') ORDER BY name")
    .all() as Parameters<typeof mapUser>[0][]

  return NextResponse.json({
    mentors,
    unassigned: unassignedRows.map((s) => mapUser(s)),
  })
}
