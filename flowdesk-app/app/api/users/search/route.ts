import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() ?? ""

  if (q.length < 1) {
    return NextResponse.json({ users: [] })
  }

  const db = getDb()
  const users = db
    .prepare(`
      SELECT id, name, avatar_initials, role, department
      FROM users
      WHERE id != ? AND (name LIKE ? OR email LIKE ? OR id LIKE ?)
      ORDER BY name
      LIMIT 20
    `)
    .all(user.id, `%${q}%`, `%${q}%`, `%${q}%`) as {
    id: string
    name: string
    avatar_initials: string
    role: string
    department: string
  }[]

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      avatarInitials: u.avatar_initials,
      role: u.role,
      department: u.department,
    })),
  })
}
