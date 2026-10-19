import { isIP } from "node:net"

import { z } from "zod"

const origin = z
  .url()
  .refine((value) => {
    try {
      const url = new URL(value)
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !/[,*]/.test(url.hostname) &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash
      )
    } catch {
      return false
    }
  }, "must be a single HTTP(S) origin without credentials, paths, query, fragment or wildcards")
  .transform((value) => new URL(value).origin)
const additionalWebOrigins = z
  .string()
  .max(16_384)
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  )
  .pipe(z.array(origin).max(100))
  .transform((values) => [...new Set(values)])
const postgresUrl = z
  .url()
  .refine(
    (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    "must use the postgres or postgresql protocol"
  )
const redisUrl = z
  .url()
  .refine(
    (value) => ["redis:", "rediss:"].includes(new URL(value).protocol),
    "must use the redis or rediss protocol"
  )
const assetUrl = z
  .url()
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "must use the http or https protocol"
  )
const positiveInteger = z.coerce.number().int().positive()
const booleanFlag = z.enum(["true", "false"])
const internalApiKey = z
  .string()
  .max(4_096)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") >= 32,
    "must be at least 32 bytes"
  )
const trustedProxyIps = z
  .string()
  .default("")
  .transform((value) => [
    ...new Set(
      value
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean)
    ),
  ])
  .pipe(
    z
      .array(z.string().refine((value) => isIP(value) !== 0, "must be an IP"))
      .max(100)
  )
const hiddenIds = z
  .string()
  .default("")
  .transform((value) => [
    ...new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ])
  .pipe(z.array(z.uuid()).max(1_000))
const storageKeys = [
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_BUCKET",
  "S3_STAGING_BUCKET",
  "S3_ENDPOINT",
  "S3_REGION",
] as const

const RuntimeEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: positiveInteger.max(65_535).default(3001),
    WEB_ORIGIN: origin,
    WEB_ALLOWED_ORIGINS: additionalWebOrigins,
    DATABASE_URL: postgresUrl,
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: origin,
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_GROUP_REVIEW_WEBHOOK_URL: z
      .string()
      .trim()
      .max(2_048)
      .default("")
      .refine(
        (value) =>
          !value ||
          /^https:\/\/discord\.com\/api\/(?:v10\/)?webhooks\/[1-9]\d{16,19}\/[A-Za-z0-9_-]+$/.test(
            value
          ),
        "must be a Discord HTTPS webhook URL without query or fragment"
      )
      .transform((value) => value || undefined),
    DISCORD_GROUP_REVIEW_MENTION_USER_ID: z
      .string()
      .trim()
      .default("")
      .refine(
        (value) => !value || /^[1-9]\d{16,19}$/.test(value),
        "must be a Discord user ID (17–20 digits)"
      )
      .transform((value) => value || undefined),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GITHUB_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
    INTERNAL_API_KEY: internalApiKey.optional(),
    INTERNAL_API_RATE_LIMIT_PER_SECOND: positiveInteger
      .max(10_000)
      .default(100),
    TRUSTED_PROXY_IPS: trustedProxyIps,
    HIDE_R18: booleanFlag
      .default("true")
      .transform((value) => value === "true"),
    HIDDEN_MANGA_IDS: hiddenIds,
    HIDDEN_CHAPTER_IDS: hiddenIds,
    REDIS_CACHE_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    REDIS_URL: redisUrl.optional(),
    REDIS_PREFIX: z.string().min(1).default("redive:development"),
    REDIS_DEFAULT_TTL_SECONDS: positiveInteger.default(30),
    REDIS_CONNECT_TIMEOUT_MS: positiveInteger.default(5_000),
    REDIS_RECONNECT_RETRY_MS: positiveInteger.default(15_000),
    REDIS_CACHE_VERSION_REFRESH_MS: positiveInteger.default(1_500),
    ENDPOINT_CACHE_HOMEPAGE_TTL_SECONDS: positiveInteger.default(45),
    ENDPOINT_CACHE_MANGA_LIST_TTL_SECONDS: positiveInteger.default(180),
    ENDPOINT_CACHE_MANGA_DETAIL_TTL_SECONDS: positiveInteger.default(300),
    ENDPOINT_CACHE_CHAPTER_DETAIL_TTL_SECONDS: positiveInteger.default(450),
    ENDPOINT_CACHE_MANGA_ROUTE_LOOKUP_TTL_SECONDS: positiveInteger.default(300),
    ENDPOINT_CACHE_MANGA_RANKING_TTL_SECONDS: positiveInteger.default(90),
    ASSET_BASE_URL: assetUrl,
    COIN_ENABLED: booleanFlag
      .default("false")
      .transform((value) => value === "true"),
    COIN_EXCLUDED_GROUP_IDS: z
      .string()
      .default("")
      .transform((value) => [
        ...new Set(
          value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        ),
      ])
      .pipe(z.array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/)).max(1_000)),
    SHOP_ENABLED: booleanFlag
      .default("false")
      .transform((value) => value === "true"),
    GACHA_ENABLED: booleanFlag
      .default("false")
      .transform((value) => value === "true"),
    AVATAR_FRAMES_ENABLED: booleanFlag
      .default("false")
      .transform((value) => value === "true"),
    IMAGE_SERVER2_ENABLED: booleanFlag
      .default("false")
      .transform((value) => value === "true"),
    IMAGE_SERVER2_UPLOAD_ENABLED: booleanFlag
      .default("false")
      .transform((value) => value === "true"),
    IMAGE_SERVER2_READ_ENABLED: booleanFlag
      .default("false")
      .transform((value) => value === "true"),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    S3_STAGING_BUCKET: z.string().min(1).optional(),
    S3_ENDPOINT: assetUrl.optional(),
    S3_REGION: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    if (
      Boolean(env.DISCORD_GROUP_REVIEW_WEBHOOK_URL) !==
      Boolean(env.DISCORD_GROUP_REVIEW_MENTION_USER_ID)
    ) {
      context.addIssue({
        code: "custom",
        path: [
          env.DISCORD_GROUP_REVIEW_WEBHOOK_URL
            ? "DISCORD_GROUP_REVIEW_MENTION_USER_ID"
            : "DISCORD_GROUP_REVIEW_WEBHOOK_URL",
        ],
        message: "is required when Discord group review alerts are configured",
      })
    }

    if (env.REDIS_CACHE_ENABLED && !env.REDIS_URL) {
      context.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "is required when REDIS_CACHE_ENABLED=true",
      })
    }

    if (env.REDIS_URL) {
      const redis = new URL(env.REDIS_URL)
      const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"])
      if (redis.protocol === "redis:" && !localHosts.has(redis.hostname)) {
        context.addIssue({
          code: "custom",
          path: ["REDIS_URL"],
          message: "remote connections must use rediss://",
        })
      }
    }

    if (env.S3_STAGING_BUCKET) {
      for (const key of storageKeys) {
        if (!env[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: "is required when S3 storage is configured",
          })
      }
    }

    if (env.NODE_ENV !== "production") return

    for (const key of [
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
    ] as const) {
      if (!env[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "is required in production",
        })
      }
    }
  })

export type RuntimeEnv = z.infer<typeof RuntimeEnvSchema>
const CoinMaintenanceEnvSchema = z.object(RuntimeEnvSchema.shape).pick({
  DATABASE_URL: true,
  COIN_ENABLED: true,
  COIN_EXCLUDED_GROUP_IDS: true,
})
export function parseCoinMaintenanceEnv(source: NodeJS.ProcessEnv) {
  try {
    return CoinMaintenanceEnvSchema.parse({
      ...source,
      DATABASE_URL: source.COIN_MAINTENANCE_DATABASE_URL || source.DATABASE_URL,
    })
  } catch {
    throw new Error(
      "Invalid coin maintenance environment; check DATABASE_URL and COIN_* settings"
    )
  }
}
export type CacheEnv = Pick<
  RuntimeEnv,
  Extract<keyof RuntimeEnv, `REDIS_${string}` | `ENDPOINT_CACHE_${string}`>
>

// Worker/operator do not initialize auth or require OAuth/S3 write credentials.
const ImageServer2EnvSchema = z
  .object(RuntimeEnvSchema.shape)
  .pick({
    DATABASE_URL: true,
    ASSET_BASE_URL: true,
    IMAGE_SERVER2_ENABLED: true,
    IMAGE_SERVER2_UPLOAD_ENABLED: true,
    IMAGE_SERVER2_READ_ENABLED: true,
    HIDE_R18: true,
    HIDDEN_MANGA_IDS: true,
    HIDDEN_CHAPTER_IDS: true,
    REDIS_CACHE_ENABLED: true,
    REDIS_URL: true,
    REDIS_PREFIX: true,
    REDIS_DEFAULT_TTL_SECONDS: true,
    REDIS_CONNECT_TIMEOUT_MS: true,
    REDIS_RECONNECT_RETRY_MS: true,
    REDIS_CACHE_VERSION_REFRESH_MS: true,
    ENDPOINT_CACHE_HOMEPAGE_TTL_SECONDS: true,
    ENDPOINT_CACHE_MANGA_LIST_TTL_SECONDS: true,
    ENDPOINT_CACHE_MANGA_DETAIL_TTL_SECONDS: true,
    ENDPOINT_CACHE_CHAPTER_DETAIL_TTL_SECONDS: true,
    ENDPOINT_CACHE_MANGA_ROUTE_LOOKUP_TTL_SECONDS: true,
    ENDPOINT_CACHE_MANGA_RANKING_TTL_SECONDS: true,
  })
  .extend({
    TIKTOK_COOKIE: z.string().min(1).optional(),
    TIKTOK_CSRF_TOKEN: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    if (env.REDIS_CACHE_ENABLED && !env.REDIS_URL)
      context.addIssue({
        code: "custom",
        path: ["REDIS_URL"],
        message: "is required when cache is enabled",
      })
    if (env.REDIS_URL) {
      const url = new URL(env.REDIS_URL)
      if (
        url.protocol === "redis:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ) {
        context.addIssue({
          code: "custom",
          path: ["REDIS_URL"],
          message: "remote connections must use rediss://",
        })
      }
    }
  })

export function parseImageServer2Env(source: NodeJS.ProcessEnv) {
  const result = ImageServer2EnvSchema.safeParse(source)
  if (!result.success)
    throw new Error(
      `Invalid image server environment: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`
    )
  return result.data
}

export function parseRuntimeEnv(source: NodeJS.ProcessEnv): RuntimeEnv {
  const result = RuntimeEnvSchema.safeParse(source)
  if (result.success) return result.data

  const issues = result.error.issues
    .map(
      (issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`
    )
    .join("; ")
  throw new Error(`Invalid environment configuration: ${issues}`)
}
