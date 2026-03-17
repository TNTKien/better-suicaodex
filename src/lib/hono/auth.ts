import type { Context } from "hono";
import { auth, type AuthSession } from "@/auth";

export async function getHonoAuthSession(
  context: Context,
): Promise<AuthSession | null> {
  return auth.api.getSession({
    headers: context.req.raw.headers,
  });
}
