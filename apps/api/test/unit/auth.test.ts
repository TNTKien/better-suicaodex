import { randomBytes } from "node:crypto"

import { describe, expect, test } from "bun:test"

import { createAuth } from "../../src/features/account/auth"
import type { Database } from "../../src/db/client"
import type { RuntimeEnv } from "../../src/shared/env"

describe("Better Auth configuration", () => {
  test("caches sessions in a short-lived signed cookie", () => {
    const auth = createAuth(
      {
        NODE_ENV: "development",
        BETTER_AUTH_URL: "http://localhost:3001",
        BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
        WEB_ORIGIN: "http://localhost:3000",
        DISCORD_CLIENT_ID: "test",
        DISCORD_CLIENT_SECRET: "test",
        TRUSTED_PROXY_IPS: ["10.0.0.1"],
      } as RuntimeEnv,
      {} as Database
    )

    expect(auth.options.session?.cookieCache).toEqual({
      enabled: true,
      maxAge: 300,
      strategy: "compact",
    })
    expect(auth.options.secondaryStorage).toBeUndefined()
    expect(auth.options.advanced?.ipAddress?.trustedProxies).toEqual([
      "10.0.0.1",
    ])
    expect(auth.options.plugins?.map(({ id }) => id)).toEqual([
      "admin",
      "organization",
    ])
    expect(auth.options.emailAndPassword).toMatchObject({
      enabled: true,
      disableSignUp: true,
    })
    expect(auth.options.disabledPaths).toContain("/organization/create")
    expect(auth.options.disabledPaths).toContain("/admin/set-role")
    expect(auth.options.trustedOrigins).toEqual(["http://localhost:3000"])
    expect(auth.options.onAPIError?.errorURL).toBe(
      "http://localhost:3000/login?error=oauth"
    )
  })

  test("trusts additional web origins while retaining primary OAuth error redirects", () => {
    const auth = createAuth(
      {
        NODE_ENV: "development",
        BETTER_AUTH_URL: "https://redive.suicaodex.com",
        BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
        WEB_ORIGIN: "http://localhost:3000",
        WEB_ALLOWED_ORIGINS: [
          "https://sfw.suicaodex.com",
          "http://localhost:3000",
        ],
        DISCORD_CLIENT_ID: "test",
        DISCORD_CLIENT_SECRET: "test",
      } as RuntimeEnv,
      {} as Database
    )
    expect(auth.options.trustedOrigins).toEqual([
      "http://localhost:3000",
      "https://sfw.suicaodex.com",
    ])
    expect(auth.options.onAPIError?.errorURL).toBe(
      "http://localhost:3000/login?error=oauth"
    )
    expect(auth.options.baseURL).toBe("https://redive.suicaodex.com")
    expect(auth.options.advanced?.disableCSRFCheck).not.toBe(true)
    expect(auth.options.advanced?.disableOriginCheck).not.toBe(true)
  })
})
