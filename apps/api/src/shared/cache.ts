import { createHash, randomUUID } from "node:crypto"

import { Redis } from "ioredis"

import type { CacheEnv } from "./env.js"
import type { Logger } from "./logger.js"

export type CacheResource =
  | "homepage"
  | "manga:list"
  | "manga:detail"
  | "chapter:detail"
  | "manga:route-lookup"
  | "manga:ranking"
  | "manga:random"

export const randomMangaTtlSeconds = 600

type CacheState = "disabled" | "healthy" | "degraded"

const releaseLock = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  end
  return 0
`

export class BusinessCache {
  readonly #client?: Redis
  readonly #prefix: string
  readonly #logger: Logger
  readonly #retryMs: number
  readonly #versionRefreshMs: number
  readonly #ttls: Record<CacheResource, number>
  #state: CacheState
  #version = "1"
  #versionReadAt = 0
  #retryAt = 0
  #metrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    fallbacks: 0,
    invalidations: 0,
    locksAcquired: 0,
  }

  constructor(env: CacheEnv, logger: Logger) {
    this.#prefix = env.REDIS_PREFIX
    this.#logger = logger
    this.#retryMs = env.REDIS_RECONNECT_RETRY_MS
    this.#versionRefreshMs = env.REDIS_CACHE_VERSION_REFRESH_MS
    this.#ttls = {
      homepage: env.ENDPOINT_CACHE_HOMEPAGE_TTL_SECONDS,
      "manga:list": env.ENDPOINT_CACHE_MANGA_LIST_TTL_SECONDS,
      "manga:detail": env.ENDPOINT_CACHE_MANGA_DETAIL_TTL_SECONDS,
      "chapter:detail": env.ENDPOINT_CACHE_CHAPTER_DETAIL_TTL_SECONDS,
      "manga:route-lookup": env.ENDPOINT_CACHE_MANGA_ROUTE_LOOKUP_TTL_SECONDS,
      "manga:ranking": env.ENDPOINT_CACHE_MANGA_RANKING_TTL_SECONDS,
      "manga:random": randomMangaTtlSeconds,
    }

    if (!env.REDIS_CACHE_ENABLED) {
      this.#state = "disabled"
      return
    }

    this.#state = "degraded"
    this.#client = new Redis(env.REDIS_URL!, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
      retryStrategy: () => null,
    })
    this.#client.on("error", (error) => this.#degrade(error))
  }

  get status() {
    return this.#state
  }

  get metrics() {
    return { ...this.#metrics }
  }

  async connect() {
    if (!this.#client) return
    await this.#recover(true)
  }

  async get<T>(resource: CacheResource, identity: unknown): Promise<T | null> {
    if (!(await this.#available())) {
      this.#metrics.fallbacks++
      return null
    }

    try {
      const value = await this.#client!.get(await this.#key(resource, identity))
      if (value === null) {
        this.#metrics.misses++
        return null
      }

      this.#metrics.hits++
      return JSON.parse(value) as T
    } catch (error) {
      this.#degrade(error)
      this.#metrics.fallbacks++
      return null
    }
  }

  async set(resource: CacheResource, identity: unknown, value: unknown) {
    if (!(await this.#available())) return false

    try {
      await this.#client!.set(
        await this.#key(resource, identity),
        JSON.stringify(value),
        "EX",
        this.#ttls[resource]
      )
      return true
    } catch (error) {
      this.#degrade(error)
      return false
    }
  }

  async invalidateCatalog() {
    if (!(await this.#available())) return false

    try {
      this.#version = String(await this.#client!.incr(this.#versionKey))
      this.#versionReadAt = performance.now()
      this.#metrics.invalidations++
      return true
    } catch (error) {
      this.#degrade(error)
      return false
    }
  }

  // Read only: carry a pre-coin view window across the first DB-dedup cutover.
  async lockRemainingMilliseconds(name: string) {
    if (!(await this.#available())) return null
    try {
      return Math.max(
        0,
        await this.#client!.pttl(`${this.#prefix}:lock:${name}`)
      )
    } catch (error) {
      this.#degrade(error)
      return null
    }
  }

  async acquireLock(name: string, ttlSeconds = 30) {
    if (!(await this.#available())) return null

    const key = `${this.#prefix}:lock:${name}`
    const owner = randomUUID()
    try {
      const acquired = await this.#client!.set(
        key,
        owner,
        "EX",
        ttlSeconds,
        "NX"
      )
      if (acquired !== "OK") return null
      this.#metrics.locksAcquired++

      return async () => {
        try {
          await this.#client!.eval(releaseLock, 1, key, owner)
        } catch (error) {
          this.#degrade(error)
        }
      }
    } catch (error) {
      this.#degrade(error)
      return null
    }
  }

  async close() {
    if (!this.#client) return
    this.#client.disconnect()
  }

  async #available() {
    if (!this.#client) return false
    if (this.#state === "healthy") return true
    if (performance.now() < this.#retryAt) return false
    return this.#recover(false)
  }

  async #recover(initial: boolean) {
    try {
      if (["wait", "end"].includes(this.#client!.status)) {
        await this.#client!.connect()
      }
      await this.#client!.ping()

      if (initial) {
        await this.#client!.set(this.#versionKey, "1", "NX")
        this.#version = (await this.#client!.get(this.#versionKey)) ?? "1"
      } else {
        this.#version = String(await this.#client!.incr(this.#versionKey))
      }

      this.#versionReadAt = performance.now()
      this.#state = "healthy"
      this.#logger("info", initial ? "cache.connected" : "cache.recovered")
      return true
    } catch (error) {
      this.#degrade(error)
      return false
    }
  }

  async #key(resource: CacheResource, identity: unknown) {
    if (performance.now() - this.#versionReadAt >= this.#versionRefreshMs) {
      this.#version =
        (await this.#client!.get(this.#versionKey)) ?? this.#version
      this.#versionReadAt = performance.now()
    }

    return `${this.#prefix}:catalog:payload-v4:v${this.#version}:${resource}:${stableHash(identity)}`
  }

  get #versionKey() {
    return `${this.#prefix}:business-cache-version:catalog:v2`
  }

  #degrade(error: unknown) {
    const wasHealthy = this.#state === "healthy"
    this.#state = "degraded"
    this.#retryAt = performance.now() + this.#retryMs
    this.#metrics.errors++
    if (wasHealthy || this.#metrics.errors === 1) {
      this.#logger("warn", "cache.degraded", {
        errorType: error instanceof Error ? error.name : "unknown",
      })
    }
  }
}

export function stableHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}
