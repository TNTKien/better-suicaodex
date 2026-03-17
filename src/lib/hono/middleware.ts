import { createMiddleware } from "hono/factory";
import { getHonoAuthSession } from "@/lib/hono/auth";
import type { CommentsAppEnv } from "@/lib/hono/types";

export const requireAuth = createMiddleware<CommentsAppEnv>(async (c, next) => {
  const session = await getHonoAuthSession(c);

  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("session", session);

  await next();
});
