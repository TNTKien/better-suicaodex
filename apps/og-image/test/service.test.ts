import { afterEach, expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { addHours, parseISO } from "date-fns"
import { Transformer } from "@napi-rs/image"
import { imageSize } from "image-size"
import { createApp } from "../src/app"
import { ImageCache } from "../src/cache"
import { readConfig } from "../src/config"
import { renderImage } from "../src/render"
import { cover512, getAvatar, getCover, type Fetch } from "../src/upstream"

const id = "01a12efd-abfe-73d5-b5d6-a3e08b3831b7"
const otherId = "01a12efd-abfe-73d5-b5d6-a3e08b3831b8"
const coverUrl = `http://localhost:9000/covers/${id}/fixture.512.webp`
const path = `/og-image/manga/${id}.png`
const config = readConfig({
  API_URL: "https://api.test",
  MAX_CONCURRENT_RENDERS: "1",
})
const manga = {
  id,
  title: "Đọc truyện tiếng Việt: Ắ Ặ Ể Ỡ Ứ Ỵ",
  cover: { url: coverUrl },
  authors: [{ name: "Nguyễn Văn A" }],
  artists: [{ name: "Nguyễn Văn A" }, { name: "Trần B" }],
}
const pixels = Buffer.alloc(512 * 720 * 4)
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 240
  pixels[i + 1] = 90
  pixels[i + 2] = 50
  pixels[i + 3] = 255
}
const webp = await Transformer.fromRgbaPixels(pixels, 512, 720).webpLossless()
const caches: ImageCache[] = []
function cache() {
  const instance = new ImageCache(":memory:")
  caches.push(instance)
  return instance
}
afterEach(() => {
  for (const instance of caches.splice(0)) instance.close()
})

test("real WebP, Vietnamese fonts and logo produce a 1200x630 PNG", async () => {
  let apiCalls = 0,
    coverCalls = 0,
    renders = 0
  let current: typeof manga | null = manga
  const fetcher = (async (input, options) => {
    expect(options?.credentials).toBe("omit")
    expect(options?.redirect).toBe("error")
    expect(options?.signal).toBeDefined()
    expect(options?.headers).toBeUndefined()
    if (String(input) === `${config.apiUrl}/v1/manga/${id}`) {
      apiCalls++
      return current
        ? Response.json(current)
        : new Response(null, { status: 404 })
    }
    expect(String(input)).toBe(coverUrl)
    coverCalls++
    return new Response(new Uint8Array(webp), {
      headers: { "Content-Type": "image/webp" },
    })
  }) as Fetch
  const app = createApp(
    config,
    cache(),
    async (...args) => {
      renders++
      return renderImage(...args)
    },
    fetcher
  )
  const first = await app.request(path)
  expect(first.status).toBe(200)
  expect(first.headers.get("content-type")).toBe("image/png")
  expect(first.headers.get("cache-control")).toContain("s-maxage=3600")
  expect(first.headers.get("x-og-cache")).toBe("MISS")
  const png = Buffer.from(await first.arrayBuffer())
  expect(imageSize(png)).toMatchObject({
    width: 1200,
    height: 630,
    type: "png",
  })
  const rgba = await new Transformer(png).rawPixels()
  const offset = (315 * 1200 + 1000) * 4
  expect([...rgba.subarray(offset, offset + 4)]).toEqual([240, 90, 50, 255])
  function brightPixels(
    left: number,
    top: number,
    width: number,
    height: number
  ) {
    let bright = 0
    for (let y = top; y < top + height; y++) {
      for (let x = left; x < left + width; x++) {
        const i = (y * 1200 + x) * 4
        if (rgba[i] > 230 && rgba[i + 1] > 230 && rgba[i + 2] > 230) bright++
      }
    }
    return bright
  }
  expect(brightPixels(40, 36, 670, 280)).toBeGreaterThan(2_000)
  expect(brightPixels(40, 490, 319, 60)).toBeGreaterThan(1_000)
  const second = await app.request(path)
  expect(second.headers.get("x-og-cache")).toBe("HIT")
  expect(Buffer.from(await second.arrayBuffer())).toEqual(png)
  expect([apiCalls, coverCalls, renders]).toEqual([2, 1, 1])
  current = {
    ...manga,
    title: "Truyện có tiêu đề rất dài bằng tiếng Việt ".repeat(20),
  }
  expect((await app.request(path)).status).toBe(200)
  expect(renders).toBe(2)
  current = null
  const hidden = await app.request(path)
  expect(hidden.status).toBe(404)
  expect(hidden.headers.get("cache-control")).toBe("no-store")
  expect(renders).toBe(2)
}, 20_000)

test("bad IDs never call the API; upstream errors remain uncached errors", async () => {
  let calls = 0
  let invalidSchema = false
  const app = createApp(config, cache(), renderImage, (async () => {
    calls++
    return invalidSchema
      ? Response.json({ data: manga })
      : new Response("unavailable", { status: 503 })
  }) as Fetch)
  for (const request of [
    "/og-image/manga/not-a-uuid.png",
    `/og-image/manga/${id}`,
    "/other",
  ]) {
    expect((await app.request(request)).status).toBe(404)
  }
  expect(calls).toBe(0)
  expect((await app.request("/health")).status).toBe(200)
  const failed = await app.request(path)
  expect(failed.status).toBe(502)
  expect(failed.headers.get("cache-control")).toBe("no-store")
  invalidSchema = true
  expect((await app.request(path)).status).toBe(502)
  expect(calls).toBe(2)
})

test("same-ID requests share work and excess unique jobs get 503", async () => {
  const gate = Promise.withResolvers<void>()
  let apiCalls = 0,
    renders = 0
  const app = createApp(
    config,
    cache(),
    async () => {
      renders++
      return Buffer.from("fixture")
    },
    (async () => {
      apiCalls++
      await gate.promise
      return Response.json({ ...manga, cover: null })
    }) as Fetch
  )
  const first = app.request(path)
  const duplicate = app.request(path)
  const busy = await app.request(`/og-image/manga/${otherId}.png`)
  expect(busy.status).toBe(503)
  expect(busy.headers.get("retry-after")).toBe("2")
  expect(busy.headers.get("cache-control")).toBe("no-store")
  expect(apiCalls).toBe(1)
  expect((await app.request(`/og-image/group/${id}.png`)).status).toBe(503)
  gate.resolve()
  expect((await first).status).toBe(200)
  expect((await duplicate).status).toBe(200)
  expect(renders).toBe(1)
})

test("groups render avatars or bundled Kokkoro, isolate cache and recheck visibility", async () => {
  const avatarUrl = `http://localhost:9000/groups/${id}/avatars/fixture.webp`
  let group: {
    id: string
    name: string
    description: string | null
    avatarUrl: string | null
  } | null = {
    id,
    name: "Nhóm dịch tiếng Việt",
    description: "Giới thiệu nhóm dịch.",
    avatarUrl,
  }
  let avatarCalls = 0
  const app = createApp(config, cache(), renderImage, (async (
    input,
    options
  ) => {
    expect(options?.credentials).toBe("omit")
    expect(options?.redirect).toBe("error")
    expect(options?.signal).toBeDefined()
    expect(options?.headers).toBeUndefined()
    if (String(input) === `${config.apiUrl}/v1/groups/${id}`) {
      return group ? Response.json(group) : new Response(null, { status: 404 })
    }
    if (String(input) === `${config.apiUrl}/v1/manga/${id}`) {
      return Response.json({ ...manga, cover: null })
    }
    expect(String(input)).toBe(avatarUrl)
    avatarCalls++
    return new Response(new Uint8Array(webp), {
      headers: { "Content-Type": "image/webp" },
    })
  }) as Fetch)
  const groupPath = `/og-image/group/${id}.png`
  const first = await app.request(groupPath)
  expect(first.status).toBe(200)
  expect(first.headers.get("content-type")).toBe("image/png")
  expect(first.headers.get("cache-control")).toContain("s-maxage=3600")
  expect(first.headers.get("x-og-cache")).toBe("MISS")
  const png = Buffer.from(await first.arrayBuffer())
  expect(imageSize(png)).toMatchObject({
    width: 1200,
    height: 630,
    type: "png",
  })
  const center = (315 * 1200 + 975) * 4
  const rgba = await new Transformer(png).rawPixels()
  expect([...rgba.subarray(center, center + 4)]).toEqual([240, 90, 50, 255])
  expect((await app.request(path)).headers.get("x-og-cache")).toBe("MISS")
  expect((await app.request(groupPath)).headers.get("x-og-cache")).toBe("HIT")
  expect(avatarCalls).toBe(1)

  group = {
    ...group!,
    name: "Nhóm có tên mới",
    description: null,
    avatarUrl: null,
  }
  const fallback = await app.request(groupPath)
  expect(fallback.headers.get("x-og-cache")).toBe("MISS")
  const fallbackPixels = await new Transformer(
    Buffer.from(await fallback.arrayBuffer())
  ).rawPixels()
  const fallbackAsset = await readFile(
    new URL("../assets/kokkoro-avt.png", import.meta.url)
  )
  expect(imageSize(fallbackAsset)).toMatchObject({
    width: 400,
    height: 400,
    type: "png",
  })
  const kokkoro = await new Transformer(fallbackAsset).rawPixels()
  const channels = kokkoro.length / (400 * 400)
  const avatarCenter = (200 * 400 + 200) * channels
  expect([...fallbackPixels.subarray(center, center + 4)]).toEqual([
    ...kokkoro.subarray(avatarCenter, avatarCenter + 3),
    255,
  ])
  expect(avatarCalls).toBe(1)

  group = null
  const hidden = await app.request(groupPath)
  expect(hidden.status).toBe(404)
  expect(hidden.headers.get("cache-control")).toBe("no-store")
}, 20_000)

test("group avatar URLs are restricted to the group's own public assets", async () => {
  const avatarUrl = `http://localhost:9000/groups/${id}/avatars/fixture.webp`
  let calls = 0
  for (const url of [
    "http://127.0.0.1/private",
    avatarUrl.replace(id, otherId),
    avatarUrl.replace("localhost:9000", "evil.test"),
    avatarUrl.replace("http://", "http://user:pass@"),
    `${avatarUrl}?token=secret`,
    `${avatarUrl}#fragment`,
    avatarUrl.replace("avatars/fixture.webp", "banners/fixture.webp"),
  ]) {
    expect(
      await getAvatar(url, id, (async () => {
        calls++
        throw new Error("Unexpected fetch")
      }) as Fetch)
    ).toBeNull()
  }
  expect(calls).toBe(0)
  for (const response of [
    new Response(null, { status: 404 }),
    new Response("corrupt", { headers: { "Content-Type": "image/webp" } }),
    new Response(new Uint8Array(webp), {
      headers: { "Content-Type": "image/webp", "Content-Length": "3000000" },
    }),
  ]) {
    expect(
      await getAvatar(avatarUrl, id, (async () => response) as Fetch)
    ).toBeNull()
  }
})

test("invalid group schemas and unavailable upstreams remain uncached 502s", async () => {
  const group = { id, name: "Nhóm dịch", description: null, avatarUrl: null }
  for (const response of [
    Response.json(null),
    Response.json({ data: group }),
    Response.json({ ...group, id: otherId }),
    Response.json({ ...group, name: "" }),
    Response.json({ ...group, description: {} }),
    Response.json({ ...group, avatarUrl: {} }),
    new Response(null, { status: 503 }),
  ]) {
    const app = createApp(
      config,
      cache(),
      renderImage,
      (async () => response) as Fetch
    )
    const result = await app.request(`/og-image/group/${id}.png`)
    expect(result.status).toBe(502)
    expect(result.headers.get("cache-control")).toBe("no-store")
  }
})

test("favicon matches Re:Dive without calling the API or renderer", async () => {
  const app = createApp(
    config,
    cache(),
    async () => {
      throw new Error("Unexpected render")
    },
    (async () => {
      throw new Error("Unexpected fetch")
    }) as Fetch
  )
  const response = await app.request("/favicon.ico")
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe("image/x-icon")
  expect(response.headers.get("cache-control")).toBe("public, max-age=86400")
  expect(Buffer.from(await response.arrayBuffer())).toEqual(
    await readFile(new URL("../../web/app/favicon.ico", import.meta.url))
  )
})

test("cover source is normalized to 512 and restricted before fetching", async () => {
  for (const source of [
    coverUrl,
    coverUrl.replace(".512.webp", ".256.webp"),
    coverUrl.replace(".512.webp", ".webp"),
  ]) {
    expect(cover512(source)).toBe(coverUrl)
  }
  let calls = 0
  const fetcher = (async () => {
    calls++
    throw new Error("Unexpected fetch")
  }) as Fetch
  for (const source of [
    "not a URL",
    "http://127.0.0.1/private",
    coverUrl.replace("localhost:9000", "evil.test"),
    coverUrl.replace("localhost:9000", "localhost:9443"),
    coverUrl.replace("http://", "http://name:password@"),
    `${coverUrl}?url=http://127.0.0.1`,
    `${coverUrl}#fragment`,
    coverUrl.replace(`/covers/${id}/`, "/covers/%2Fprivate/"),
    coverUrl.replace(`/covers/${id}/`, "/covers/../private/"),
    coverUrl.replace(`/covers/${id}/`, "/covers/legacy/nested/"),
    coverUrl.replace(".512.webp", ".512.png"),
  ]) {
    expect(await getCover(source, fetcher)).toBeNull()
  }
  expect(calls).toBe(0)
})

test("cover folders retain their IDs and load the 512 WebP", async () => {
  for (const [folder, file] of [
    ["fixturemanga", "fixturecover"],
    ["fixturemanga2", "test6cupzj"],
  ]) {
    const expected = `http://localhost:9000/covers/${folder}/${file}.512.webp`
    for (const suffix of [".webp", ".256.webp", ".512.webp"]) {
      const source = `http://localhost:9000/covers/${folder}/${file}${suffix}`
      expect(cover512(source)).toBe(expected)
      let calls = 0
      const cover = await getCover(source, (async (input) => {
        calls++
        expect(String(input)).toBe(expected)
        return new Response(new Uint8Array(webp), {
          headers: { "Content-Type": "image/webp" },
        })
      }) as Fetch)
      expect(calls).toBe(1)
      expect(cover).not.toBeNull()
      expect(
        imageSize(Buffer.from(cover!.split(",")[1]!, "base64"))
      ).toMatchObject({
        width: 450,
        height: 630,
        type: "png",
      })
    }
  }
})

test("configured asset origin replaces the default without broadening the allowlist", async () => {
  const assetOrigin = "https://assets.example.test"
  const customCover = coverUrl.replace("http://localhost:9000", assetOrigin)
  expect(cover512(customCover, assetOrigin)).toBe(customCover)
  const fetched: string[] = []
  const fetcher = (async (input) => {
    fetched.push(String(input))
    return new Response(new Uint8Array(webp), {
      headers: { "Content-Type": "image/webp" },
    })
  }) as Fetch
  expect(await getCover(customCover, fetcher, assetOrigin)).not.toBeNull()
  expect(await getCover(coverUrl, fetcher, assetOrigin)).toBeNull()
  const avatar = `${assetOrigin}/groups/${id}/avatars/fixture.webp`
  expect(await getAvatar(avatar, id, fetcher, assetOrigin)).not.toBeNull()
  expect(
    await getAvatar(
      avatar.replace(assetOrigin, "https://evil.example.test"),
      id,
      fetcher,
      assetOrigin
    )
  ).toBeNull()
  expect(fetched).toEqual([customCover, avatar])
  expect(readConfig({ ASSET_BASE_URL: assetOrigin }).assetOrigin).toBe(
    assetOrigin
  )
})

test("missing, corrupt, oversized and excessive-pixel covers use the placeholder", async () => {
  const huge = Buffer.alloc(30)
  huge.write("RIFF", 0)
  huge.writeUInt32LE(22, 4)
  huge.write("WEBPVP8X", 8)
  huge.writeUInt32LE(10, 16)
  huge.writeUIntLE(4999, 24, 3)
  huge.writeUIntLE(3999, 27, 3)
  expect(imageSize(huge)).toMatchObject({ width: 5000, height: 4000 })
  for (const response of [
    new Response("bad", { headers: { "Content-Type": "image/webp" } }),
    new Response(new Uint8Array(webp), {
      headers: { "Content-Type": "image/webp", "Content-Length": "3000000" },
    }),
    new Response(new Uint8Array(2 * 1024 * 1024 + 1), {
      headers: { "Content-Type": "image/webp" },
    }),
    new Response(huge, { headers: { "Content-Type": "image/webp" } }),
    new Response(null, { status: 404 }),
  ]) {
    expect(await getCover(coverUrl, (async () => response) as Fetch)).toBeNull()
  }
  expect(await getCover(null, fetch)).toBeNull()
  const png = await renderImage(
    { title: manga.title, creators: "", coverUrl: null },
    null,
    "suicaodex.com"
  )
  expect(imageSize(png)).toMatchObject({ width: 1200, height: 630 })
})

test("disk cache survives reopening, expires in one hour and evicts by byte budget", async () => {
  const directory = await mkdtemp(join(tmpdir(), "og-image-test-"))
  let disk: ImageCache | undefined
  try {
    const file = join(directory, "cache.sqlite")
    const now = parseISO("2026-10-18T00:00:00Z")
    disk = new ImageCache(file, 6)
    disk.put(id, "v1", Buffer.from("first"), now)
    disk.close()
    disk = new ImageCache(file, 6)
    expect(disk.get(id, "v1", now)?.toString()).toBe("first")
    expect(disk.get(id, "v2", now)).toBeNull()
    expect(disk.get(id, "v1", addHours(now, 1))).toBeNull()
    disk.put(otherId, "v1", Buffer.from("next"), addHours(now, 0.5))
    expect(disk.get(otherId, "v1", addHours(now, 0.5))?.toString()).toBe("next")
    expect(disk.get(id, "v1", now)).toBeNull()
    disk.put(otherId, "v2", Buffer.from("new"), now)
    expect(disk.get(otherId, "v1", now)).toBeNull()
    expect(disk.get(otherId, "v2", now)?.toString()).toBe("new")
  } finally {
    disk?.close()
    expect(directory.startsWith(join(tmpdir(), "og-image-test-"))).toBe(true)
    await rm(directory, { recursive: true, force: true })
  }
})

test("configuration rejects invalid upstream origins and concurrency", () => {
  for (const value of [
    "file:///etc/passwd",
    "https://user:pass@api.test",
    "https://api.test/path",
    "https://api.test/?secret=1",
  ]) {
    expect(() => readConfig({ API_URL: value })).toThrow()
  }
  for (const value of ["0", "-1", "1.5", "9", "NaN"]) {
    expect(() => readConfig({ MAX_CONCURRENT_RENDERS: value })).toThrow()
  }
})
