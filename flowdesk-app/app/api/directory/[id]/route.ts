import { NextResponse } from "next/server"
import { unlinkSync, existsSync } from "node:fs"
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

  // An explicit empty mentorId means "clear the assignment" (write NULL),
  // otherwise fall back to the current value when the field is untouched.
  const mentorId =
    Object.prototype.hasOwnProperty.call(body, "mentorId") && String(body.mentorId).trim() === ""
      ? null
      : str(body.mentorId) ?? existing.mentor_id

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
      mentorId,
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

  // Keep the mentors roster row in sync when a staff member's name changes,
  // since mentees/directory/mentor routes JOIN mentors to staff by name.
  if (existing.role === "staff" && name !== existing.name) {
    db.prepare("UPDATE mentors SET name = ? WHERE name = ?").run(name, existing.name)
  }

  const row = findUserById(id)
  return NextResponse.json({ ok: true, person: row ? mapUser(row) : null })
}

/** Soft-deletes a student/staff member and purges their live data (admin only).
 *  The user row is kept (flagged is_deleted) so historical chat threads,
 *  financial/result audit records and the directory remain intact, but the
 *  person is hidden from every listing, cannot log in, cannot be messaged,
 *  and their PII is blanked out. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  if (id === user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
  }

  const db = getDb()
  const existing = findUserById(id)
  if (!existing) return NextResponse.json({ error: "Person not found" }, { status: 404 })
  if (existing.role === "admin") {
    return NextResponse.json({ error: "Admin accounts cannot be deleted" }, { status: 403 })
  }
  if (existing.is_deleted) {
    return NextResponse.json({ error: "Person already deleted" }, { status: 409 })
  }

  // Live account data that must not linger: sessions (log the person out),
  // notifications, per-user permission overrides, and their submitted work.
  // Chat threads (conversations + messages) are intentionally KEPT so the
  // other party's history stays readable with "Unknown User". Financial and
  // result audit records (fees paid, receipts, results) are also preserved.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id)
  db.prepare("DELETE FROM notifications WHERE user_id = ?").run(id)
  db.prepare("DELETE FROM user_permissions WHERE user_id = ?").run(id)

  // Assignment submissions: also remove the uploaded files from disk
  const submissions = db
    .prepare("SELECT file_path FROM submissions WHERE student_id = ?")
    .all(id) as { file_path: string | null }[]
  for (const sub of submissions) {
    if (sub.file_path && existsSync(sub.file_path)) {
      try {
        unlinkSync(sub.file_path)
      } catch {
        // Best-effort: leave orphan file if it cannot be removed
      }
    }
  }
  db.prepare("DELETE FROM submissions WHERE student_id = ?").run(id)

  // User-generated content the person created as a student/staff member
  db.prepare("DELETE FROM complaints WHERE raised_by_id = ?").run(id)
  db.prepare("DELETE FROM feedback_entries WHERE by_id = ?").run(id)
  db.prepare("DELETE FROM scholarship_applications WHERE student_id = ?").run(id)

  // Remove attendance check-ins (live operational data)
  db.prepare("DELETE FROM check_ins WHERE user_id = ?").run(id)

  // Clear any mentor references pointing at the deleted person. Mentor roster
  // rows are linked to staff BY NAME (see /api/mentor, /api/mentees,
  // /api/directory), so resolve the matching mentor id(s) from the staff
  // name BEFORE blanking the PII, then un-assign every student assigned to
  // those mentors and drop the roster row(s). This frees the students to be
  // reassigned a new mentor from the admin Mentees section.
  const mentorRows = db
    .prepare("SELECT id FROM mentors WHERE name = ?")
    .all(existing.name) as { id: string }[]
  if (mentorRows.length > 0) {
    const placeholders = mentorRows.map(() => "?").join(",")
    const ids = mentorRows.map((m) => m.id)
    db.prepare(
      `UPDATE users SET mentor_id = NULL WHERE role = 'student' AND mentor_id IN (${placeholders})`,
    ).run(...ids)
    db.prepare(`DELETE FROM mentors WHERE id IN (${placeholders})`).run(...ids)
  }
  db.prepare("UPDATE users SET mentor_id = NULL WHERE mentor_id = ?").run(id)

  // Soft-delete: flag the row, blank PII, keep the id for chat/audit refs.
  db.prepare(
    `UPDATE users SET
       is_deleted = 1,
       name = 'Unknown User',
       email = ?,
       avatar_initials = '?',
       department = '',
       batch = NULL,
       semester = NULL,
       roll_no = NULL,
       mentor_id = NULL,
       designation = NULL,
       subjects = NULL,
       phone = NULL,
       address = NULL,
       guardian_name = NULL,
       guardian_phone = NULL,
       emergency_contact = NULL,
       dob = NULL,
       password_hash = ''
     WHERE id = ?`,
  ).run(`deleted+${id.toLowerCase()}@flowdesk.local`, id)

  return NextResponse.json({ ok: true })
}
