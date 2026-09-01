import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

// DELETE /api/conversations/[id]?action=hide|unhide|delete
//   hide   — soft-hide: mark is_hidden for this user; other participants still see it.
//           If the other user messages, the conversation reappears for both.
//   unhide — restore a hidden conversation back into this user's sidebar/search.
//   delete — permanent: remove this user from conversation_participants.
//           If no participants remain, the conversation and its messages are also removed.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const url = new URL(request.url)
  const action = url.searchParams.get("action") ?? "hide"

  const db = getDb()

  // Verify user is a participant
  const participant = db
    .prepare("SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?")
    .get(id, user.id)
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (action === "unhide") {
    db.prepare(
      "UPDATE conversation_participants SET is_hidden = 0 WHERE conversation_id = ? AND user_id = ?",
    ).run(id, user.id)
  } else if (action === "delete") {
    // Hard delete: remove the user from the conversation
    db.prepare(
      "DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?",
    ).run(id, user.id)

    // If no participants remain, clean up the conversation entirely
    const remaining = db
      .prepare("SELECT COUNT(*) as cnt FROM conversation_participants WHERE conversation_id = ?")
      .get(id) as { cnt: number }

    if (remaining.cnt === 0) {
      db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id)
      db.prepare("DELETE FROM conversations WHERE id = ?").run(id)
    }
  } else {
    // Soft-hide (default)
    db.prepare(
      "UPDATE conversation_participants SET is_hidden = 1 WHERE conversation_id = ? AND user_id = ?",
    ).run(id, user.id)
  }

  return NextResponse.json({ ok: true })
}
