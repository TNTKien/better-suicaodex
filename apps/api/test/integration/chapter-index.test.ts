import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { addSeconds, parseISO } from "date-fns"
import { eq, inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { v7 as uuidv7 } from "uuid"

import { createApp } from "../../src/app"
import { createDatabase } from "../../src/db/client"
import { chapter, manga, mangaVolume, organization } from "../../src/db/schema"
import type {
  ChapterIndex,
  ChapterList,
} from "../../src/features/catalog/contract"
import type { CatalogDependencies } from "../../src/features/catalog/routes"

setDefaultTimeout(120_000)
const publishedAt = parseISO("2026-11-01T00:00:00Z")
const groupId = uuidv7()
const mangaIds: string[] = []
let connection: ReturnType<typeof createDatabase>
let app: ReturnType<typeof createApp>
let globalId: string
let volumeId: string
let emptyId: string
let blockedId: string
let pinnedId: string
let missingVolumeId: string
let r18Id: string
let hiddenChapterIds: string[]

function application(overrides: Partial<CatalogDependencies> = {}) {
  return createApp({
    logger: () => undefined,
    catalog: {
      database: connection.db,
      assetBaseUrl: "https://assets.example.test/",
      cache: undefined as unknown as CatalogDependencies["cache"],
      hiddenChapterIds,
      ...overrides,
    },
  })
}

async function createManga(patch: Partial<typeof manga.$inferInsert> = {}) {
  const id = uuidv7()
  const [row] = await connection.db
    .insert(manga)
    .values({
      id,
      ownerGroupId: groupId,
      title: "Chapter index fixture",
      searchTitle: "chapter index fixture",
      slug: `chapter-index-${id}`,
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      publicationState: "published",
      publishedAt,
      ...patch,
    })
    .returning({ id: manga.id })
  mangaIds.push(row!.id)
  return row!.id
}

function page(
  mangaId: string,
  number: string | null,
  patch: Partial<typeof chapter.$inferInsert> = {}
): typeof chapter.$inferInsert {
  return {
    id: uuidv7(),
    ownerGroupId: groupId,
    mangaId,
    number,
    language: "vi",
    pageCount: 1,
    availablePageCount: 1,
    isFull: true,
    publicationState: "published",
    publishedAt,
    ...patch,
  }
}

async function index(id: string, query = "", target = app) {
  const response = await target.request(`/v1/manga/${id}/aggregate${query}`)
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("no-store")
  return (await response.json()) as ChapterIndex
}

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL
  if (
    !url ||
    url === process.env.DATABASE_URL ||
    !new URL(url).pathname.includes("test")
  )
    throw new Error("A dedicated TEST_DATABASE_URL is required")
  connection = createDatabase(url)
  await migrate(connection.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  })
  await connection.db.insert(organization).values({
    id: groupId,
    name: "Index group",
    slug: `index-${groupId}`,
    createdAt: publishedAt,
  })

  globalId = await createManga()
  volumeId = await createManga({ numberingMode: "volume" })
  emptyId = await createManga()
  r18Id = await createManga({ contentRating: "pornographic" })
  const volumes = await connection.db
    .insert(mangaVolume)
    .values([
      { mangaId: globalId, number: "1" },
      { mangaId: globalId, number: "2" },
      { mangaId: volumeId, number: "1" },
      { mangaId: volumeId, number: "2" },
      { mangaId: volumeId, number: "3", deletedAt: publishedAt },
    ])
    .returning({ id: mangaVolume.id })

  const bulk = Array.from({ length: 205 }, (_, position) =>
    page(globalId, String(position + 1), {
      volumeId: volumes[position < 100 ? 0 : 1]!.id,
    })
  )
  const pinned = page(globalId, "2", {
    volumeId: volumes[1]!.id,
    isDefault: true,
    title: "Pinned alternative",
    publishedAt: addSeconds(publishedAt, -1),
  })
  pinnedId = pinned.id!
  const blocked = page(globalId, "999")
  blockedId = blocked.id!
  hiddenChapterIds = [blockedId]
  const missingVolume = page(volumeId, "1", { numberingMode: "volume" })
  missingVolumeId = missingVolume.id!
  await connection.db.insert(chapter).values([
    ...bulk,
    pinned,
    page(globalId, "10.5", { title: "Extra" }),
    page(globalId, "0", { title: null }),
    page(globalId, null),
    page(globalId, "2", { language: "en" }),
    blocked,
    page(globalId, "991", { publicationState: "draft", publishedAt: null }),
    page(globalId, "992", { moderationHiddenAt: publishedAt }),
    page(globalId, "993", { deletedAt: publishedAt }),
    page(globalId, "994", { isFull: false }),
    page(globalId, "995", { availablePageCount: 0 }),
    page(volumeId, "1", {
      numberingMode: "volume",
      volumeId: volumes[2]!.id,
    }),
    page(volumeId, "1", {
      numberingMode: "volume",
      volumeId: volumes[3]!.id,
    }),
    page(volumeId, "1.5", {
      numberingMode: "volume",
      volumeId: volumes[3]!.id,
    }),
    missingVolume,
    page(volumeId, "2", {
      numberingMode: "volume",
      volumeId: volumes[4]!.id,
    }),
    page(volumeId, null, { numberingMode: "volume" }),
    page(volumeId, null, { numberingMode: "volume" }),
  ])
  app = application()
})

afterAll(async () => {
  if (!connection) return
  try {
    if (mangaIds.length)
      await connection.db.delete(manga).where(inArray(manga.id, mangaIds))
    await connection.db.delete(organization).where(eq(organization.id, groupId))
  } finally {
    await connection.pool.end()
  }
})

test("returns every release beyond the first page without heavy or duplicate payloads", async () => {
  const result = await index(globalId, "?limit=1&page=2")
  expect(Object.keys(result)).toEqual(["data"])
  expect(result.data).toHaveLength(210)
  expect(new Set(result.data.map(({ id }) => id)).size).toBe(210)
  const pinned = result.data.find(({ id }) => id === pinnedId)!
  expect(pinned).toEqual({
    id: pinnedId,
    volume: "2",
    number: "2",
  })
  for (const entry of result.data) {
    expect(Object.keys(entry).sort()).toEqual(["id", "number", "volume"])
  }
})

test("filters language without losing variants, decimals, zero or unnumbered chapters", async () => {
  const vi = await index(globalId, "?language=vi")
  expect(vi.data).toHaveLength(209)
  const en = await index(globalId, "?language=en")
  expect(en.data).toHaveLength(1)
  expect(vi.data.some(({ id }) => id === en.data[0]!.id)).toBe(false)
  expect(
    vi.data.filter(({ number }) => number === "2").map(({ id }) => id)[0]
  ).toBe(pinnedId)
  expect(vi.data.some(({ number }) => number === "10.5")).toBe(true)
  expect(vi.data.some(({ number }) => number === "0")).toBe(true)
  expect(vi.data.some(({ number }) => number === null)).toBe(true)
  expect((await index(globalId, "?language=fr")).data).toEqual([])
})

test.each(["global", "volume"] as const)(
  "matches all pages of the existing list in %s numbering mode",
  async (mode) => {
    const id = mode === "global" ? globalId : volumeId
    for (const sort of ["reading", "volume"]) {
      for (const direction of ["asc", "desc"]) {
        const query = `sort=${sort}&direction=${direction}`
        const expected: string[] = []
        let totalPages = 1
        for (let page = 1; page <= totalPages; page++) {
          const response = await app.request(
            `/v1/manga/${id}/chapters?${query}&limit=100&page=${page}`
          )
          expect(response.status).toBe(200)
          const list = (await response.json()) as ChapterList
          totalPages = list.meta.totalPages
          expected.push(...list.data.map(({ id }) => id))
        }
        expect((await index(id, `?${query}`)).data.map(({ id }) => id)).toEqual(
          expected
        )
      }
    }
  }
)

test("preserves reset numbering, missing/deleted volumes and individual unnumbered releases", async () => {
  const { data } = await index(volumeId, "?sort=volume")
  expect(data).toHaveLength(7)
  expect(
    data.filter(({ number }) => number === "1").map(({ volume }) => volume)
  ).toEqual([null, "2", "1"])
  expect(data.find(({ id }) => id === missingVolumeId)?.volume).toBeNull()
  expect(data.find(({ number }) => number === "2")?.volume).toBeNull()
  expect(data.filter(({ number }) => number === null)).toHaveLength(2)
})

test("hides unreadable chapters and applies current deny lists on every request", async () => {
  const { data } = await index(globalId)
  expect(data.some(({ number }) => Number(number) >= 990)).toBe(false)
  const changed = application({
    hiddenChapterIds: [...hiddenChapterIds, pinnedId],
  })
  expect(
    (await index(globalId, "", changed)).data.some(({ id }) => id === pinnedId)
  ).toBe(false)
  await connection.db
    .update(chapter)
    .set({ moderationHiddenAt: publishedAt })
    .where(eq(chapter.id, pinnedId))
  try {
    expect((await index(globalId)).data.some(({ id }) => id === pinnedId)).toBe(
      false
    )
  } finally {
    await connection.db
      .update(chapter)
      .set({ moderationHiddenAt: null })
      .where(eq(chapter.id, pinnedId))
  }
})

test("returns an empty index for public manga without chapters and 404 for non-public manga", async () => {
  expect((await index(emptyId)).data).toEqual([])
  expect((await app.request(`/v1/manga/${uuidv7()}/aggregate`)).status).toBe(
    404
  )
  expect((await app.request(`/v1/manga/${r18Id}/aggregate`)).status).toBe(404)
  expect(
    (await index(r18Id, "", application({ hideR18: false }))).data
  ).toEqual([])
  for (const patch of [
    { publicationState: "draft" as const },
    { moderationHiddenAt: publishedAt },
    { deletedAt: publishedAt },
  ]) {
    const id = await createManga(patch)
    expect((await app.request(`/v1/manga/${id}/aggregate`)).status).toBe(404)
  }
  const hidden = application({ hiddenMangaIds: [globalId] })
  expect((await hidden.request(`/v1/manga/${globalId}/aggregate`)).status).toBe(
    404
  )
})

test("validates manga IDs, sort, direction and language", async () => {
  for (const suffix of [
    "not-a-uuid/aggregate",
    `${globalId}/aggregate?sort=invalid`,
    `${globalId}/aggregate?direction=invalid`,
    `${globalId}/aggregate?language=invalid_language`,
  ]) {
    expect((await app.request(`/v1/manga/${suffix}`)).status).toBe(400)
  }
})
