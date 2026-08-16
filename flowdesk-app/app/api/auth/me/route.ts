import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { withPermissions } from "@/lib/permissions"

export const runtime = "nodejs"

export async function GET() {
  const user = await getSessionUser()
  return NextResponse.json({ user: user ? withPermissions(user) : null })
}
