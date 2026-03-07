import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const authRoutes = ["/login"];
const protectedRoutes = ["/user", "/settings"];

export function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const isLoggedIn = !!getSessionCookie(req);
  const path = nextUrl.pathname;

  // login rồi và vẫn vào auth route thì redirect home page
  if (isLoggedIn && authRoutes.includes(path))
    return NextResponse.redirect(new URL("/", nextUrl));

  const isProtected = protectedRoutes.some((route) => path.startsWith(route));

  // chưa login mà vào protected route thì bắt login
  if (isProtected && !isLoggedIn) {
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) callbackUrl += nextUrl.search;

    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return NextResponse.redirect(
      new URL(`/login?callback=${encodedCallbackUrl}`, nextUrl),
    );
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|avatars|sitemap.xml|.well-known|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
