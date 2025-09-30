import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MAINTENANCE_PATH = "/maintenance";
const PUBLIC_FILE = /\.[^/]+$/;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === MAINTENANCE_PATH ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/_vercel") ||
    pathname.startsWith("/static") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = MAINTENANCE_PATH;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: "/:path*",
};
