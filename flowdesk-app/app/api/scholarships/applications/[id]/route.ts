import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

const STATUSES = ["submitted", "under-review", "approved", "rejected"] as const

/** Moves a scholarship application through the review flow (admin only). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  let body: { status?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const status = body.status?.trim()
  if (!status || !(STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { error: "Status must be submitted, under-review, approved or rejected" },
      { status: 400 },
    )
  }

  const db = getDb()
  const result = db
    .prepare("UPDATE scholarship_applications SET status = ? WHERE id = ?")
    .run(status, id)
  if (result.changes === 0) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, status })
}
