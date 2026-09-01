import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb, mapUser } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getDb()
  const row = user.mentorId
    ? (db.prepare("SELECT * FROM mentors WHERE id = ?").get(user.mentorId) as
        | {
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
        | undefined)
    : (db.prepare("SELECT * FROM mentors WHERE name = ?").get(user.name) as
        | {
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
        | undefined)

  if (!row) {
    return NextResponse.json({ mentor: null, mentees: [] })
  }

  const mentor = {
    id: row.id,
    name: row.name,
    designation: row.designation,
    department: row.department,
    email: row.email,
    phone: row.phone,
    office: row.office,
    officeHours: row.office_hours,
    avatarInitials: row.avatar_initials,
    mentees: row.mentees,
  }

  // Staff see the students they mentor (matched via users.mentor_id).
  const menteeRows = user.role === "staff"
    ? db.prepare("SELECT * FROM users WHERE mentor_id = ? AND is_deleted = 0 ORDER BY name").all(mentor.id) as Parameters<typeof mapUser>[0][]
    : []
  const mentees = menteeRows.map((m) => mapUser(m))

  return NextResponse.json({ mentor, mentees })
}
