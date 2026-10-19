import { serve } from "@hono/node-server"

import { createApp } from "./app.js"
import { startChapterFinalizeWorker } from "./features/groups/chapter.js"
import { createRuntime } from "./runtime.js"
import { parseRuntimeEnv } from "./shared/env.js"
import { errorFields, logger } from "./shared/logger.js"

async function main() {
  const env = parseRuntimeEnv(process.env)
  const runtime = await createRuntime(env, logger)
  const app = createApp({
    account: { database: runtime.database },
    auth: runtime.auth,
    chapterStorage: runtime.chapterStorage,
    coverStorage: runtime.coverStorage,
    avatarFramesEnabled: env.AVATAR_FRAMES_ENABLED,
    shopEnabled: env.SHOP_ENABLED,
    gachaEnabled: env.GACHA_ENABLED,
    coin: runtime.coin,
    coinExcludedGroupIds: env.COIN_EXCLUDED_GROUP_IDS,
    groupReviewWebhook:
      env.DISCORD_GROUP_REVIEW_WEBHOOK_URL &&
      env.DISCORD_GROUP_REVIEW_MENTION_USER_ID
        ? {
            url: env.DISCORD_GROUP_REVIEW_WEBHOOK_URL,
            mentionUserId: env.DISCORD_GROUP_REVIEW_MENTION_USER_ID,
          }
        : undefined,
    imageServer2UploadEnabled:
      env.IMAGE_SERVER2_ENABLED && env.IMAGE_SERVER2_UPLOAD_ENABLED,
    catalog: {
      assetBaseUrl: env.ASSET_BASE_URL,
      cache: runtime.cache,
      database: runtime.database,
      hiddenChapterIds: env.HIDDEN_CHAPTER_IDS,
      hiddenMangaIds: env.HIDDEN_MANGA_IDS,
      hideR18: env.HIDE_R18,
      imageServer2ReadEnabled:
        env.IMAGE_SERVER2_ENABLED && env.IMAGE_SERVER2_READ_ENABLED,
    },
    logger,
    production: env.NODE_ENV === "production",
    rateLimit: {
      internalApiKey: env.INTERNAL_API_KEY,
      serviceLimitPerSecond: env.INTERNAL_API_RATE_LIMIT_PER_SECOND,
      trustedProxyIps: env.TRUSTED_PROXY_IPS,
    },
    readiness: runtime.readiness,
    viewTracking: {
      secret: env.BETTER_AUTH_SECRET,
      secureCookie: env.NODE_ENV === "production",
    },
    webOrigin: env.WEB_ORIGIN,
    allowedWebOrigins: env.WEB_ALLOWED_ORIGINS,
  })
  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger("info", "server.started", { port: info.port })
  })
  const stopChapterWorker = runtime.chapterStorage
    ? startChapterFinalizeWorker({
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: runtime.cache,
        database: runtime.database,
        hiddenChapterIds: env.HIDDEN_CHAPTER_IDS,
        hiddenMangaIds: env.HIDDEN_MANGA_IDS,
        hideR18: env.HIDE_R18,
        logger,
        storage: runtime.chapterStorage,
      })
    : async () => undefined

  let closing = false
  const shutdown = async (signal: string) => {
    if (closing) return
    closing = true
    logger("info", "server.stopping", { signal })
    server.close()
    await stopChapterWorker()
    await runtime.close()
  }

  process.once("SIGINT", () => void shutdown("SIGINT"))
  process.once("SIGTERM", () => void shutdown("SIGTERM"))
}

main().catch((error) => {
  logger("error", "server.start_failed", {
    ...errorFields(error, process.env.NODE_ENV === "production"),
  })
  process.exitCode = 1
})
