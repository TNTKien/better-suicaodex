import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { createApp } from "./app"
import { ImageCache } from "./cache"
import { readConfig } from "./config"
import { renderImage } from "./render"

const config = readConfig()
await mkdir(config.cacheDir, { recursive: true })
const cache = new ImageCache(join(config.cacheDir, "og.sqlite"))
const app = createApp(config, cache, renderImage)

// Warm Satori and the native SVG renderer before accepting the first request.
await renderImage(
  { title: "SuicaoDex", creators: "", coverUrl: null },
  null,
  config.siteHost
)

const server = Bun.serve({
  hostname: config.hostname,
  port: config.port,
  fetch: app.fetch,
  idleTimeout: 15,
})
console.log(`og-image listening on ${server.url}`)

async function shutdown() {
  await server.stop()
  cache.close()
}
process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)
