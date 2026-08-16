import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "flowdesk.session"

/**
 * Guards the dashboard at the edge: without a session cookie, requests to
 * /dashboard are redirected to the login page. Full session validity is
 * enforced by GET /api/auth/me.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE)

  if (pathname.startsWith("/dashboard") && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
