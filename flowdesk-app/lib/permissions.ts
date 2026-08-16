import type { DatabaseSync } from "node:sqlite"
import { getDb } from "@/lib/db"
import type { UserProfile } from "@/lib/seed-data/core"

/** Sections a role is allowed to see by default. */
export function roleSections(db: DatabaseSync, role: string): string[] {
  return (
    db
      .prepare("SELECT section FROM role_permissions WHERE role = ? ORDER BY section")
      .all(role) as { section: string }[]
  ).map((r) => r.section)
}

/** Explicit per-user override, or null when the user falls back to role defaults. */
export function userOverrideSections(db: DatabaseSync, userId: string): string[] | null {
  const rows = db
    .prepare("SELECT section FROM user_permissions WHERE user_id = ? ORDER BY section")
    .all(userId) as { section: string }[]
  return rows.length > 0 ? rows.map((r) => r.section) : null
}

/** What a user actually sees: their override when set, otherwise their role's defaults. */
export function effectiveSections(db: DatabaseSync, userId: string, role: string): string[] {
  return userOverrideSections(db, userId) ?? roleSections(db, role)
}

/** Human label for a role key, falling back to the key itself. */
export function roleLabel(db: DatabaseSync, role: string): string {
  const row = db.prepare("SELECT label FROM roles WHERE key = ?").get(role) as { label: string } | undefined
  return row?.label ?? role
}

/** Attaches the signed-in user's effective sections + role label to their profile. */
export function withPermissions(user: UserProfile): UserProfile {
  const db = getDb()
  return {
    ...user,
    sections: effectiveSections(db, user.id, user.role),
    roleLabel: roleLabel(db, user.role),
  }
}
