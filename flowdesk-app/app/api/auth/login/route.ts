import { NextResponse } from "next/server"
import { findUserByEmail, mapUser } from "@/lib/db"
import { verifyPassword } from "@/lib/db/password"
import { createSession, purgeExpiredSessions } from "@/lib/auth"
import { withPermissions } from "@/lib/permissions"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password ?? ""
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const user = findUserByEmail(email)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  purgeExpiredSessions()
  const proto = request.headers.get("x-forwarded-proto")
  const cfVisitor = request.headers.get("cf-visitor") ?? ""
  const secure = proto === "https" || cfVisitor.includes('"https"')
  await createSession(user.id, { secure })

  return NextResponse.json({ user: withPermissions(mapUser(user)) })
}
