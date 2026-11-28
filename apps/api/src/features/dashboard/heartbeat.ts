import { randomUUID } from "node:crypto"
import type { OpenAPIHono } from "@hono/zod-openapi"
import { getCookie, setCookie } from "hono/cookie"
import type { BusinessCache } from "../../shared/cache.js"
import { apiError } from "../../shared/contract.js"
import { heartbeatRoute } from "./contract.js"

export function registerHeartbeat(
  app: OpenAPIHono,
  cache: BusinessCache,
  mainOrigin: string,
  hvnOrigin: string,
  trustedOrigins: readonly string[],
  secure: boolean
) {
  app.openapi(heartbeatRoute, async (c) => {
    c.header("Cache-Control", "private, no-store")
    const origin = c.req.header("Origin")
    const site =
      origin === mainOrigin ? "main" : origin === hvnOrigin ? "hvn" : null
    if (!site || !origin || !trustedOrigins.includes(origin))
      return c.json(
        apiError(
          "INVALID_ORIGIN",
          "Unknown presence origin",
          c.get("requestId")
        ),
        403
      )
    const cookie = getCookie(c, "sd_presence")
    const visitor =
      cookie &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        cookie
      )
        ? cookie
        : randomUUID()
    if (!(await cache.touchPresence(site, visitor)))
      return c.json(
        apiError(
          "PRESENCE_UNAVAILABLE",
          "Presence is unavailable",
          c.get("requestId")
        ),
        503
      )
    if (visitor !== cookie)
      setCookie(c, "sd_presence", visitor, {
        httpOnly: true,
        secure,
        sameSite: "Lax",
        path: "/v1/presence",
      })
    return c.body(null, 204)
  })
}
