import { describe, expect, test } from "bun:test"

import { createApp } from "../../src/app"
import { manga, user, userProfile } from "../../src/db/schema"
import { isChapterPageUpload } from "../../src/features/groups/chapter"
import { PageQuerySchema } from "../../src/shared/contract"
import { resolveClientIp } from "../../src/shared/rate-limit"

const noop = () => undefined

describe("API contract", () => {
  test("serves operations endpoints and OpenAPI with a request ID", async () => {
    const app = createApp({ logger: noop })
    const health = await app.request("/health")
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ status: "ok" })
    expect(health.headers.get("x-request-id")).toBeTruthy()
    expect(health.headers.get("x-robots-tag")).toBe("noindex, nofollow")

    const ready = await app.request("/ready")
    expect(ready.status).toBe(200)
    expect(await ready.json()).toEqual({
      status: "ready",
      dependencies: { postgres: "up", redis: "disabled" },
    })

    const spec = (await (await app.request("/openapi.json")).json()) as {
      openapi: string
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown> }
    }
    expect(spec.openapi).toBe("3.1.0")
    expect(spec.paths).toHaveProperty("/health")
    expect(spec.paths).toHaveProperty("/ready")
    expect(spec.components.schemas).toHaveProperty("PageQuery")
    expect(spec.components.schemas).toHaveProperty("ApiError")
    expect(spec.components.schemas.Id).toMatchObject({
      type: "string",
      format: "uuid",
    })
  })

  test("serves the Scalar API reference", async () => {
    const app = createApp({ logger: noop })
    const response = await app.request("/docs")

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(await response.text()).toContain("/openapi.json")
  })

  test("reports PostgreSQL failure as not ready", async () => {
    const app = createApp({
      logger: noop,
      readiness: async () => ({ postgres: "down", redis: "degraded" }),
    })
    const response = await app.request("/ready")

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      status: "not_ready",
      dependencies: { postgres: "down", redis: "degraded" },
    })
  })

  test("uses explicit credentialed CORS", async () => {
    const app = createApp({
      logger: noop,
      webOrigin: "http://localhost:3000",
    })
    const allowed = await app.request("/health", {
      headers: { Origin: "http://localhost:3000" },
    })
    const rejected = await app.request("/health", {
      headers: { Origin: "https://example.com" },
    })

    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    )
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true")
    expect(rejected.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("uses the standard error envelope", async () => {
    const app = createApp({ logger: noop })
    const response = await app.request("/missing")
    const requestId = response.headers.get("x-request-id")

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
        requestId,
      },
    })
  })

  test("allows primary/additional CORS origins and rejects unlisted GET/preflight origins", async () => {
    const app = createApp({
      logger: noop,
      webOrigin: "http://localhost:3000",
      allowedWebOrigins: ["https://sfw.suicaodex.com"],
    })
    for (const origin of [
      "http://localhost:3000",
      "https://sfw.suicaodex.com",
    ]) {
      for (const method of ["GET", "OPTIONS"]) {
        const response = await app.request("/health", {
          method,
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "content-type",
          },
        })
        expect(response.status).toBe(method === "GET" ? 200 : 204)
        expect(response.headers.get("access-control-allow-origin")).toBe(origin)
        expect(response.headers.get("access-control-allow-credentials")).toBe(
          "true"
        )
        expect(response.headers.get("vary")).toContain("Origin")
      }
    }
    for (const origin of [
      "null",
      "https://sfw.suicaodex.com.evil.test",
      "https://other.suicaodex.com",
    ])
      for (const method of ["GET", "OPTIONS"]) {
        const response = await app.request("/health", {
          method,
          headers: { Origin: origin, "Access-Control-Request-Method": "GET" },
        })
        expect(response.headers.get("access-control-allow-origin")).toBeNull()
      }
    const noOrigin = await app.request("/health")
    expect(noOrigin.status).toBe(200)
    expect(noOrigin.headers.get("access-control-allow-origin")).toBeNull()
  })

  test("rate limits public requests and skips preflight", async () => {
    const app = createApp({ logger: noop, rateLimit: {} })
    await Promise.all(
      Array.from({ length: 12 }, () =>
        app.request("/health", { method: "OPTIONS" })
      )
    )
    const responses = await Promise.all(
      Array.from({ length: 11 }, () => app.request("/health"))
    )

    expect(responses.filter(({ status }) => status === 200)).toHaveLength(10)
    const limited = responses.find(({ status }) => status === 429)!
    expect(await limited.json()).toMatchObject({
      error: { code: "RATE_LIMITED" },
    })
    expect(limited.headers.get("retry-after")).toBeTruthy()
  })

  test("admin reads keep a bounded independent quota during public request bursts", async () => {
    const logs: Array<Record<string, unknown> | undefined> = []
    const app = createApp({
      logger: (_level, event, fields) => {
        if (event === "http.request") logs.push(fields)
      },
      rateLimit: {},
    })
    const publicResponses = await Promise.all(
      Array.from({ length: 11 }, () => app.request("/health"))
    )
    expect(publicResponses.filter(({ status }) => status === 200)).toHaveLength(
      10
    )
    expect(publicResponses[10]!.status).toBe(429)

    // No catalog is registered: 404 means the limiter allowed the request through.
    const paths = [
      "/v1/admin/groups?status=pending&page=1&limit=1",
      "/v1/admin/image-server2/worker",
      "/v1/admin/image-server2/mangas?page=1&limit=20",
    ]
    const adminResponses = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        app.request(paths[index % paths.length]!)
      )
    )
    expect(adminResponses.filter(({ status }) => status === 404)).toHaveLength(
      10
    )
    expect(adminResponses[10]!.status).toBe(429)
    expect(adminResponses[10]!.headers.get("retry-after")).toBeTruthy()
    expect(logs).toContainEqual(
      expect.objectContaining({
        rateLimitPolicy: "admin-read",
        rateLimitBlockedBy: "admin-read",
        status: 429,
      })
    )

    // Admin writes keep the fallback quota; private user APIs have their own bucket.
    expect(
      (await app.request("/v1/admin/image-server2/worker", { method: "PUT" }))
        .status
    ).toBe(429)
    expect((await app.request("/v1/me")).status).toBe(404)
    expect((await app.request("/v1/administrator/worker")).status).toBe(429)

    const reverse = createApp({ logger: noop, rateLimit: {} })
    await Promise.all(
      Array.from({ length: 11 }, () => reverse.request(paths[1]!))
    )
    expect((await reverse.request("/health")).status).toBe(200)
  })

  test("keeps the comment limiter independent", async () => {
    const internalApiKey = "internal-test-key-".padEnd(32, "x")
    const logs: Array<Record<string, unknown> | undefined> = []
    const app = createApp({
      logger: (_level, event, fields) => {
        if (event === "http.request") logs.push(fields)
      },
      rateLimit: { internalApiKey },
    })
    const path = "/v1/manga/00000000-0000-4000-8000-000000000000/comments"
    const options = {
      method: "POST",
      headers: { "X-Internal-API-Key": internalApiKey },
    }
    expect((await app.request(path, options)).status).toBe(404)
    expect((await app.request(path, options)).status).toBe(429)
    expect(logs.at(-1)).toEqual(
      expect.objectContaining({
        rateLimitPolicy: "comment",
        rateLimitCredential: "valid",
        rateLimitBlockedBy: "comment",
      })
    )
  })

  test("trusts forwarded client IPs only behind configured proxies", () => {
    expect(
      resolveClientIp({
        remoteAddress: "198.51.100.10",
        forwardedFor: "203.0.113.7",
        cfConnectingIp: "203.0.113.8",
        realIp: "203.0.113.9",
        trustedProxyIps: ["10.0.0.1"],
      })
    ).toBe("198.51.100.10")
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        forwardedFor: "192.0.2.1, 203.0.113.7, 10.0.0.1",
        trustedProxyIps: ["10.0.0.1", "10.0.0.2"],
      })
    ).toBe("203.0.113.7")
    expect(
      resolveClientIp({
        remoteAddress: "10.0.0.2",
        cfConnectingIp: "203.0.113.8",
        trustedProxyIps: ["10.0.0.2"],
      })
    ).toBe("203.0.113.8")
  })

  test("does not expose internal errors in production", async () => {
    const logs: unknown[] = []
    const app = createApp({
      production: true,
      logger: (_level, _event, fields) => logs.push(fields),
      readiness: async () => {
        throw new Error("private database detail")
      },
    })
    const response = await app.request("/ready")
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toMatchObject({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    })
    expect(JSON.stringify({ body, logs })).not.toContain(
      "private database detail"
    )
  })

  test("bounds page queries", () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
    expect(PageQuerySchema.safeParse({ page: 0, limit: 101 }).success).toBe(
      false
    )
  })

  test("recognizes both chapter page upload routes", () => {
    expect(
      isChapterPageUpload(
        "POST",
        "/v1/contribution/groups/group/manga/manga/chapter-uploads/session/pages"
      )
    ).toBe(true)
    expect(
      isChapterPageUpload(
        "POST",
        "/v1/contribution/groups/group/manga/manga/chapters/chapter/uploads/session/pages"
      )
    ).toBe(true)
    expect(
      isChapterPageUpload(
        "DELETE",
        "/v1/contribution/groups/group/manga/manga/chapter-uploads/session/pages"
      )
    ).toBe(false)
  })

  test("uses UUIDs for domain IDs without changing Better Auth IDs", () => {
    expect(manga.id.columnType).toBe("PgUUID")
    expect("legacyId" in manga).toBe(false)
    expect(user.id.columnType).toBe("PgText")
    expect(userProfile.userId.columnType).toBe("PgText")
  })
  test("uses an isolated service bucket only for allowlisted public reads", async () => {
    const internalApiKey = "internal-test-key-".padEnd(32, "x")
    const logs: Array<Record<string, unknown> | undefined> = []
    const app = createApp({
      logger: (_level, event, fields) => {
        if (event === "http.request") logs.push(fields)
      },
      rateLimit: {
        internalApiKey,
        serviceLimitPerSecond: 9,
      },
    })
    const serviceHeaders = { "X-Internal-API-Key": internalApiKey }
    const servicePaths = ["/v1/manga", "/v1/comments/recent"]
    const serviceResponses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        app.request(servicePaths[index % servicePaths.length]!, {
          headers: serviceHeaders,
        })
      )
    )

    expect(
      serviceResponses.slice(0, 9).every(({ status }) => status === 404)
    ).toBe(true)
    expect(serviceResponses[9]!.status).toBe(429)
    expect(serviceResponses[9]!.headers.get("retry-after")).toBeTruthy()

    const publicResponses = await Promise.all(
      Array.from({ length: 11 }, () => app.request("/health"))
    )
    expect(publicResponses.filter(({ status }) => status === 200)).toHaveLength(
      10
    )
    expect(publicResponses.filter(({ status }) => status === 429)).toHaveLength(
      1
    )

    expect(logs).toContainEqual(
      expect.objectContaining({
        rateLimitPolicy: "service",
        rateLimitCredential: "valid",
        rateLimitBlockedBy: "service",
        status: 429,
      })
    )
    expect(logs).toContainEqual(
      expect.objectContaining({
        rateLimitPolicy: "public",
        rateLimitCredential: "absent",
        rateLimitBlockedBy: "public",
        status: 429,
      })
    )
    expect(JSON.stringify(logs)).not.toContain(internalApiKey)

    const scopedApp = createApp({
      logger: noop,
      rateLimit: { internalApiKey, serviceLimitPerSecond: 9 },
    })
    const authResponses = await Promise.all(
      Array.from({ length: 11 }, () =>
        scopedApp.request("/api/auth/get-session", {
          headers: serviceHeaders,
        })
      )
    )
    expect(authResponses.filter(({ status }) => status === 429)).toHaveLength(1)

    const privateApp = createApp({
      logger: noop,
      rateLimit: { internalApiKey, serviceLimitPerSecond: 9 },
    })
    const privateResponses = await Promise.all(
      Array.from({ length: 11 }, () =>
        privateApp.request("/v1/me", { headers: serviceHeaders })
      )
    )
    expect(
      privateResponses.filter(({ status }) => status === 429)
    ).toHaveLength(1)

    const invalidApp = createApp({
      logger: noop,
      rateLimit: { internalApiKey },
    })
    const invalidResponses = await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        invalidApp.request("/v1/manga", {
          headers: {
            "X-Internal-API-Key":
              index % 2 ? "short" : internalApiKey.replace(/x$/, "y"),
          },
        })
      )
    )
    expect(
      invalidResponses.filter(({ status }) => status === 429)
    ).toHaveLength(1)
    expect(invalidResponses.every(({ status }) => status !== 500)).toBe(true)

    const unconfiguredApp = createApp({ logger: noop, rateLimit: {} })
    const unconfiguredResponses = await Promise.all(
      Array.from({ length: 11 }, () =>
        unconfiguredApp.request("/v1/manga", { headers: serviceHeaders })
      )
    )
    expect(
      unconfiguredResponses.filter(({ status }) => status === 429)
    ).toHaveLength(1)
  })
})
