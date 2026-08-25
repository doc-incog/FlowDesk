import { NextResponse } from "next/server"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { localDateTime } from "@/lib/datetime"

export const runtime = "nodejs"

const MAX_SIZE = 5 * 1024 * 1024

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const form = await request.formData()
  const assignmentId = String(form.get("assignmentId") ?? "").trim()
  const file = form.get("file")

  if (!assignmentId) return NextResponse.json({ error: "assignmentId is required" }, { status: 400 })
  if (!file || typeof file === "string") return NextResponse.json({ error: "A file is required" }, { status: 400 })

  const db = getDb()
  const assignment = db
    .prepare("SELECT id, title FROM assignments WHERE id = ?")
    .get(assignmentId) as { id: string; title: string } | undefined
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })

  const existing = db
    .prepare("SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?")
    .get(assignmentId, user.id) as { id: string } | undefined
  if (existing) return NextResponse.json({ error: "Already submitted — assignments accept one submission" }, { status: 409 })

  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 })

  const safeName = file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120)
  const id = `su-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const uploadsDir = join(process.env.RENDER_DISK_MOUNT_PATH || process.cwd(), ".data", "uploads")
  mkdirSync(uploadsDir, { recursive: true })
  const storedPath = join(uploadsDir, `${id}-${safeName}`)
  writeFileSync(storedPath, Buffer.from(await file.arrayBuffer()))

  const submittedAt = localDateTime()
  db.prepare(
    `INSERT INTO submissions (id, assignment_id, student_id, student_name, submitted_at, file_name, file_path, marks, feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, '')`,
  ).run(id, assignmentId, user.id, user.name, submittedAt, safeName, storedPath)

  return NextResponse.json(
    {
      submission: {
        id,
        assignmentId,
        studentId: user.id,
        studentName: user.name,
        submittedAt,
        fileName: safeName,
        marks: null,
        feedback: "",
      },
    },
    { status: 201 },
  )
}
