import { existsSync, readFileSync } from "node:fs"
import { basename } from "node:path"
import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

type DocEntry = { name?: string; path?: string } | string

// GET /api/scholarships/applications/[id]/docs?file=<name>
// Streams one uploaded supporting document so the admin (or the owning student)
// can view/download it before deciding on the application. Documents are matched
// by name against the stored docs array to avoid path traversal.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const url = new URL(request.url)
  const fileQuery = url.searchParams.get("file")?.trim() ?? ""

  const db = getDb()
  const app = db
    .prepare("SELECT student_id, docs FROM scholarship_applications WHERE id = ?")
    .get(id) as { student_id: string; docs: string } | undefined
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  // Only the owning student or an admin may read the documents.
  if (user.role !== "admin" && app.student_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let docs: DocEntry[] = []
  try {
    const parsed = JSON.parse(app.docs)
    if (Array.isArray(parsed)) docs = parsed
  } catch {
    // Seed/demo applications store plain names, not file metadata.
  }

  const entry = docs.find((d) => (typeof d === "string" ? d === fileQuery : d.name === fileQuery))
  const path =
    typeof entry === "string"
      ? entry
      : typeof entry?.path === "string"
        ? entry.path
        : null

  if (!path || !existsSync(path)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const data = readFileSync(path)
  const name = basename(path)
  const ext = name.split(".").pop()?.toLowerCase()
  const mime =
    ext === "pdf"
      ? "application/pdf"
      : ["png", "jpg", "jpeg", "gif", "webp"].includes(ext ?? "")
        ? `image/${ext === "jpg" ? "jpeg" : ext}`
        : ext === "csv"
          ? "text/csv"
          : ext === "txt"
            ? "text/plain"
            : "application/octet-stream"

  return new NextResponse(data, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `inline; filename="${name.replace(/"/g, "")}"`,
      "Content-Length": String(data.length),
    },
  })
}