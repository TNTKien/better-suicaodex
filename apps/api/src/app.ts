import { createRoute, OpenAPIHono } from "@hono/zod-openapi"
import { Scalar } from "@scalar/hono-api-reference"
import type { MiddlewareHandler } from "hono"
import { cors } from "hono/cors"
import { requestId } from "hono/request-id"
import { HTTPException } from "hono/http-exception"

import type { Auth } from "./features/account/auth.js"
import { freshSessionUser } from "./features/account/guard.js"
import { registerProfileRoutes } from "./features/account/routes.js"
import { registerAvatarFrameRoutes } from "./features/avatar-frames/routes.js"
import { registerShopRoutes } from "./features/shop/routes.js"
import type { ProfileDependencies } from "./features/account/routes.js"
import { registerCatalogRoutes } from "./features/catalog/routes.js"
import { registerSitemapRoutes } from "./features/catalog/sitemap.js"
import type { CatalogDependencies } from "./features/catalog/routes.js"
import { registerCommentRoutes } from "./features/comments/routes.js"
import { registerReadingRoutes } from "./features/reading/routes.js"
import { registerLibraryRoutes } from "./features/library/routes.js"
import { registerNotificationRoutes } from "./features/notifications/routes.js"
import { registerSystemNoticeRoutes } from "./features/system-notices/routes.js"
import { registerGroupRoutes } from "./features/groups/routes.js"
import type { GroupReviewWebhook } from "./features/groups/review-webhook.js"
import { registerImageServer2Routes } from "./features/image-server2/routes.js"
import { registerModerationRoutes } from "./features/moderation/routes.js"
import { GroupError, requireGroupAdmin } from "./features/groups/service.js"
import { registerChapterRoutes } from "./features/groups/chapter.js"
import { registerRankingRoutes } from "./features/ranking/routes.js"
import { registerViewRoutes } from "./features/views/routes.js"
import {
  apiError,
  ApiErrorSchema,
  HealthSchema,
  IdSchema,
  PageMetaSchema,
  PageQuerySchema,
  ReadinessSchema,
  SlugSchema,
  SortDirectionSchema,
  TimestampSchema,
} from "./shared/contract.js"
import { errorFields, logger as defaultLogger } from "./shared/logger.js"
import type { Logger } from "./shared/logger.js"
import type { ChapterStorage, CoverStorage } from "./shared/storage.js"
import { commentRateLimiter, globalRateLimiter } from "./shared/rate-limit.js"
import type { GlobalRateLimitOptions } from "./shared/rate-limit.js"
import { allowedWebOrigins } from "./shared/web-origins.js"
import { CoinError } from "./features/coin/contract.js"
import { createCoinService, type CoinService } from "./features/coin/service.js"
import { registerCoinRoutes } from "./features/coin/routes.js"

type Readiness = () => Promise<{
  postgres: "up" | "down"
  redis: "healthy" | "degraded" | "disabled"
}>

type AppOptions = {
  account?: Pick<ProfileDependencies, "database">
  auth?: Auth
  catalog?: CatalogDependencies
  coverStorage?: CoverStorage
  chapterStorage?: ChapterStorage
  imageServer2UploadEnabled?: boolean
  avatarFramesEnabled?: boolean
  shopEnabled?: boolean
  gachaEnabled?: boolean
  coin?: CoinService
  coinExcludedGroupIds?: readonly string[]
  commentNow?: () => Date
  logger?: Logger
  groupReviewWebhook?: GroupReviewWebhook
  production?: boolean
  readiness?: Readiness
  rateLimit?: GlobalRateLimitOptions
  webOrigin?: string
  allowedWebOrigins?: readonly string[]
  viewTracking?: {
    now?: () => Date
    secret: string
    secureCookie?: boolean
  }
}

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["operations"],
  responses: {
    200: {
      content: { "application/json": { schema: HealthSchema } },
      description: "The API process is running",
    },
  },
})

const readinessRoute = createRoute({
  method: "get",
  path: "/ready",
  tags: ["operations"],
  responses: {
    200: {
      content: { "application/json": { schema: ReadinessSchema } },
      description: "Required dependencies are available",
    },
    503: {
      content: { "application/json": { schema: ReadinessSchema } },
      description: "PostgreSQL is unavailable",
    },
  },
})
const shopPath =
  /^\/v1\/(?:(?:(?:me|admin)\/)?shop(?:\/|$)|admin\/avatar-frames\/[^/]+\/shop$)/

export function createApp(options: AppOptions = {}) {
  const webOrigins = allowedWebOrigins(
    options.webOrigin ?? "http://localhost:3000",
    options.allowedWebOrigins
  )
  const log = options.logger ?? defaultLogger
  const production = options.production ?? false
  const readiness =
    options.readiness ??
    (async () => ({ postgres: "up" as const, redis: "disabled" as const }))
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          apiError(
            "VALIDATION_ERROR",
            "Request validation failed",
            c.get("requestId"),
            result.error.issues.map((issue) => ({
              path: issue.path.join(".") || "$",
              message: issue.message,
            }))
          ),
          400
        )
      }
    },
  })

  app.use("*", requestId())
  app.use("*", async (c, next) => {
    c.header("X-Robots-Tag", "noindex, nofollow")
    // Set before CORS/rate limiting so early errors cannot be cached either.
    if (shopPath.test(c.req.path))
      c.header(
        "Cache-Control",
        c.req.path.startsWith("/v1/shop/") ? "no-store" : "private, no-store"
      )
    await next()
  })
  app.use(
    "*",
    cors({
      origin: webOrigins,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      exposeHeaders: [
        "X-Request-ID",
        "RateLimit-Limit",
        "RateLimit-Remaining",
        "RateLimit-Reset",
        "RateLimit-Policy",
        "Retry-After",
      ],
      credentials: true,
      maxAge: 600,
    })
  )
  app.use("*", async (c, next) => {
    const startedAt = performance.now()
    await next()
    log("info", "http.request", {
      requestId: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      rateLimitPolicy: c.get("rateLimitPolicy") ?? null,
      rateLimitCredential: c.get("rateLimitCredential") ?? null,
      rateLimitBlockedBy: c.get("rateLimitBlockedBy") ?? null,
    })
  })

  if (options.rateLimit) {
    app.use("*", globalRateLimiter(options.rateLimit))
    if (!options.coin?.enabled)
      app.use(
        "*",
        commentRateLimiter(options.auth, options.rateLimit.trustedProxyIps)
      )
  }

  if (options.auth) {
    app.all("/api/auth/*", (c) => options.auth!.handler(c.req.raw))
  }

  if (options.account) {
    registerShopRoutes(app, {
      ...options.account,
      auth: options.auth,
      coin: options.coin ?? createCoinService(),
      webOrigin: webOrigins,
      assetBaseUrl: options.catalog?.assetBaseUrl,
      shopEnabled: options.shopEnabled ?? false,
      gachaEnabled: options.gachaEnabled ?? false,
      coinEnabled: options.coin?.enabled ?? false,
      avatarFramesEnabled: options.avatarFramesEnabled ?? false,
    })
    registerCoinRoutes(app, {
      ...options.account,
      auth: options.auth,
      coin: options.coin ?? createCoinService(),
      excludedGroupIds: options.coinExcludedGroupIds ?? [],
      webOrigin: webOrigins,
    })
    registerProfileRoutes(app, {
      ...options.account,
      assetBaseUrl: options.catalog?.assetBaseUrl,
      avatarFramesEnabled: options.avatarFramesEnabled ?? false,
      auth: options.auth,
      hideR18: options.catalog?.hideR18,
      hiddenMangaIds: options.catalog?.hiddenMangaIds,
      hiddenChapterIds: options.catalog?.hiddenChapterIds,
      logger: log,
      storage: options.coverStorage,
      webOrigin: webOrigins,
    })
    registerAvatarFrameRoutes(app, {
      ...options.account,
      assetBaseUrl: options.catalog?.assetBaseUrl,
      avatarFramesEnabled: options.avatarFramesEnabled ?? false,
      auth: options.auth,
      cache: options.catalog?.cache,
      storage: options.coverStorage,
      logger: log,
      webOrigin: webOrigins,
    })
  }

  app.openAPIRegistry.register("Id", IdSchema)
  app.openAPIRegistry.register("Slug", SlugSchema)
  app.openAPIRegistry.register("Timestamp", TimestampSchema)
  app.openAPIRegistry.register("PageQuery", PageQuerySchema)
  app.openAPIRegistry.register("PageMeta", PageMetaSchema)
  app.openAPIRegistry.register("SortDirection", SortDirectionSchema)
  app.openAPIRegistry.register("ApiError", ApiErrorSchema)

  app.openapi(healthRoute, (c) => c.json({ status: "ok" as const }, 200))
  app.openapi(readinessRoute, async (c) => {
    const dependencies = await readiness()
    if (dependencies.postgres === "down") {
      return c.json({ status: "not_ready" as const, dependencies }, 503)
    }

    return c.json(
      {
        status:
          dependencies.redis === "degraded"
            ? ("degraded" as const)
            : ("ready" as const),
        dependencies,
      },
      200
    )
  })

  if (options.catalog) {
    registerImageServer2Routes(app, {
      ...options.catalog,
      auth: options.auth,
      webOrigin: webOrigins,
      uploadConfigured: options.imageServer2UploadEnabled ?? false,
    })
    registerModerationRoutes(app, {
      assetBaseUrl: options.catalog.assetBaseUrl,
      avatarFramesEnabled: options.avatarFramesEnabled ?? false,
      auth: options.auth,
      cache: options.catalog.cache,
      database: options.catalog.database,
      webOrigin: webOrigins,
    })
    registerCatalogRoutes(app, options.catalog)
    registerSitemapRoutes(app, options.catalog)
    registerCommentRoutes(app, {
      ...options.catalog,
      avatarFramesEnabled: options.avatarFramesEnabled ?? false,
      auth: options.auth,
      coin: options.coin,
      now: options.commentNow,
    })
    registerReadingRoutes(app, { ...options.catalog, auth: options.auth })
    registerLibraryRoutes(app, { ...options.catalog, auth: options.auth })
    registerNotificationRoutes(app, { ...options.catalog, auth: options.auth })
    registerSystemNoticeRoutes(app, {
      auth: options.auth,
      database: options.catalog.database,
      webOrigin: webOrigins,
    })
    registerGroupRoutes(app, {
      ...options.catalog,
      avatarFramesEnabled: options.avatarFramesEnabled ?? false,
      auth: options.auth,
      logger: log,
      groupReviewWebhook: options.groupReviewWebhook,
      storage: options.coverStorage,
      stagingStorage: options.chapterStorage,
      webOrigin: webOrigins,
    })
    registerRankingRoutes(app, options.catalog)
    registerViewRoutes(app, {
      ...options.catalog,
      ...options.viewTracking,
      coin: options.coin,
      excludedCoinGroupIds: options.coinExcludedGroupIds,
    })
    registerChapterRoutes(app, {
      assetBaseUrl: options.catalog.assetBaseUrl,
      cache: options.catalog.cache,
      database: options.catalog.database,
      hiddenChapterIds: options.catalog.hiddenChapterIds,
      hiddenMangaIds: options.catalog.hiddenMangaIds,
      hideR18: options.catalog.hideR18,
      logger: log,
      storage: options.chapterStorage,
    })
  }

  if (production) {
    const documentationGuard: MiddlewareHandler = async (c, next) => {
      c.header("Cache-Control", "private, no-store")
      if (!options.auth || !options.catalog)
        return c.json(
          apiError(
            "SERVICE_UNAVAILABLE",
            "API documentation is unavailable",
            c.get("requestId")
          ),
          503
        )

      const currentUser = await freshSessionUser(
        options.auth,
        c.req.raw.headers
      )
      if (!currentUser)
        return c.json(
          apiError(
            "UNAUTHORIZED",
            "Authentication is required",
            c.get("requestId")
          ),
          401
        )
      await requireGroupAdmin(options.catalog.database, currentUser.id)
      await next()
    }
    app.use("/docs", documentationGuard)
    app.use("/openapi.json", documentationGuard)
  }

  app.get(
    "/docs",
    Scalar({
      url: "/openapi.json",
      pageTitle: "SuicaoDex Re:Dive API",
    })
  )

  app.doc31("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "SuicaoDex Re:Dive API", version: "0.1.0" },
  })

  app.notFound((c) =>
    c.json(apiError("NOT_FOUND", "Resource not found", c.get("requestId")), 404)
  )

  app.onError((error, c) => {
    if (error instanceof CoinError)
      return c.json(
        apiError(error.code, error.message, c.get("requestId")),
        error.status
      )
    if (error instanceof HTTPException && error.status === 400)
      return c.json(
        apiError(
          "VALIDATION_ERROR",
          "Malformed request body",
          c.get("requestId")
        ),
        400
      )
    if (error instanceof GroupError)
      return c.json(
        apiError(error.code, error.message, c.get("requestId"), error.details),
        error.status
      )
    const cause = error.cause ?? error
    if (
      /^\/v1\/(?:contribution\/groups|admin\/groups)(?:\/|$)/.test(
        c.req.path
      ) &&
      typeof cause === "object" &&
      cause &&
      "code" in cause &&
      cause.code === "23505"
    )
      return c.json(
        apiError(
          "GROUP_CONFLICT",
          "Group membership or slug changed; reload and retry",
          c.get("requestId")
        ),
        409
      )
    log("error", "http.unhandled_error", {
      requestId: c.get("requestId"),
      ...errorFields(error, production),
    })
    if (shopPath.test(c.req.path))
      return c.json(
        apiError(
          "SERVICE_UNAVAILABLE",
          "Shop is temporarily unavailable; retry with the same operation ID or check the receipt",
          c.get("requestId")
        ),
        503
      )
    return c.json(
      apiError(
        "INTERNAL_ERROR",
        "An unexpected error occurred",
        c.get("requestId")
      ),
      500
    )
  })

  return app
}

export default createApp()
