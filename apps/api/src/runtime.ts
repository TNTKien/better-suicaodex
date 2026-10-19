import { checkDatabase, createDatabase } from "./db/client.js"
import { createAuth } from "./features/account/auth.js"
import { createCoinService } from "./features/coin/service.js"
import { BusinessCache } from "./shared/cache.js"
import type { RuntimeEnv } from "./shared/env.js"
import type { Logger } from "./shared/logger.js"
import { createStorages } from "./shared/storage.js"

export async function createRuntime(env: RuntimeEnv, logger: Logger) {
  const database = createDatabase(env.DATABASE_URL)

  try {
    await checkDatabase(database.db)
  } catch (error) {
    await database.pool.end()
    throw error
  }

  const cache = new BusinessCache(env, logger)
  await cache.connect()
  const storage = createStorages(env)

  return {
    auth: createAuth(env, database.db),
    cache,
    ...storage,
    database: database.db,
    coin: createCoinService({ enabled: env.COIN_ENABLED }),
    readiness: async () => {
      try {
        await checkDatabase(database.db)
        return { postgres: "up" as const, redis: cache.status }
      } catch {
        return { postgres: "down" as const, redis: cache.status }
      }
    },
    close: async () => {
      await cache.close()
      await database.pool.end()
    },
  }
}

export type Runtime = Awaited<ReturnType<typeof createRuntime>>
