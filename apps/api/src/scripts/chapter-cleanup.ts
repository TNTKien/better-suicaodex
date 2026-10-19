import { createDatabase } from "../db/client.js"
import { cleanupChapterUploads } from "../features/groups/chapter.js"
import { parseRuntimeEnv } from "../shared/env.js"
import { errorFields, logger } from "../shared/logger.js"
import { createChapterStorage } from "../shared/storage.js"

async function main() {
  const env = parseRuntimeEnv(process.env)
  const storage = createChapterStorage(env)
  if (!storage) throw new Error("Runtime S3 storage is not configured")
  const { db, pool } = createDatabase(env.DATABASE_URL)
  const apply = process.argv.includes("--apply")

  try {
    const sessions = await cleanupChapterUploads(db, storage, { apply })
    logger("info", "chapter.cleanup.completed", {
      apply,
      sessions: sessions.length,
    })
    for (const session of sessions)
      logger("info", "chapter.cleanup.session", session)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  logger("error", "chapter.cleanup.failed", errorFields(error, false))
  process.exitCode = 1
})
