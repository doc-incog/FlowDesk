import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { findUserById, getDb, mapUser } from "@/lib/db"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const db = getDb()
  const existing = findUserById(id)
  if (!existing) return NextResponse.json({ error: "Person not found" }, { status: 404 })

  const str = (v: unknown) => {
    const s = typeof v === "string" ? v.trim() : ""
    return s === "" ? null : s
  }

  const name = str(body.name) ?? existing.name
  const email = (str(body.email) ?? existing.email).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 })
  }

  const duplicate = db
    .prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ?")
    .get(email, id) as { id: string } | undefined
  if (duplicate) return NextResponse.json({ error: "That email is already in use" }, { status: 409 })

  const role = str(body.role) ?? existing.role
  const roleExists = db.prepare("SELECT key FROM roles WHERE key = ?").get(role) as { key: string } | undefined
  if (!roleExists) return NextResponse.json({ error: "Unknown role — create it in Roles & permissions first" }, { status: 400 })
  const subjects =
    Array.isArray(body.subjects)
      ? JSON.stringify(body.subjects.map((s) => String(s).trim()).filter(Boolean))
      : existing.subjects

  try {
    db.prepare(
      `UPDATE users SET
        name = ?, role = ?, email = ?, avatar_initials = ?, department = ?,
        batch = ?, semester = ?, roll_no = ?, mentor_id = ?,
        designation = ?, subjects = ?,
        phone = ?, address = ?, guardian_name = ?, guardian_phone = ?, emergency_contact = ?, dob = ?
       WHERE id = ?`,
    ).run(
      name,
      role,
      email,
      str(body.avatarInitials) ?? existing.avatar_initials,
      str(body.department) ?? "",
      str(body.batch) ?? existing.batch,
      str(body.semester) ?? existing.semester,
      str(body.rollNo) ?? existing.roll_no,
      str(body.mentorId) ?? existing.mentor_id,
      str(body.designation) ?? existing.designation,
      subjects,
      str(body.phone) ?? existing.phone,
      str(body.address) ?? existing.address,
      str(body.guardianName) ?? existing.guardian_name,
      str(body.guardianPhone) ?? existing.guardian_phone,
      str(body.emergencyContact) ?? existing.emergency_contact,
      str(body.dob) ?? existing.dob,
      id,
    )
  } catch (err) {
    const message = err instanceof Error && /UNIQUE constraint failed/.test(err.message)
      ? "That email is already in use."
      : "Could not update the person."
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const row = findUserById(id)
  return NextResponse.json({ ok: true, person: row ? mapUser(row) : null })
}
