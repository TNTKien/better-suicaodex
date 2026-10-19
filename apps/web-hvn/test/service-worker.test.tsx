import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import nextConfig from "../next.config"

type StrategyOptions = {
  cacheName: string
  networkTimeoutSeconds: number
  plugins: unknown[]
}
type WorkerOptions = {
  clientsClaim: boolean
  skipWaiting: boolean
  precacheEntries: unknown[]
  runtimeCaching: {
    matcher: (context: { request: Request; url: URL }) => boolean
    handler: unknown
  }[]
}
let strategy: StrategyOptions | undefined
let expiry:
  | { maxAgeSeconds: number; maxEntries: number; purgeOnQuotaError: boolean }
  | undefined
let worker: WorkerOptions | undefined
let listening = false
mock.module("serwist", () => ({
  NetworkFirst: class {
    constructor(options: StrategyOptions) {
      strategy = options
    }
  },
  ExpirationPlugin: class {
    constructor(options: typeof expiry) {
      expiry = options
    }
  },
  Serwist: class {
    constructor(options: WorkerOptions) {
      worker = options
    }
    addEventListeners() {
      listening = true
    }
  },
}))
const originalSelf = globalThis.self
globalThis.self = { __SW_MANIFEST: [] } as unknown as typeof self
try {
  await import("../src/sw")
  assert.ok(worker)
  assert.ok(strategy)
  assert.ok(expiry)
  assert.equal(listening, true)
  assert.equal(worker.clientsClaim, true)
  assert.equal(worker.skipWaiting, true)
  assert.deepEqual(worker.precacheEntries, [])
  assert.equal(worker.runtimeCaching.length, 1)
  assert.equal(strategy.cacheName, "redive-cover-images")
  assert.equal(strategy.networkTimeoutSeconds, 3)
  assert.deepEqual(expiry, {
    maxAgeSeconds: 604800,
    maxEntries: 200,
    purgeOnQuotaError: true,
  })
  const matches = (path: string, destination: string) =>
    worker!.runtimeCaching[0]!.matcher({
      request: { cache: "default", destination } as Request,
      url: new URL(path, "http://localhost:9000"),
    })
  assert.equal(matches("/covers/manga/cover.256.webp", "image"), true)
  assert.equal(matches("/covers/manga/cover.512.webp", "image"), true)
  assert.equal(matches("/chapters/chapter/page.webp", "image"), false)
  assert.equal(matches("/v1/me", ""), false)
  assert.equal(matches("/my-library", "document"), false)
} finally {
  globalThis.self = originalSelf
}

mock.module("@serwist/next/react", () => ({
  SerwistProvider: ({ children, ...options }: { children: ReactNode }) => (
    <div data-service-worker={JSON.stringify(options)}>{children}</div>
  ),
}))
mock.module("nuqs/adapters/next/app", () => ({
  NuqsAdapter: ({ children }: { children: ReactNode }) => children,
}))
const { QueryProvider } = await import("../components/query-provider")
const env = process.env as Record<string, string | undefined>
const originalNodeEnv = env.NODE_ENV
try {
  for (const mode of ["development", "production"]) {
    env.NODE_ENV = mode
    const html = renderToStaticMarkup(
      <QueryProvider>Page content</QueryProvider>
    )
    const options = JSON.parse(
      html.match(/data-service-worker="([^"]+)"/)![1]!.replaceAll("&quot;", '"')
    )
    assert.equal(options.disable, mode !== "production")
    assert.equal(options.swUrl, "/sw.js")
    assert.equal(options.cacheOnNavigation, false)
    assert.equal(options.reloadOnOnline, false)
    assert.deepEqual(options.options, { scope: "/", updateViaCache: "none" })
    assert.match(html, /Page content/)
  }
} finally {
  if (originalNodeEnv === undefined) delete env.NODE_ENV
  else env.NODE_ENV = originalNodeEnv
}
const routes = await nextConfig.headers!()
const route = routes.find((route) => route.source === "/sw.js")
assert.ok(route)
const headers = new Headers(route.headers.map(({ key, value }) => [key, value]))
assert.equal(
  headers.get("cache-control"),
  "no-cache, no-store, must-revalidate"
)
assert.equal(
  headers.get("content-type"),
  "application/javascript; charset=utf-8"
)
assert.equal(headers.get("service-worker-allowed"), "/")
assert.equal(headers.get("x-content-type-options"), "nosniff")
assert.equal(
  headers.get("content-security-policy"),
  "default-src 'self'; script-src 'self'; connect-src 'self' http://localhost:9000"
)
console.log(
  "HVN shared cover worker, production registration and response header checks passed"
)
