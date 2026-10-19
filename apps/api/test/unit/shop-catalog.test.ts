import { expect, test } from "bun:test"
import { createHash, randomUUID } from "node:crypto"
import sharp from "sharp"
import {
  checkedAssets,
  sealCatalog,
  validateCatalog,
  verifyCatalogAssets,
} from "../../src/features/shop/catalog-maintenance"

const target = { host: "127.0.0.1", port: "5432", database: "shop_test" }
function snapshot() {
  const id = randomUUID()
  return {
    format: 2,
    source: target,
    capturedAt: "2026-10-05T00:00:00.000Z",
    excluded: { disabled: 1, notReady: 0 },
    topics: [],
    frames: [
      {
        id,
        code: `frame-${id}`,
        name: "Fixture",
        description: "",
        topicId: null,
        rarity: "SR",
        limited: false,
        displayScale: 125,
        offsetX: 0,
        offsetY: 0,
        assetKey: `avatar-frames/${id}/frame.webp`,
        previewKey: `avatar-frames/${id}/preview.webp`,
        width: 318,
        height: 318,
        frameCount: 1,
        byteSize: 100,
        previewByteSize: 100,
        sha256: "a".repeat(64),
        previewSha256: "b".repeat(64),
        sourceSha256: "c".repeat(64),
        loop: null,
        delays: [],
      },
    ],
  }
}
test("catalog boundary is strict, canonical and excludes financial/user data and unsafe keys", () => {
  const input = snapshot(),
    row = input.frames[0]!
  const document = sealCatalog(input)
  expect(() => sealCatalog({ ...input, format: 1 })).toThrow("INVALID_CATALOG")
  const aligned = sealCatalog({
    ...input,
    frames: [{ ...row, displayScale: 140, offsetX: -8, offsetY: 4 }],
  })
  expect(validateCatalog(aligned).snapshot.frames[0]).toMatchObject({
    displayScale: 140,
    offsetX: -8,
    offsetY: 4,
  })
  expect(validateCatalog(document)).toEqual(document)
  expect(() =>
    validateCatalog({
      ...document,
      snapshot: { ...input, frames: [{ ...row, name: "Changed" }] },
    })
  ).toThrow("CATALOG_HASH_MISMATCH")
  for (const extra of [
    "shopPrice",
    "shopStock",
    "ownership",
    "active",
    "userId",
    "secret",
    "version",
  ])
    expect(() =>
      sealCatalog({ ...input, frames: [{ ...row, [extra]: 10 }] })
    ).toThrow("INVALID_CATALOG")
  for (const assetKey of [
    "https://secret.example/file.webp",
    "../frame.webp",
    "covers/a.webp",
    "avatar-frames/../a.webp",
    "avatar-frames/%2e%2e/a.webp",
    "avatar-frames/a.webp?secret=x",
    "avatar-frames/\\a.webp",
  ])
    expect(() =>
      sealCatalog({ ...input, frames: [{ ...row, assetKey }] })
    ).toThrow("INVALID_CATALOG")
  for (const patch of [
    { displayScale: 201 },
    { offsetX: -51 },
    { offsetY: 0.5 },
    { width: 319 },
    { frameCount: 121 },
    { byteSize: 2_000_001 },
    { rarity: "R", limited: true },
    { frameCount: 2, delays: [] },
    { sha256: "bad" },
    { topicId: randomUUID() },
  ])
    expect(() =>
      sealCatalog({ ...input, frames: [{ ...row, ...patch }] })
    ).toThrow()
  expect(() => sealCatalog({ ...input, frames: [row, row] })).toThrow(
    "DUPLICATE_SNAPSHOT_IDENTITY"
  )
  const topic = { id: randomUUID(), name: "Discord" }
  expect(() =>
    sealCatalog({
      ...input,
      topics: [topic, { id: randomUUID(), name: " discord " }],
    })
  ).toThrow("DUPLICATE_SNAPSHOT_IDENTITY")
  const more = { ...row, id: randomUUID(), code: "another" }
  expect(sealCatalog({ ...input, frames: [row, more] }).sha256).toBe(
    sealCatalog({ ...input, frames: [more, row] }).sha256
  )
})
test("S3/read-only delivery verification rejects missing/corrupt/oversize or altered images without writes", async () => {
  const bytes = await sharp({
    create: { width: 318, height: 318, channels: 4, background: "transparent" },
  })
    .webp()
    .toBuffer()
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const input = snapshot(),
    row = input.frames[0]!
  const document = sealCatalog({
    ...input,
    frames: [
      {
        ...row,
        sha256,
        previewSha256: sha256,
        byteSize: bytes.length,
        previewByteSize: bytes.length,
      },
    ],
  })
  const storage = {
    head: async () => ({
      contentLength: bytes.length,
      contentType: "image/webp",
    }),
  }
  const fetcher = (async () =>
    new Response(bytes, {
      headers: { "content-type": "image/webp" },
    })) as typeof fetch
  const result = await verifyCatalogAssets(
    document,
    storage,
    "https://assets.example.com",
    fetcher
  )
  expect(result).toEqual({ verified: 2, errors: [] })
  expect(
    checkedAssets(document, "https://assets.example.com", result).manifestSha256
  ).toBe(document.sha256)
  for (const [head, fetch] of [
    [
      async () => {
        throw new Error("private secret")
      },
      fetcher,
    ],
    [async () => ({ contentLength: 1, contentType: "image/webp" }), fetcher],
    [
      storage.head,
      (async () => new Response("missing", { status: 404 })) as typeof fetch,
    ],
    [
      storage.head,
      (async () =>
        new Response(Buffer.alloc(bytes.length), {
          headers: { "content-type": "image/webp" },
        })) as typeof fetch,
    ],
    [
      storage.head,
      (async () =>
        new Response(Buffer.alloc(bytes.length + 1), {
          headers: { "content-type": "image/webp" },
        })) as typeof fetch,
    ],
  ] as const) {
    const check = await verifyCatalogAssets(
      document,
      { head },
      "https://assets.example.com",
      fetch
    )
    expect(check.verified).toBe(0)
    expect(check.errors).toHaveLength(2)
    expect(JSON.stringify(check)).not.toContain("secret")
    expect(() =>
      checkedAssets(document, "https://assets.example.com", check)
    ).toThrow("ASSETS_NOT_VERIFIED")
  }
  const altered = sealCatalog({
    ...document.snapshot,
    frames: [{ ...document.snapshot.frames[0]!, width: 317 }],
  })
  expect(
    (
      await verifyCatalogAssets(
        altered,
        storage,
        "https://assets.example.com",
        fetcher
      )
    ).errors[0]!.code
  ).toBe("IMAGE_METADATA_MISMATCH")
})
