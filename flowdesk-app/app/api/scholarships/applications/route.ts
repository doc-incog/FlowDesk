import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDateTime } from "@/lib/datetime"

export const runtime = "nodejs"

const MAX_SIZE = 5 * 1024 * 1024
const MAX_DOCS = 4

/** Submits a scholarship application with supporting documents (students). */
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const form = await request.formData()
  const scholarshipId = String(form.get("scholarshipId") ?? "").trim()
  const files = form.getAll("docs").filter((f): f is File => f instanceof File && f.size > 0)

  if (!scholarshipId) return NextResponse.json({ error: "scholarshipId is required" }, { status: 400 })

  const db = getDb()
  const scholarship = db
    .prepare("SELECT id, name FROM scholarships WHERE id = ?")
    .get(scholarshipId) as { id: string; name: string } | undefined
  if (!scholarship) return NextResponse.json({ error: "Scholarship not found" }, { status: 404 })

  const existing = db
    .prepare("SELECT id FROM scholarship_applications WHERE scholarship_id = ? AND student_id = ?")
    .get(scholarshipId, user.id) as { id: string } | undefined
  if (existing) {
    return NextResponse.json(
      { error: "You have already applied for this scholarship" },
      { status: 409 },
    )
  }

  if (files.length > MAX_DOCS) {
    return NextResponse.json({ error: `Attach at most ${MAX_DOCS} documents` }, { status: 400 })
  }
  for (const f of files) {
    if (f.size > MAX_SIZE) {
      return NextResponse.json({ error: `${f.name} is too large (max 5 MB)` }, { status: 413 })
    }
  }

  const uploadsDir = join(process.env.RENDER_DISK_MOUNT_PATH || process.cwd(), ".data", "uploads")
  mkdirSync(uploadsDir, { recursive: true })

  const storedDocs: { name: string; path: string }[] = []
  for (const f of files) {
    const safeName = f.name.replace(/[^\w.\- ]/g, "_").slice(0, 120)
    const id = `sd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const storedPath = join(uploadsDir, `${id}-${safeName}`)
    writeFileSync(storedPath, Buffer.from(await f.arrayBuffer()))
    storedDocs.push({ name: safeName, path: storedPath })
  }

  const id = `sa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const submittedAt = localDateTime()
  db.prepare(
    `INSERT INTO scholarship_applications (id, scholarship_id, student_id, student_name, status, submitted_at, docs)
     VALUES (?, ?, ?, ?, 'submitted', ?, ?)`,
  ).run(id, scholarshipId, user.id, user.name, submittedAt, JSON.stringify(storedDocs))

  return NextResponse.json(
    {
      ok: true,
      application: {
        id,
        scholarshipId,
        studentId: user.id,
        studentName: user.name,
        status: "submitted",
        submittedAt,
        docs: JSON.stringify(storedDocs),
      },
    },
    { status: 201 },
  )
}
