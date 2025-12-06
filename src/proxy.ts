import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest) {
  return auth(request as any, {} as any);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};