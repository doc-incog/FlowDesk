import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb, mapUser } from "@/lib/db"

export const runtime = "nodejs"

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
