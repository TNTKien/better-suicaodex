import { timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"

import { getConnInfo } from "@hono/node-server/conninfo"
import type { Context } from "hono"
import { MemoryStore, rateLimiter } from "hono-rate-limiter"

import type { Auth } from "../features/account/auth.js"
import { sessionUser } from "../features/account/guard.js"
import { apiError } from "./contract.js"

const commentCreationPath = /^\/v1\/(?:manga|chapters)\/[^/]+\/comments\/?$/
const serviceReadPaths = [
  /^\/v1\/manga\/?$/,
  /^\/v1\/manga\/random\/?$/,
  /^\/v1\/manga\/[^/]+\/?$/,
  /^\/v1\/manga\/[^/]+\/(?:chapters|recommendations)\/?$/,
  /^\/v1\/chapters\/[^/]+\/?$/,
  /^\/v1\/comments\/recent\/?$/,
  /^\/v1\/tags\/?$/,
  /^\/v1\/tags\/[^/]+\/?$/,
  /^\/v1\/people\/[^/]+\/?$/,
  /^\/v1\/people\/?$/,
  /^\/v1\/rankings\/manga\/?$/,
  /^\/v1\/rankings\/groups\/?$/,
  /^\/v1\/system-notices\/?$/,
]

type CredentialStatus = "absent" | "invalid" | "valid"
type RateLimitPolicy =
  | "admin-read"
  | "comment"
  | "group"
  | "manga"
  | "public"
  | "service"
  | "shop"
  | "user"

declare module "hono" {
  interface ContextVariableMap {
    rateLimitBlockedBy?: RateLimitPolicy
    rateLimitCredential?: CredentialStatus
    rateLimitPolicy?: RateLimitPolicy
  }
}

export type GlobalRateLimitOptions = {
  internalApiKey?: string
  serviceLimitPerSecond?: number
  trustedProxyIps?: readonly string[]
}

class SnapshotMemoryStore extends MemoryStore {
  override increment(key: string) {
    return { ...super.increment(key) }
  }
}

function validIp(value: string | undefined) {
  const candidate = value?.trim()
  return candidate && isIP(candidate) ? candidate : null
}

export function resolveClientIp({
  cfConnectingIp,
  forwardedFor,
  realIp,
  remoteAddress,
  trustedProxyIps = [],
}: {
  cfConnectingIp?: string
  forwardedFor?: string
  realIp?: string
  remoteAddress?: string
  trustedProxyIps?: readonly string[]
}) {
  const remote = validIp(remoteAddress) ?? "unknown"
  const trusted = new Set(trustedProxyIps)
  if (remote === "unknown" || !trusted.has(remote)) return remote

  if (forwardedFor !== undefined) {
    const chain = forwardedFor.split(",").map(validIp)
    if (chain.length === 0 || chain.some((ip) => ip === null)) return remote

    for (let index = chain.length - 1; index >= 0; index--) {
      const ip = chain[index]!
      if (!trusted.has(ip)) return ip
    }

    return chain[0]!
  }

  return validIp(cfConnectingIp) ?? validIp(realIp) ?? remote
}

export function clientIp(c: Context, trustedProxyIps: readonly string[] = []) {
  try {
    return resolveClientIp({
      cfConnectingIp: c.req.header("cf-connecting-ip"),
      forwardedFor: c.req.header("x-forwarded-for"),
      realIp: c.req.header("x-real-ip"),
      remoteAddress: getConnInfo(c).remote.address,
      trustedProxyIps,
    })
  } catch {
    return "unknown"
  }
}

function credentialStatus(candidate: string | undefined, expected?: string) {
  if (candidate === undefined) return "absent" satisfies CredentialStatus
  if (!expected) return "invalid" satisfies CredentialStatus

  const actualBytes = Buffer.from(candidate)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
    ? ("valid" satisfies CredentialStatus)
    : ("invalid" satisfies CredentialStatus)
}

function isServiceRead(c: Context) {
  return (
    c.req.method === "GET" &&
    serviceReadPaths.some((pattern) => pattern.test(c.req.path))
  )
}

function browserRateLimitPolicy(path: string): RateLimitPolicy {
  // Match domain-specific /me routes before the general account bucket.
  if (/^\/v1\/(?:shop|me\/shop)(?:\/|$)/.test(path)) return "shop"
  if (
    /^\/(?:v1\/(?:groups|contribution\/groups|me\/groups|rankings\/groups)|uploads\/(?:covers|chapters)\/tmp)(?:\/|$)/.test(
      path
    )
  )
    return "group"
  if (
    /^\/v1\/(?:manga|chapters|comments|tags|people|rankings\/manga|me\/(?:library|reading-progress|reading-history))(?:\/|$)/.test(
      path
    )
  )
    return "manga"
  if (/^\/(?:api\/auth|v1\/(?:me|profiles|system-notices))(?:\/|$)/.test(path))
    return "user"
  return "public"
}

function rateLimitMessage(c: Context, message: string) {
  return apiError("RATE_LIMITED", message, c.get("requestId"))
}

export function globalRateLimiter({
  internalApiKey,
  serviceLimitPerSecond = 100,
  trustedProxyIps = [],
}: GlobalRateLimitOptions = {}) {
  // shortcut: MemoryStore is per process; switch to RedisStore before running multiple API replicas.
  const browserLimiter = rateLimiter({
    windowMs: 1_000,
    limit: 10,
    store: new SnapshotMemoryStore(),
    // Each browser domain and admin reads have an independent quota per IP.
    keyGenerator: (c) =>
      `${c.get("rateLimitPolicy")}:${clientIp(c, trustedProxyIps)}`,
    handler: (c) => {
      c.set("rateLimitBlockedBy", c.get("rateLimitPolicy"))
      return c.json(
        rateLimitMessage(c, "Quá nhiều yêu cầu, vui lòng thử lại sau"),
        429
      )
    },
    skip: (c) => c.req.method === "OPTIONS",
  })

  const serviceLimiter = rateLimiter({
    windowMs: 1_000,
    limit: serviceLimitPerSecond,
    store: new SnapshotMemoryStore(),
    keyGenerator: () => "service:nextjs",
    handler: (c) => {
      c.set("rateLimitBlockedBy", "service")
      return c.json(
        rateLimitMessage(c, "Quá nhiều yêu cầu, vui lòng thử lại sau"),
        429
      )
    },
    skip: (c) => c.req.method === "OPTIONS",
  })

  return async (c: Context, next: () => Promise<void>) => {
    const credential = credentialStatus(
      c.req.header("x-internal-api-key"),
      internalApiKey
    )
    const policy =
      credential === "valid" && isServiceRead(c)
        ? "service"
        : c.req.method === "GET" && c.req.path.startsWith("/v1/admin/")
          ? "admin-read"
          : browserRateLimitPolicy(c.req.path)
    c.set("rateLimitCredential", credential)
    c.set("rateLimitPolicy", policy)
    return (policy === "service" ? serviceLimiter : browserLimiter)(c, next)
  }
}

export function commentRateLimiter(
  auth?: Auth,
  trustedProxyIps: readonly string[] = []
) {
  const limiter = rateLimiter({
    windowMs: 5_000,
    limit: 1,
    store: new SnapshotMemoryStore(),
    keyGenerator: async (c) => {
      const currentUser = await sessionUser(auth, c.req.raw.headers)
      return currentUser
        ? `user:${currentUser.id}`
        : `ip:${clientIp(c, trustedProxyIps)}`
    },
    handler: (c) => {
      c.set("rateLimitBlockedBy", "comment")
      return c.json(
        rateLimitMessage(c, "Vui lòng chờ 5 giây trước khi bình luận tiếp"),
        429
      )
    },
  })

  return async (c: Context, next: () => Promise<void>) => {
    if (c.req.method !== "POST" || !commentCreationPath.test(c.req.path)) {
      await next()
      return
    }

    c.set("rateLimitPolicy", "comment")
    return limiter(c, next)
  }
}
