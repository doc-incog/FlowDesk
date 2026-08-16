import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { findUserById, getDb, mapUser } from "@/lib/db"
import { withPermissions } from "@/lib/permissions"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ user: withPermissions(user) })
}

export async function PATCH(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  const subjects =
    Array.isArray(body.subjects)
      ? JSON.stringify(body.subjects.map((s) => String(s).trim()).filter(Boolean))
      : null

  const db = getDb()
  try {
    db.prepare(
      `UPDATE users SET
        name = ?, email = ?, avatar_initials = ?, department = ?,
        phone = ?, address = ?, dob = ?,
        batch = ?, semester = ?, roll_no = ?, mentor_id = ?,
        designation = ?, subjects = ?
       WHERE id = ?`,
    ).run(
      name,
      email.toLowerCase(),
      str(body.avatarInitials) ?? user.avatarInitials,
      str(body.department) ?? "",
      str(body.phone),
      str(body.address),
      str(body.dob),
      str(body.batch),
      str(body.semester),
      str(body.rollNo),
      str(body.mentorId),
      str(body.designation),
      subjects,
      user.id,
    )
  } catch (err) {
    const message = err instanceof Error && /UNIQUE constraint failed: users.email/.test(err.message)
      ? "That email is already in use."
      : "Could not update your profile."
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const updated = findUserById(user.id)
  return NextResponse.json({ user: updated ? withPermissions(mapUser(updated)) : null })
}
