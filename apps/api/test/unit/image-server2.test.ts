import { describe, expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import { addSeconds, differenceInSeconds } from "date-fns"
import sharp from "sharp"
import {
  encodeReplica,
  isTikTokMediaUrl,
  maxUploadBytes,
  retryDelay,
  sourceUrl,
  uploadReplicaPage,
} from "../../src/features/image-server2/tiktok"
import { parseImageServer2Env } from "../../src/shared/env"
import { validReplicaManifest } from "../../src/features/image-server2/service"

test("replica manifests retain ordered source positions and reject ambiguous maps", () => {
  const pages = (positions: number[]) =>
    positions.map((position) => ({
      position,
      originalKey: `data/test/${position}.webp`,
      width: 40,
      height: 80,
    }))
  for (const positions of [
    [0, 1],
    [1, 2],
    [1, 19],
  ])
    expect(validReplicaManifest(pages(positions))).toBe(true)
  for (const positions of [
    [],
    [1, 1],
    [2, 1],
    [-1, 0],
    [0.5],
    Array.from({ length: 221 }, (_, i) => i),
  ]) {
    expect(validReplicaManifest(pages(positions))).toBe(false)
  }
})

const image = () =>
  sharp({
    create: {
      width: 40,
      height: 80,
      channels: 4,
      background: { r: 150, g: 20, b: 80, alpha: 0.5 },
    },
  })
    .webp()
    .toBuffer()
const page = { originalKey: "data/chapter/1.webp", width: 40, height: 80 }
const cdn = "https://p21-ad-sg.ibyteimg.com/obj/tos-test/image"

describe("ordinary TikTok replicas", () => {
  test("allows only HTTPS TikTok media and contained S1 keys", () => {
    expect(isTikTokMediaUrl(cdn)).toBe(true)
    for (const url of [
      "http://p21-ad-sg.ibyteimg.com/x",
      "https://ibyteimg.com.evil.test/x",
      "https://evil.test/x",
      "https://user:pass@ibyteimg.com/x",
      "https://ibyteimg.com:444/x",
      "https://ibyteimg.com/x#secret",
    ])
      expect(isTikTokMediaUrl(url)).toBe(false)
    expect(sourceUrl("https://assets.example/base", "data/a.webp").href).toBe(
      "https://assets.example/base/data/a.webp"
    )
    for (const key of [
      "../outside.webp",
      "//evil.test/x",
      "https://evil.test/x",
      "%2e%2e/x",
      "data/x?secret=yes",
      "data\\x",
    ])
      expect(() => sourceUrl("https://assets.example/base/", key)).toThrow()
  })

  test("PNG preserves dimensions/alpha and rejects invalid metadata or oversized input", async () => {
    const source = await image()
    const result = await encodeReplica(source, 40, 80)
    expect(result.format).toBe("png")
    expect(await sharp(result.bytes).metadata()).toMatchObject({
      format: "png",
      width: 40,
      height: 80,
      hasAlpha: true,
    })
    await expect(encodeReplica(source, 41, 80)).rejects.toThrow(
      "SOURCE_DIMENSIONS_MISMATCH"
    )
    await expect(
      encodeReplica(Buffer.from("not an image"), 40, 80)
    ).rejects.toThrow("INVALID_SOURCE_IMAGE")
    await expect(
      encodeReplica(Buffer.alloc(32 * 1024 * 1024 + 1), 1, 1)
    ).rejects.toThrow("SOURCE_TOO_LARGE")
  })

  test("one JPEG fallback stays at original dimensions; oversized JPEG fails", async () => {
    const source = await sharp(randomBytes(2500 * 2500 * 3), {
      raw: { width: 2500, height: 2500, channels: 3 },
    })
      .png()
      .toBuffer()
    const result = await encodeReplica(source, 2500, 2500)
    expect(result.format).toBe("jpeg")
    expect(result.bytes.length).toBeLessThanOrEqual(maxUploadBytes)
    expect(await sharp(result.bytes).metadata()).toMatchObject({
      width: 2500,
      height: 2500,
    })
    const large = await sharp(randomBytes(4500 * 4000 * 3), {
      raw: { width: 4500, height: 4000, channels: 3 },
    })
      .jpeg({ quality: 100 })
      .toBuffer()
    await expect(encodeReplica(large, 4500, 4000)).rejects.toThrow(
      "ENCODED_TOO_LARGE"
    )
  })

  test("multipart upload is followed by anonymous GET and full image decode", async () => {
    const source = await image()
    const encoded = await encodeReplica(source, 40, 80)
    const seen: string[] = []
    const result = await uploadReplicaPage(page, {
      assetBaseUrl: "https://assets.example/",
      cookie: "secret-cookie",
      csrfToken: "secret-csrf",
      signal: new AbortController().signal,
      fetcher: async (url, init) => {
        seen.push(String(url))
        expect(init?.redirect).toBe("error")
        if (seen.length === 1) return new Response(source)
        if (seen.length === 2) {
          expect(new Headers(init?.headers).get("cookie")).toBe("secret-cookie")
          const form = init?.body as FormData
          expect(form.get("name")).toBe("page.png")
          expect((form.get("file") as Blob).type).toBe("image/png")
          return Response.json({
            code: 0,
            message: "success",
            data: { src: cdn, directUrl: cdn, uri: "tos-test/image" },
          })
        }
        expect(init?.headers).toBeUndefined()
        return new Response(encoded.bytes)
      },
    })
    expect(seen).toHaveLength(3)
    expect(result).toMatchObject({
      url: cdn,
      format: "png",
      byteSize: encoded.bytes.length,
    })
  })

  test("auth, rate limits, untrusted URLs and oversized responses fail with sanitized codes", async () => {
    const source = await image()
    const cases = [
      {
        response: () => new Response("secret", { status: 403 }),
        code: "AUTH_REQUIRED",
      },
      {
        response: () =>
          new Response("x".repeat(1024 * 1024 + 1), {
            headers: { "content-type": "text/html" },
          }),
        code: "AUTH_REQUIRED",
      },
      {
        response: () =>
          new Response("{}", {
            status: 302,
            headers: { location: "https://evil.test" },
          }),
        code: "HTTP_302",
      },
      {
        response: () => new Response("bad json"),
        code: "INVALID_UPLOAD_RESPONSE",
      },
      {
        response: () => new Response("<html>login secret</html>"),
        code: "AUTH_REQUIRED",
      },
      {
        response: () =>
          new Response("secret", {
            status: 429,
            headers: { "retry-after": "120" },
          }),
        code: "HTTP_429",
      },
      {
        response: () =>
          Response.json({
            code: 0,
            message: "success",
            data: { src: "https://evil.test/x" },
          }),
        code: "UPLOAD_REJECTED",
      },
      {
        response: () => new Response("x".repeat(1024 * 1024 + 1)),
        code: "RESPONSE_TOO_LARGE",
      },
    ]
    for (const scenario of cases) {
      let calls = 0
      await expect(
        uploadReplicaPage(page, {
          assetBaseUrl: "https://assets.example/",
          cookie: "secret",
          csrfToken: "secret",
          signal: new AbortController().signal,
          fetcher: async () =>
            ++calls === 1 ? new Response(source) : scenario.response(),
        })
      ).rejects.toThrow(scenario.code)
      expect(calls).toBe(2)
    }
  })

  test("CDN corruption and changed dimensions are never verified", async () => {
    const source = await image()
    for (const bytes of [
      Buffer.from("<html>blocked</html>"),
      await sharp(source).resize(20, 40).png().toBuffer(),
    ]) {
      let calls = 0
      await expect(
        uploadReplicaPage(page, {
          assetBaseUrl: "https://assets.example/",
          cookie: "x",
          csrfToken: "x",
          signal: new AbortController().signal,
          fetcher: async () =>
            ++calls === 1
              ? new Response(source)
              : calls === 2
                ? Response.json({
                    code: 0,
                    message: "success",
                    data: { src: cdn, directUrl: cdn, uri: "tos-test/image" },
                  })
                : new Response(bytes),
        })
      ).rejects.toThrow()
    }
  })

  test("falls back to verified src when direct URL fails and honors cancellation", async () => {
    const source = await image()
    const encoded = await encodeReplica(source, page.width, page.height)
    const src = "https://p21-ad-sg.ibyteimg.com/tos-test/image~resize.png"
    const calls: string[] = []
    const result = await uploadReplicaPage(page, {
      assetBaseUrl: "https://assets.example/",
      cookie: "x",
      csrfToken: "x",
      signal: new AbortController().signal,
      fetcher: async (url) => {
        calls.push(String(url))
        if (calls.length === 1) return new Response(source)
        if (calls.length === 2)
          return Response.json({
            code: 0,
            message: "success",
            data: { src, uri: "tos-test/image" },
          })
        return String(url) === cdn
          ? new Response(null, { status: 404 })
          : new Response(encoded.bytes)
      },
    })
    expect(result.url).toBe(src)
    expect(calls.slice(2)).toEqual([cdn, src])
    const controller = new AbortController()
    controller.abort()
    let uploaded = false
    await expect(
      uploadReplicaPage(page, {
        assetBaseUrl: "https://assets.example/",
        cookie: "x",
        csrfToken: "x",
        signal: controller.signal,
        fetcher: async (_url, init) => {
          if (init?.method === "POST") uploaded = true
          init?.signal?.throwIfAborted()
          return new Response(source)
        },
      })
    ).rejects.toThrow("CLAIM_ABORTED")
    expect(uploaded).toBe(false)
  })

  test("rejects CDN re-encoding even when format and dimensions still match", async () => {
    const source = await image()
    const encoded = await encodeReplica(source, page.width, page.height)
    const repacked = await sharp(encoded.bytes)
      .png({ compressionLevel: 0 })
      .toBuffer()
    expect(repacked.equals(encoded.bytes)).toBe(false)
    const src = "https://p16-lp-sg.ibyteimg.com/tos-test/image~tplv-image.image"
    for (const directStatus of [404, 503]) {
      const calls: string[] = []
      await expect(
        uploadReplicaPage(page, {
          assetBaseUrl: "https://assets.example/",
          cookie: "x",
          csrfToken: "x",
          signal: new AbortController().signal,
          fetcher: async (url) => {
            calls.push(String(url))
            if (calls.length === 1) return new Response(source)
            if (calls.length === 2)
              return Response.json({
                code: 0,
                message: "success",
                data: { src, uri: "tos-test/image" },
              })
            return String(url) === cdn
              ? new Response(null, { status: directStatus })
              : new Response(repacked)
          },
        })
      ).rejects.toThrow(
        directStatus === 503 ? "HTTP_503" : "REPLICA_CONTENT_MISMATCH"
      )
      expect(calls.slice(2)).toEqual([cdn, src])
    }
  })

  test("default flags are off, worker env needs no auth config, retries honor server delay", () => {
    const env = parseImageServer2Env({
      DATABASE_URL: "postgres://localhost/test",
      ASSET_BASE_URL: "https://assets.example/",
    })
    expect(env.IMAGE_SERVER2_ENABLED).toBe(false)
    expect(env.IMAGE_SERVER2_UPLOAD_ENABLED).toBe(false)
    expect(env.IMAGE_SERVER2_READ_ENABLED).toBe(false)
    const now = new Date()
    expect(
      [1, 2, 3, 4, 5].map((attempt) =>
        differenceInSeconds(retryDelay(attempt, undefined, now), now)
      )
    ).toEqual([30, 120, 600, 1800, 1800])
    expect(retryDelay(1, addSeconds(now, 200), now)).toEqual(
      addSeconds(now, 200)
    )
  })
})
