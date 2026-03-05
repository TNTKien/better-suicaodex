import type { NextRequest } from "next/server";

const authRoutes = ["/auth/signin", "/auth/signup", "/login"];
const protectedRoutes = ["/user", "/settings"];

export const proxy = (req: NextRequest) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.cookies.get("better-auth.session_token")?.value;
  const path = nextUrl.pathname;

  // login rồi và vẫn vào auth route thì redirect home page
  if (isLoggedIn && authRoutes.includes(path))
    return Response.redirect(new URL("/", nextUrl));

  const isProtected = protectedRoutes.some((route) => path.startsWith(route));

  // chưa login mà vào protected route thì bắt login
  if (isProtected && !isLoggedIn) {
    let callbackUrl = nextUrl.pathname;
    if (nextUrl.search) callbackUrl += nextUrl.search;

    const encodedCallbackUrl = encodeURIComponent(callbackUrl);
    return Response.redirect(
      new URL(`/auth/signin?callback=${encodedCallbackUrl}`, nextUrl),
    );
  }

  // để thằng bé đó yên
  return;
};

export const middleware = proxy;

export default proxy;

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|avatars|sitemap.xml|.well-known|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
