import { cookies } from "next/headers"
import { randomBytes } from "node:crypto"
import { getDb, mapUser, findUserById } from "@/lib/db"

export const SESSION_COOKIE = "flowdesk.session"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function createSession(userId: string, opts?: { secure?: boolean }): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  getDb()
    .prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, expiresAt.toISOString())

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: opts?.secure ?? process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  })
  return token
}

export async function destroySession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token = ?").run(token)
  }
  store.delete(SESSION_COOKIE)
}

/** Purges expired sessions opportunistically. Cheap; call on login. */
export function purgeExpiredSessions() {
  getDb().prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString())
}

export async function getSessionUser() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const row = getDb()
    .prepare(
      "SELECT user_id FROM sessions WHERE token = ? AND expires_at > ?",
    )
    .get(token, new Date().toISOString()) as { user_id: string } | undefined

  if (!row) return null
  const user = findUserById(row.user_id)
  return user ? mapUser(user) : null
}
