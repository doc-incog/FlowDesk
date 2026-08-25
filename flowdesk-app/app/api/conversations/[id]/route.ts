import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

// Deleting a conversation removes it for every participant: messages and
// participant rows cascade from the conversations row.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const db = getDb()

  // Any participant may delete the whole conversation.
  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  db.prepare("DELETE FROM conversations WHERE id = ?").run(id)

  return NextResponse.json({ ok: true })
}
