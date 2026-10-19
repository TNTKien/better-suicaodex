import { resolve } from "node:path"

export function origin(value: string, name: string) {
  const url = new URL(value)
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an HTTP(S) origin without credentials`)
  }
  return url.origin
}

export function positiveInteger(value: string, name: string, max: number) {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`)
  }
  return Number(value)
}

export function readConfig(env = process.env) {
  return {
    hostname: env.HOST ?? "127.0.0.1",
    port: positiveInteger(env.PORT ?? "3003", "PORT", 65535),
    assetOrigin: origin(
      env.ASSET_BASE_URL ?? "http://localhost:9000",
      "ASSET_BASE_URL"
    ),
    apiUrl: origin(env.API_URL ?? "http://localhost:3001", "API_URL"),
    siteHost: new URL(origin(env.WEB_URL ?? "http://localhost:3000", "WEB_URL"))
      .host,
    cacheDir: resolve(env.CACHE_DIR ?? ".cache"),
    maxConcurrent: positiveInteger(
      env.MAX_CONCURRENT_RENDERS ?? "2",
      "MAX_CONCURRENT_RENDERS",
      8
    ),
  }
}

export type Config = ReturnType<typeof readConfig>
