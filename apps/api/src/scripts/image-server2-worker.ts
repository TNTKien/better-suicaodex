import { setTimeout as delay } from "node:timers/promises"
import { checkDatabase, createDatabase } from "../db/client.js"
import {
  claimReplica,
  discoverReplicas,
  processReplica,
  replicaWorkerEnabled,
} from "../features/image-server2/service.js"
import {
  ReplicaError,
  uploadReplicaPage,
} from "../features/image-server2/tiktok.js"
import { BusinessCache } from "../shared/cache.js"
import { parseImageServer2Env } from "../shared/env.js"
import { logger } from "../shared/logger.js"

async function main() {
  const env = parseImageServer2Env(process.env)
  if (!env.IMAGE_SERVER2_ENABLED || !env.IMAGE_SERVER2_UPLOAD_ENABLED) {
    logger("info", "image_server2_disabled")
    return
  }
  if (!env.TIKTOK_COOKIE || !env.TIKTOK_CSRF_TOKEN)
    throw new ReplicaError("CREDENTIALS_REQUIRED")
  const { db, pool } = createDatabase(env.DATABASE_URL)
  const cache = new BusinessCache(env, logger)
  const stop = new AbortController()
  const shutdown = () => stop.abort()
  process.once("SIGINT", shutdown)
  process.once("SIGTERM", shutdown)
  const deps = {
    database: db,
    logger,
    visibility: {
      hideR18: env.HIDE_R18,
      hiddenMangaIds: env.HIDDEN_MANGA_IDS,
      hiddenChapterIds: env.HIDDEN_CHAPTER_IDS,
    },
  }
  let dirtyCache = true // Covers a previous crash between ready commit and invalidation.
  try {
    await checkDatabase(db)
    await cache.connect()
    while (!stop.signal.aborted) {
      try {
        if (
          dirtyCache &&
          (cache.status === "disabled" || (await cache.invalidateCatalog()))
        )
          dirtyCache = false
        if (!(await replicaWorkerEnabled(db))) {
          await delay(30_000, undefined, { signal: stop.signal }).catch(
            () => {}
          )
          continue
        }
        const discovered = await discoverReplicas(deps)
        const job = await claimReplica(deps)
        if (job) {
          logger("info", "image_server2_claimed", {
            chapterId: job.chapterId,
            sourceVersion: job.sourceVersion,
            attempt: job.attempts,
          })
          const ready = await processReplica(
            deps,
            job,
            (page, signal) =>
              uploadReplicaPage(page, {
                assetBaseUrl: env.ASSET_BASE_URL,
                cookie: env.TIKTOK_COOKIE!,
                csrfToken: env.TIKTOK_CSRF_TOKEN!,
                signal,
              }),
            stop.signal
          )
          dirtyCache ||= ready
          logger("info", "image_server2_job", {
            chapterId: job.chapterId,
            sourceVersion: job.sourceVersion,
            attempt: job.attempts,
            ready,
          })
          continue
        }
        if (discovered)
          logger("info", "image_server2_discovered", { count: discovered })
      } catch (error) {
        if (error instanceof ReplicaError && error.code === "AUTH_REQUIRED")
          throw error
        logger("error", "image_server2_iteration_failed", {
          code: error instanceof ReplicaError ? error.code : "DATABASE_ERROR",
        })
      }
      await delay(5000, undefined, { signal: stop.signal }).catch(() => {})
    }
  } finally {
    process.removeListener("SIGINT", shutdown)
    process.removeListener("SIGTERM", shutdown)
    await cache.close()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  logger("error", "image_server2_stopped", {
    code:
      error instanceof ReplicaError
        ? error.code
        : "WORKER_CONFIGURATION_OR_DATABASE_ERROR",
  })
  process.exitCode = 1
})
