import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { subSeconds } from "date-fns"
import { Redis } from "ioredis"
import { BusinessCache } from "../../src/shared/cache"
import { parseRuntimeEnv } from "../../src/shared/env"

test.skipIf(!process.env.TEST_REDIS_URL)(
  "online counts unique visitors per site and expires silent browsers after one minute",
  async () => {
    const redisUrl = new URL(process.env.TEST_REDIS_URL!)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(redisUrl.hostname))
      throw new Error("TEST_REDIS_URL must point to a local test Redis")
    const prefix = `scd:dashboard-test:${randomUUID()}`
    const env = parseRuntimeEnv({
      NODE_ENV: "test",
      WEB_ORIGIN: "http://localhost:3000",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      BETTER_AUTH_URL: "http://localhost:3001",
      BETTER_AUTH_SECRET: "dashboard-test-secret-with-at-least-32-characters",
      DISCORD_CLIENT_ID: "test",
      DISCORD_CLIENT_SECRET: "test",
      REDIS_CACHE_ENABLED: "true",
      REDIS_URL: redisUrl.href,
      REDIS_PREFIX: prefix,
    })
    const cache = new BusinessCache(env, () => {})
    const redis = new Redis(env.REDIS_URL!, {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    })
    const mainKey = `${prefix}:presence:main`
    try {
      await redis.connect()
      await cache.connect()
      expect(await cache.onlinePresence()).toEqual({
        main: 0,
        hvn: 0,
        total: 0,
      })
      await cache.touchPresence("main", "browser-a")
      await cache.touchPresence("main", "browser-a")
      await cache.touchPresence("hvn", "browser-b")
      expect(await cache.onlinePresence()).toEqual({
        main: 1,
        hvn: 1,
        total: 2,
      })
      await redis.zadd(
        mainKey,
        subSeconds(new Date(), 60).getTime(),
        "browser-a"
      )
      expect(await cache.onlinePresence()).toEqual({
        main: 0,
        hvn: 1,
        total: 1,
      })
      await cache.touchPresence("main", "browser-c")
      expect(await redis.zcard(mainKey)).toBe(1)
      expect(await redis.ttl(mainKey)).toBeGreaterThan(0)
    } finally {
      try {
        if (redis.status === "ready")
          await redis.del(
            mainKey,
            `${prefix}:presence:hvn`,
            `${prefix}:business-cache-version:catalog:v2`
          )
      } finally {
        redis.disconnect()
        await cache.close()
      }
    }
  },
  30_000
)
