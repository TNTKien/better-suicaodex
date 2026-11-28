import { expect, test } from "bun:test"
import { createApp } from "../../src/app"
import type { CatalogDependencies } from "../../src/features/catalog/routes"
import type { Auth } from "../../src/features/account/auth"
import { drizzle } from "drizzle-orm/node-postgres"

test("guest heartbeat is separated by trusted site and dashboard reads require an administrator", async () => {
  const main = "https://main.example"
  const hvn = "https://hvn.example"
  const seen = { main: new Set<string>(), hvn: new Set<string>() }
  let available = true
  const cache = {
    async touchPresence(site: keyof typeof seen, visitor: string) {
      if (!available) return false
      seen[site].add(visitor)
      return true
    },
    async onlinePresence() {
      return available
        ? {
            main: seen.main.size,
            hvn: seen.hvn.size,
            total: seen.main.size + seen.hvn.size,
          }
        : null
    },
  }
  let role = "user"
  const database = drizzle({ query: async () => ({ rows: [[role]] }) } as never)
  const auth = {
    api: {
      getSession: async ({ headers }: { headers: Headers }) =>
        headers.has("cookie") ? { user: { id: "tester" } } : null,
    },
  } as unknown as Auth
  const app = createApp({
    auth,
    logger: () => {},
    webOrigin: main,
    hvnOrigin: hvn,
    allowedWebOrigins: [hvn, "https://other.example"],
    catalog: { cache, database } as unknown as CatalogDependencies,
  })
  const beat = (origin: string, cookie = "") =>
    app.request("/v1/presence/heartbeat", {
      method: "POST",
      headers: { origin, cookie },
    })
  for (const path of ["/v1/admin/dashboard", "/v1/admin/dashboard/online"]) {
    expect((await app.request(path)).status).toBe(401)
    expect(
      (await app.request(path, { headers: { cookie: "session=1" } })).status
    ).toBe(403)
  }
  expect((await beat("https://other.example")).status).toBe(403)
  const first = await beat(main)
  expect(first.status).toBe(204)
  const cookie = first.headers.get("set-cookie")!.split(";")[0]!
  expect((await beat(main, cookie)).headers.has("set-cookie")).toBe(false)
  expect((await beat(hvn, cookie)).status).toBe(204)
  role = "admin"
  const online = () =>
    app.request("/v1/admin/dashboard/online", {
      headers: { cookie: "session=1" },
    })
  const result = await online()
  expect(result.headers.get("cache-control")).toContain("no-store")
  expect(await result.json()).toEqual({ main: 1, hvn: 1, total: 2 })
  available = false
  expect((await online()).status).toBe(503)
  expect((await beat(main)).status).toBe(503)
})
