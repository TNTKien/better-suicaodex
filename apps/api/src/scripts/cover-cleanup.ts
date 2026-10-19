import { createDatabase } from "../db/client.js"
import {
  cleanupCoverUploads,
  cleanupCoverUploadSessions,
} from "../features/groups/cover.js"
import { parseRuntimeEnv } from "../shared/env.js"
import { errorFields, logger } from "../shared/logger.js"
import { createStorages } from "../shared/storage.js"

async function main() {
  const env = parseRuntimeEnv(process.env)
  const { chapterStorage, coverStorage } = createStorages(env)
  if (!chapterStorage || !coverStorage)
    throw new Error("Runtime S3 storage is not configured")
  const { db, pool } = createDatabase(env.DATABASE_URL)
  const apply = process.argv.includes("--apply")

  try {
    const [operations, sessions] = await Promise.all([
      cleanupCoverUploads(db, coverStorage, { apply }),
      cleanupCoverUploadSessions(db, chapterStorage, { apply }),
    ])
    logger("info", "cover.cleanup.completed", {
      apply,
      operations: operations.length,
      sessions: sessions.length,
    })
    for (const operation of operations)
      logger("info", "cover.cleanup.operation", operation)
    for (const session of sessions)
      logger("info", "cover.cleanup.session", session)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  logger("error", "cover.cleanup.failed", errorFields(error, false))
  process.exitCode = 1
})
