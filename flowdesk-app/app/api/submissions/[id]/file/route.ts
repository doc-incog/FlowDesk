import { NextResponse } from "next/server"
import { readFileSync, existsSync } from "node:fs"
import { join, extname } from "node:path"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

// GET /api/submissions/[id]/file?download=1
//
//   Students can fetch only their own submission file.
//   Staff and admins can fetch any submission file.
//   An optional ?download=1 flag forces an attachment download instead of inline preview.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { id } = await params
  const db = getDb()

  const sub = db
    .prepare("SELECT id, student_id, file_name, file_path FROM submissions WHERE id = ?")
    .get(id) as {
    id: string
    student_id: string
    file_name: string
    file_path: string | null
  } | undefined
  if (!sub) return new NextResponse("Submission not found", { status: 404 })

  if (user.role === "student" && sub.student_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 })
  }
  if (user.role !== "student" && user.role !== "staff" && user.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  if (!sub.file_path || !existsSync(sub.file_path)) {
    return new NextResponse("File not found on disk", { status: 404 })
  }

  const data = readFileSync(sub.file_path)
  const ext = extname(sub.file_name).toLowerCase()
  const contentType = MIME[ext] ?? "application/octet-stream"

  const url = new URL(request.url)
  const download = url.searchParams.get("download") === "1"
  const disposition = download ? "attachment" : "inline"
  const safeName = sub.file_name.replace(/[^\w.\- ]/g, "_")

  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Content-Length": String(data.byteLength),
      "Cache-Control": "no-cache",
    },
  })
}
