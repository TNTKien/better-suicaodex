import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { Hono } from "hono"
import type { Config } from "./config"
import type { ImageCache } from "./cache"
import {
  getCover,
  getAvatar,
  getManga,
  getGroup,
  uuidPattern,
  type Fetch,
  type Manga,
  type Group,
} from "./upstream"

type Render = (
  subject: Manga | Group,
  cover: string | null,
  host: string
) => Promise<Buffer>
type Result =
  { status: 200; png: Buffer; cached: boolean } | { status: 404 | 502 }
const favicon = await readFile(
  new URL("../assets/favicon.ico", import.meta.url)
)

export function createApp(
  config: Config,
  cache: ImageCache,
  render: Render,
  fetcher: Fetch = fetch
) {
  const app = new Hono()
  const inFlight = new Map<string, Promise<Result>>()

  app.use("*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff")
    c.header("X-Robots-Tag", "noindex, nofollow")
    c.header("Cache-Control", "no-store")
    await next()
  })
  app.get("/health", (c) => c.json({ status: "ok" }))
  app.get("/favicon.ico", (c) =>
    c.body(new Uint8Array(favicon), 200, {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=86400",
    })
  )

  async function image(
    resource: "manga" | "group",
    id: string
  ): Promise<Result> {
    try {
      // Always check public visibility before reading the persistent image cache.
      const subject =
        resource === "manga"
          ? await getManga(id, config.apiUrl, fetcher)
          : await getGroup(id, config.apiUrl, fetcher)
      if (!subject) return { status: 404 }
      const key = `${resource}:${id}`
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify([6, subject, config.siteHost, config.assetOrigin])
        )
        .digest("hex")
      const cached = cache.get(key, fingerprint)
      if (cached) return { status: 200, png: cached, cached: true }
      const cover =
        "avatarUrl" in subject
          ? await getAvatar(subject.avatarUrl, id, fetcher, config.assetOrigin)
          : await getCover(subject.coverUrl, fetcher, config.assetOrigin)
      const png = await render(subject, cover, config.siteHost)
      cache.put(key, fingerprint, png)
      return { status: 200, png, cached: false }
    } catch (error) {
      console.error(
        "OG image failed",
        id,
        error instanceof Error ? error.message : "Unknown error"
      )
      return { status: 502 }
    }
  }

  app.get("/og-image/:resource/:file", async (c) => {
    const resource = c.req.param("resource")
    if (resource !== "manga" && resource !== "group") return c.notFound()
    const file = c.req.param("file")
    if (!file.endsWith(".png")) return c.notFound()
    const id = file.slice(0, -4).toLowerCase()
    if (!uuidPattern.test(id)) return c.notFound()
    const key = `${resource}:${id}`
    let job = inFlight.get(key)
    if (!job) {
      if (inFlight.size >= config.maxConcurrent) {
        c.header("Retry-After", "2")
        return c.text("Renderer busy", 503)
      }
      job = image(resource, id).finally(() => inFlight.delete(key))
      inFlight.set(key, job)
    }
    const result = await job
    if (result.status !== 200) {
      return c.text(
        result.status === 404 ? "Not found" : "Upstream unavailable",
        result.status
      )
    }
    return c.body(new Uint8Array(result.png), 200, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60, s-maxage=3600",
      "X-OG-Cache": result.cached ? "HIT" : "MISS",
    })
  })
  return app
}
