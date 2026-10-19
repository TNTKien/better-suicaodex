import { test } from "bun:test"
import assert from "node:assert/strict"
import { OpenAPIHono } from "@hono/zod-openapi"
import { drizzle } from "drizzle-orm/node-postgres"
import type { Database } from "../../src/db/client"
import type { Auth } from "../../src/features/account/auth"
import {
  CurrentAccountSchema,
  PublicProfileSchema,
} from "../../src/features/account/contract"
import { registerProfileRoutes } from "../../src/features/account/routes"

test("/v1/me returns only the current user's exact coin balance without creating a wallet", async () => {
  for (const balance of [null, "0", "9007199254740993"]) {
    const instant = "2026-10-09T00:00:00Z"
    const queries: { text: string; values: unknown[] }[] = []
    const database = drizzle({
      query: async (query: { text: string }, values: unknown[]) => {
        queries.push({ ...query, values })
        if (query.text.includes('from "user_profile"'))
          return { rows: [[null, true, "active", instant, instant]] }
        if (query.text.includes('from "account"'))
          return { rows: [["credential"]] }
        if (query.text.includes('from "member"')) return { rows: [] }
        assert.ok(query.text.includes('from "user"'))
        assert.ok(query.text.includes('left join "coin_wallet"'))
        assert.ok(query.text.includes('"coin_wallet"."user_id" = "user"."id"'))
        assert.equal(values[0], "reader")
        return {
          rows: [
            [
              "reader",
              "Reader",
              "reader@example.test",
              true,
              null,
              "user",
              balance,
              "2026-10-09 00:00:00",
              "2026-10-09 00:00:00",
            ],
          ],
        }
      },
    } as never) as Database
    let authenticated = false
    const auth = {
      api: {
        getSession: async () =>
          authenticated ? { user: { id: "reader" } } : null,
      },
    } as unknown as Auth
    const app = new OpenAPIHono()
    registerProfileRoutes(app, { database, auth, avatarFramesEnabled: false })
    const unauthorized = await app.request("/v1/me")
    assert.equal(unauthorized.status, 401)
    assert.equal(queries.length, 0)

    authenticated = true
    const response = await app.request("/v1/me")
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("Cache-Control"), "private, no-store")
    const account = CurrentAccountSchema.parse(await response.json())
    assert.equal(account.user.id, "reader")
    assert.equal(account.coinBalance, balance ?? "0")
    assert.equal(queries.length, 4)
    assert.ok(queries.every((query) => query.text.startsWith("select ")))
    assert.ok(!("coinBalance" in PublicProfileSchema.shape))
  }
})
