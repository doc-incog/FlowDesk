import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

/** Removes a class slot from the routine (admin only). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const db = getDb()

  const result = db.prepare("DELETE FROM schedule_slots WHERE id = ?").run(id)
  if (result.changes === 0) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
