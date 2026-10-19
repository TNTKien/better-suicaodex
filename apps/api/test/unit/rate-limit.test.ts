import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test"
import { Hono } from "hono"

import { globalRateLimiter } from "../../src/shared/rate-limit"

beforeEach(() => setSystemTime(1_700_000_000_000))
afterEach(() => setSystemTime())

function browserApp() {
  const app = new Hono()
  app.use("*", globalRateLimiter())
  app.all("*", (c) => c.json({ policy: c.get("rateLimitPolicy") }))
  return app
}

const domains = [
  [
    "user",
    [
      "/api/auth/get-session",
      "/api/auth/sign-out",
      "/v1/me",
      "/v1/me/profile",
      "/v1/me/notifications/read-all",
      "/v1/me/coin-wallet/transactions",
      "/v1/me/avatar-frames",
      "/v1/profiles/user-id",
      "/v1/system-notices",
    ],
  ],
  [
    "group",
    [
      "/v1/groups",
      "/v1/groups/group-id",
      "/v1/me/groups",
      "/v1/contribution/groups",
      "/v1/contribution/groups/group-id/members/user-id/permissions",
      "/v1/contribution/groups/group-id/coin-wallet/transfers",
      "/v1/contribution/groups/group-id/manga/manga-id/chapter-uploads/session-id/pages",
      "/v1/rankings/groups",
      "/uploads/covers/tmp/cover.webp",
      "/uploads/chapters/tmp/page.webp",
    ],
  ],
  [
    "shop",
    [
      "/v1/shop/avatar-frames",
      "/v1/shop/avatar-frame-topics",
      "/v1/shop/chests/chest-id/pool",
      "/v1/me/shop/avatar-frames",
      "/v1/me/shop/purchases/operation-id",
      "/v1/me/shop/gacha-rolls",
    ],
  ],
  [
    "manga",
    [
      "/v1/manga",
      "/v1/manga/manga-id/reading-entry",
      "/v1/chapters/chapter-id/navigation-releases",
      "/v1/chapters/chapter-id/view",
      "/v1/comments/comment-id",
      "/v1/tags",
      "/v1/people/person-id",
      "/v1/rankings/manga",
      "/v1/me/library/manga-id",
      "/v1/me/reading-progress/chapter-id",
      "/v1/me/reading-history/merge",
    ],
  ],
] as const

test.each(domains)(
  "maps browser %s routes to the same domain for read/write methods",
  async (policy, paths) => {
    for (const path of paths) {
      const app = browserApp()
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        const response = await app.request(path, { method })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ policy })
      }
    }
  }
)

test("each browser domain allows ten requests independently and shares its quota across routes", async () => {
  const app = browserApp()
  for (const [policy, paths] of domains) {
    for (let index = 0; index < 10; index++) {
      const response = await app.request(paths[index % paths.length]!)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ policy })
    }
    const limited = await app.request(paths[0], { method: "POST" })
    expect(limited.status).toBe(429)
    expect(limited.headers.get("retry-after")).toBeTruthy()
    expect(await limited.json()).toMatchObject({
      error: { code: "RATE_LIMITED" },
    })
  }
  expect((await app.request("/health")).status).toBe(200)
  expect((await app.request("/v1/admin/groups")).status).toBe(200)
})

test("browser domains keep their quota per IP and OPTIONS does not consume it", async () => {
  for (const [, paths] of domains) {
    const app = browserApp()
    const request = (ip: string, method = "GET") =>
      app.request(
        paths[0],
        { method },
        { incoming: { socket: { remoteAddress: ip } } }
      )
    for (let index = 0; index < 12; index++)
      expect((await request("203.0.113.1", "OPTIONS")).status).toBe(200)
    for (let index = 0; index < 10; index++)
      expect((await request("203.0.113.1")).status).toBe(200)
    expect((await request("203.0.113.1")).status).toBe(429)
    const spoofed = await app.request(
      paths[0],
      {
        headers: {
          "X-Forwarded-For": "203.0.113.3",
          "CF-Connecting-IP": "203.0.113.3",
        },
      },
      { incoming: { socket: { remoteAddress: "203.0.113.1" } } }
    )
    expect(spoofed.status).toBe(429)
    expect((await request("203.0.113.2")).status).toBe(200)
  }
})

test.each([
  "/v1/shopper",
  "/v1/me/shopper",
  "/v1/me/groups-extra",
  "/v1/contribution/groups-extra",
  "/v1/manga-extra",
  "/api/auth-extra/get-session",
  "/v1/administrator/groups",
  "/unknown",
])(
  "lookalike or unknown route %s cannot escape the bounded fallback",
  async (path) => {
    const app = browserApp()
    const response = await app.request(path)
    expect(await response.json()).toEqual({
      policy: path.startsWith("/v1/me/") ? "user" : "public",
    })
    for (let index = 1; index < 10; index++)
      expect((await app.request(path)).status).toBe(200)
    expect((await app.request(path)).status).toBe(429)
  }
)
