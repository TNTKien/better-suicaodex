import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import { user } from "../../src/db/auth-schema"
import { createRuntime } from "../../src/runtime"
import type { Runtime } from "../../src/runtime"
import { BusinessCache } from "../../src/shared/cache"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { RuntimeEnv } from "../../src/shared/env"

const noop = () => undefined
const email = `phase3-${randomUUID()}@example.com`
let env: RuntimeEnv
let runtime: Runtime
let app: ReturnType<typeof createApp>

describe.serial("Phase 3 infrastructure", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    }

    env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      REDIS_PREFIX: `${process.env.REDIS_PREFIX ?? "redive:test"}:phase3-test`,
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = createApp({
      auth: runtime.auth,
      logger: noop,
      readiness: runtime.readiness,
      webOrigin: env.WEB_ORIGIN,
    })
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database.delete(user).where(eq(user.email, email))
    await runtime.close()
  })

  test("migration supports a Better Auth session", async () => {
    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({
        name: "Phase 3 Test",
        email,
        password: "phase3-integration-password",
      }),
    })
    expect(signUp.status).toBe(200)

    const cookie = signUp.headers.get("set-cookie")?.split(";", 1)[0]
    expect(cookie).toBeTruthy()
    const session = await app.request("/api/auth/get-session", {
      headers: { Cookie: cookie!, Origin: env.WEB_ORIGIN },
    })
    expect(session.status).toBe(200)
    expect(await session.json()).toMatchObject({ user: { email } })
  })

  test("catalog invalidation changes the cache namespace", async () => {
    if (env.REDIS_CACHE_ENABLED) {
      expect(runtime.cache.status).toBe("healthy")
    }

    const identity = { slug: "phase-3-integration" }
    expect(await runtime.cache.set("manga:detail", identity, { id: 1 })).toBe(
      env.REDIS_CACHE_ENABLED
    )
    if (!env.REDIS_CACHE_ENABLED) return

    expect(await runtime.cache.get("manga:detail", identity)).toEqual({ id: 1 })
    expect(await runtime.cache.invalidateCatalog()).toBe(true)
    expect(await runtime.cache.get("manga:detail", identity)).toBeNull()

    const release = await runtime.cache.acquireLock("homepage", 30)
    expect(release).toBeFunction()
    expect(await runtime.cache.acquireLock("homepage", 30)).toBeNull()
    await release!()
    const releaseAgain = await runtime.cache.acquireLock("homepage", 30)
    expect(releaseAgain).toBeFunction()
    await releaseAgain!()
  })

  test("cache reads fail open when Redis is unavailable", async () => {
    const unavailable = new BusinessCache(
      {
        ...env,
        REDIS_CACHE_ENABLED: true,
        REDIS_URL: "redis://127.0.0.1:1",
        REDIS_CONNECT_TIMEOUT_MS: 100,
        REDIS_RECONNECT_RETRY_MS: 100,
      },
      noop
    )
    await unavailable.connect()

    expect(unavailable.status).toBe("degraded")
    expect(await unavailable.get("homepage", {})).toBeNull()
    const degradedApp = createApp({
      logger: noop,
      readiness: async () => ({
        postgres: "up",
        redis: unavailable.status,
      }),
    })
    const ready = await degradedApp.request("/ready")
    expect(ready.status).toBe(200)
    expect(await ready.json()).toMatchObject({ status: "degraded" })
    await unavailable.close()
  })
})
