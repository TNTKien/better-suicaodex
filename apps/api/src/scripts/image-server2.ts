import { parseArgs } from "node:util"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { createDatabase } from "../db/client.js"
import { chapter, chapterTikTokReplica as replica } from "../db/schema.js"
import {
  operateReplica,
  verifiedPage,
} from "../features/image-server2/service.js"
import { ReplicaError } from "../features/image-server2/tiktok.js"
import { BusinessCache } from "../shared/cache.js"
import { parseImageServer2Env } from "../shared/env.js"
import { logger } from "../shared/logger.js"

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      chapter: { type: "string" },
      manga: { type: "string" },
      limit: { type: "string", default: "20" },
      actor: { type: "string" },
      apply: { type: "boolean", default: false },
      reset: { type: "boolean", default: false },
    },
  })
  const input = z
    .object({
      action: z.enum(["status", "enqueue", "retry"]),
      chapter: z.uuid().optional(),
      manga: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100),
      actor: z.string().trim().min(1).optional(),
      apply: z.boolean(),
      reset: z.boolean(),
    })
    .refine(
      (value) => !!value.chapter !== !!value.manga,
      "Use exactly one --chapter or --manga scope"
    )
    .refine(
      (value) => value.action === "status" || !value.apply || !!value.actor,
      "Mutations require --actor"
    )
    .parse({ ...values, action: positionals[0] })
  const env = parseImageServer2Env(process.env)
  const { db, pool } = createDatabase(env.DATABASE_URL)
  const cache = new BusinessCache(env, logger)
  try {
    const rows = await db
      .select({ id: chapter.id, version: chapter.pagesVersion, replica })
      .from(chapter)
      .leftJoin(replica, eq(replica.chapterId, chapter.id))
      .where(
        and(
          input.chapter ? eq(chapter.id, input.chapter) : undefined,
          input.manga ? eq(chapter.mangaId, input.manga) : undefined
        )
      )
      .orderBy(asc(chapter.id))
      .limit(input.limit)
    let changed = false
    for (const row of rows) {
      const applied =
        input.action !== "status" && input.apply
          ? await operateReplica(
              {
                database: db,
                visibility: {
                  hideR18: env.HIDE_R18,
                  hiddenMangaIds: env.HIDDEN_MANGA_IDS,
                  hiddenChapterIds: env.HIDDEN_CHAPTER_IDS,
                },
              },
              row.id,
              {
                action: input.action,
                reset: input.reset,
                actor: input.actor!,
              }
            )
          : false
      changed ||= applied
      console.info(
        JSON.stringify({
          chapterId: row.id,
          pagesVersion: row.version,
          state: row.replica?.state ?? "missing",
          sourceVersion: row.replica?.sourceVersion,
          verified: Object.values(row.replica?.pages ?? {}).filter(verifiedPage)
            .length,
          total: row.replica?.totalPages,
          attempts: row.replica?.attempts,
          lastErrorCode: row.replica?.lastErrorCode,
          action: input.action,
          applied,
          dryRun: !input.apply,
        })
      )
    }
    if (changed) {
      await cache.connect()
      const invalidated = await cache.invalidateCatalog()
      logger("info", "image_server2_operator_cache", { invalidated })
    }
  } finally {
    await cache.close()
    await pool.end()
  }
}
main().catch((error: unknown) => {
  logger("error", "image_server2_operator_failed", {
    code:
      error instanceof ReplicaError
        ? error.code
        : error instanceof z.ZodError
          ? "INVALID_ARGUMENTS"
          : "OPERATOR_OR_DATABASE_ERROR",
  })
  process.exitCode = 1
})
