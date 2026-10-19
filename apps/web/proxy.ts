import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { safeReturnTo } from "./modules/account/api"

export async function proxy(request: NextRequest) {
  const next = NextResponse.next()
  next.headers.set("Cache-Control", "private, no-store")
  const params = request.nextUrl.searchParams

  // OAuth completion still confirms /v1/me and emits the login toast on the client.
  if (
    params.has("complete") ||
    params.has("error") ||
    !getSessionCookie(request)
  )
    return next

  try {
    const response = await fetch(
      new URL(
        "/api/auth/get-session",
        process.env.API_URL ?? "http://localhost:3001"
      ),
      {
        headers: {
          cookie: request.headers.get("cookie")!,
          accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(3_000),
      }
    )
    if (!response.ok) return next
    const session = (await response.json()) as {
      user?: { id?: string }
      session?: { id?: string }
    } | null
    if (!session?.user?.id || !session.session?.id) return next

    const redirect = NextResponse.redirect(
      new URL(safeReturnTo(params.get("returnTo")), request.url)
    )
    redirect.headers.set("Cache-Control", "private, no-store")
    return redirect
  } catch {
    // Keep login/retry available when the API is unreachable or the cookie is stale.
    return next
  }
}

export const config = { matcher: "/login" }
