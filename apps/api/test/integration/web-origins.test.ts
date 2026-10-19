import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import { user } from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"

const primary = "https://suicaodex.example.test"
const additional = "https://sfw.suicaodex.example.test"
const email = `web-origins-${randomUUID()}@example.test`
const password = "web-origins-test-password"
const noop = () => undefined
setDefaultTimeout(120_000)

let runtime: Runtime | undefined
let app: ReturnType<typeof createApp>
let actorId = ""
let cookie = ""

function headers(origin?: string) {
  return {
    Cookie: cookie,
    "Content-Type": "application/json",
    ...(origin === undefined ? {} : { Origin: origin }),
  }
}

describe.serial("web origin allowlist integration", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL)
      throw new Error("Integration tests require a separate test database")
    const env = parseRuntimeEnv({
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      WEB_ORIGIN: primary,
      WEB_ALLOWED_ORIGINS: additional,
      BETTER_AUTH_URL: "https://redive.example.test",
      BETTER_AUTH_SECRET: "web-origins-integration-only-secret-with-32-bytes",
      DISCORD_CLIENT_ID: "test",
      DISCORD_CLIENT_SECRET: "test",
      ASSET_BASE_URL: "https://assets.example.test",
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    // Better Auth skips origin checks under bun:test by default. Exercise the
    // production guard on this fixture only, without changing application options.
    const authContext = await runtime.auth.$context
    authContext.skipOriginCheck = false
    expect(authContext.skipCSRFCheck).toBe(false)
    app = createApp({
      account: { database: runtime.database },
      avatarFramesEnabled: true,
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: runtime.cache,
        database: runtime.database,
      },
      logger: noop,
      webOrigin: env.WEB_ORIGIN,
      allowedWebOrigins: env.WEB_ALLOWED_ORIGINS,
    })
    const signup = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { Origin: additional, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Origin fixture" }),
    })
    expect(signup.status).toBe(200)
    actorId = ((await signup.json()) as { user: { id: string } }).user.id
    cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    expect(cookie).toBeTruthy()
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, actorId))
  })

  afterAll(async () => {
    if (!runtime) return
    try {
      await runtime.database.delete(user).where(eq(user.email, email))
    } finally {
      await runtime.close()
    }
  })

  test("Better Auth accepts both origins and callback URLs but rejects an untrusted origin", async () => {
    for (const origin of [primary, additional]) {
      const response = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: headers(origin),
        body: JSON.stringify({
          email,
          password,
          callbackURL: `${origin}/manage/account`,
        }),
      })
      expect(response.status).toBe(200)
      expect(response.headers.get("access-control-allow-origin")).toBe(origin)
      expect(response.headers.get("set-cookie")).toBeTruthy()
    }
    const denied = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: headers("https://evil.example.test"),
      body: JSON.stringify({ email, password }),
    })
    expect(denied.status).toBe(403)
    expect(denied.headers.get("access-control-allow-origin")).toBeNull()
    const callback = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: headers(additional),
      body: JSON.stringify({
        email,
        password,
        callbackURL: "https://evil.example.test/login",
      }),
    })
    expect(callback.status).toBe(403)
  })

  test("profile updates and avatar removal use the same exact allowlist", async () => {
    for (const origin of [primary, additional]) {
      const updated = await app.request("/v1/me/profile", {
        method: "PATCH",
        headers: headers(origin),
        body: JSON.stringify({ bio: origin }),
      })
      expect(updated.status).toBe(200)
      expect((await updated.json()).profile.bio).toBe(origin)
      const removed = await app.request("/v1/me/avatar", {
        method: "DELETE",
        headers: headers(origin),
      })
      expect(removed.status).toBe(200)
      expect((await removed.json()).user.image).toBeNull()
    }
    for (const origin of [undefined, "null", "https://evil.example.test"]) {
      const denied = await app.request("/v1/me/profile", {
        method: "PATCH",
        headers: headers(origin),
        body: JSON.stringify({ bio: "must not be saved" }),
      })
      expect(denied.status).toBe(403)
      expect((await denied.json()).error.code).toBe("INVALID_ORIGIN")
      const removed = await app.request("/v1/me/avatar", {
        method: "DELETE",
        headers: headers(origin),
      })
      expect(removed.status).toBe(403)
      expect((await removed.json()).error.code).toBe("INVALID_ORIGIN")
    }
    const current = await app.request("/v1/me", {
      headers: headers(additional),
    })
    expect((await current.json()).profile.bio).toBe(additional)
  })

  test("avatar upload checks the allowlist before accessing media storage", async () => {
    for (const origin of [
      primary,
      additional,
      undefined,
      "null",
      "https://evil.example.test",
    ]) {
      const body = new FormData()
      body.set(
        "avatar",
        new File(["fixture"], "fixture.webp", { type: "image/webp" })
      )
      const response = await app.request("/v1/me/avatar", {
        method: "POST",
        headers: {
          Cookie: cookie,
          ...(origin === undefined ? {} : { Origin: origin }),
        },
        body,
      })
      const allowed = origin === primary || origin === additional
      expect(response.status).toBe(allowed ? 503 : 403)
      expect((await response.json()).error.code).toBe(
        allowed ? "MEDIA_STORAGE_UNAVAILABLE" : "INVALID_ORIGIN"
      )
    }
  })

  test("management and avatar-frame writes retain CSRF guards", async () => {
    const endpoints = [
      ["POST", "/v1/contribution/groups"],
      ["PUT", `/v1/admin/users/${actorId}/status`],
      ["POST", "/v1/admin/system-notices"],
      ["PUT", "/v1/admin/image-server2/worker"],
      ["POST", "/v1/admin/avatar-frames"],
      ["POST", "/v1/admin/avatar-frame-topics"],
      ["PUT", "/v1/me/avatar-frame"],
    ]
    for (const [method, path] of endpoints) {
      for (const origin of [
        primary,
        additional,
        undefined,
        "null",
        "https://evil.example.test",
      ]) {
        const response = await app.request(path!, {
          method,
          headers: headers(origin),
          // Invalid input reaches validation only after authentication and origin checks.
          body: "{}",
        })
        const allowed = origin === primary || origin === additional
        expect(response.status).toBe(allowed ? 400 : 403)
        expect((await response.json()).error.code).toBe(
          allowed ? "VALIDATION_ERROR" : "INVALID_ORIGIN"
        )
      }
    }
  })

  test("avatar frame removal accepts both origins and rejects missing/untrusted origins", async () => {
    for (const origin of [
      primary,
      additional,
      undefined,
      "null",
      "https://evil.example.test",
    ]) {
      const response = await app.request("/v1/me/avatar-frame", {
        method: "DELETE",
        headers: headers(origin),
      })
      const allowed = origin === primary || origin === additional
      expect(response.status).toBe(allowed ? 200 : 403)
      expect(response.headers.get("cache-control")).toBe("private, no-store")
      if (!allowed)
        expect((await response.json()).error.code).toBe("INVALID_ORIGIN")
    }
  })

  test("an allowed origin does not bypass authentication or admin authorization", async () => {
    const anonymous = await app.request("/v1/me/profile", {
      method: "PATCH",
      headers: { Origin: additional, "Content-Type": "application/json" },
      body: JSON.stringify({ bio: "not authenticated" }),
    })
    expect(anonymous.status).toBe(401)
    await runtime!.database
      .update(user)
      .set({ role: "user" })
      .where(eq(user.id, actorId))
    const forbidden = await app.request("/v1/admin/system-notices", {
      method: "POST",
      headers: headers(additional),
      body: "{}",
    })
    expect(forbidden.status).toBe(403)
    expect((await forbidden.json()).error.code).toBe("FORBIDDEN")
  })
})
