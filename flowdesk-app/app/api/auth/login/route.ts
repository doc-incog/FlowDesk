import { NextResponse } from "next/server"
import { findUserByEmail, mapUser } from "@/lib/db"
import { verifyPassword } from "@/lib/db/password"
import { createSession, purgeExpiredSessions } from "@/lib/auth"

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
  await createSession(user.id)

  return NextResponse.json({ user: mapUser(user) })
}
