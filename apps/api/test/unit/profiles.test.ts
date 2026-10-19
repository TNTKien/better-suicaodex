import { describe, expect, test } from "bun:test"

import { UpdateProfileSchema } from "../../src/features/account/contract"
import { createApp } from "../../src/app"
import type { Database } from "../../src/db/client"

describe("account profiles", () => {
  test("does not expose provider discovery", async () => {
    const app = createApp({
      account: { database: {} as Database },
      logger: () => {},
    })
    expect((await app.request("/v1/auth/providers")).status).toBe(404)
    const contract = await (await app.request("/openapi.json")).json()
    expect(contract.paths).not.toHaveProperty("/v1/auth/providers")
    expect(contract.components.schemas).not.toHaveProperty("AuthProviders")
  })

  test("validates profile input without accepting application slugs", () => {
    expect(UpdateProfileSchema.parse({ bio: "  hello  " })).toEqual({
      bio: "hello",
    })
    expect(UpdateProfileSchema.safeParse({}).success).toBe(false)
    expect(UpdateProfileSchema.safeParse({ slug: "reader-name" }).success).toBe(
      false
    )
  })
})
