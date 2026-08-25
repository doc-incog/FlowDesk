import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const result = getDb().prepare("DELETE FROM assignments WHERE id = ?").run(id)
  if (result.changes === 0) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
