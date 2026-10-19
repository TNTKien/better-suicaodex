import { afterAll, beforeAll, expect, test, setDefaultTimeout } from "bun:test"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { eq, like } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { parseISO } from "date-fns"

import { createApp } from "../../src/app"
import { createDatabase } from "../../src/db/client"
import {
  chapter,
  manga,
  person,
  tag,
  translationGroupProfile,
} from "../../src/db/schema"
import { seedCatalog } from "../helpers/catalog-fixture"
import {
  SitemapResourceSchema,
  sitemapPageSize,
} from "../../src/features/catalog/sitemap"
import type { CatalogDependencies } from "../../src/features/catalog/routes"

setDefaultTimeout(120_000)
let connection: ReturnType<typeof createDatabase>
let app: ReturnType<typeof createApp>
let catalog: CatalogDependencies
type Entry = { path: string; lastModified: string | null }
const list = async (resource: string, application = app) => {
  const response = await application.request(`/v1/sitemap/${resource}/0`)
  if (response.status === 404) return []
  expect(response.status).toBe(200)
  return ((await response.json()) as { data: Entry[] }).data
}

beforeAll(async () => {
  const value = process.env.TEST_DATABASE_URL
  if (!value || !new URL(value).pathname.includes("test")) {
    throw new Error("TEST_DATABASE_URL must name a dedicated test database")
  }
  connection = createDatabase(value)
  await migrate(connection.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  })
  await seedCatalog(connection.db)
  catalog = {
    database: connection.db,
    assetBaseUrl: "https://assets.test",
    cache: undefined as unknown as CatalogDependencies["cache"],
  }
  app = createApp({ catalog, logger: () => {} })
})
afterAll(async () => {
  await connection?.pool.end()
})

test("index and pages use the same public resources and real modification dates", async () => {
  const response = await app.request("/v1/sitemap")
  expect(response.status).toBe(200)
  const { data } = (await response.json()) as {
    data: { resource: string; pages: number }[]
  }
  expect(data.map((entry) => entry.resource)).toEqual(
    SitemapResourceSchema.options
  )
  for (const { resource, pages } of data) {
    const entries = await list(resource)
    expect(entries.length).toBeLessThanOrEqual(sitemapPageSize)
    expect(pages).toBeGreaterThan(0)
    expect(new Set(entries.map((entry) => entry.path)).size).toBe(
      entries.length
    )
    for (const entry of entries) {
      expect(entry.path).toMatch(new RegExp(`^/${resource}/`))
      expect(entry.path).not.toMatch(/[?#]/)
    }
  }
  const entry = (await list("manga"))[0]!
  const id = entry.path.split("/")[2]!
  const changed = parseISO("2026-10-15T01:02:03Z")
  await connection.db
    .update(manga)
    .set({ updatedAt: changed, latestChapterPublishedAt: changed })
    .where(eq(manga.id, id))
  expect(
    (await list("manga")).find((value) => value.path === entry.path)
      ?.lastModified
  ).toBe("2026-10-15T01:02:03Z")
  expect(
    (await list("tag")).every((value) => value.lastModified === null)
  ).toBe(true)
})

test("invalid and absent shards fail explicitly", async () => {
  for (const path of [
    "/v1/sitemap/user/0",
    "/v1/sitemap/manga/-1",
    "/v1/sitemap/manga/1.5",
    "/v1/sitemap/manga/100000",
  ]) {
    expect((await app.request(path)).status).toBe(400)
  }
  expect((await app.request("/v1/sitemap/manga/99999")).status).toBe(404)
})

test("more than 10000 entries are split into stable pages without duplicates", async () => {
  const prefix = `sitemap-${randomUUID()}`
  const fixtures = Array.from({ length: sitemapPageSize + 1 }, (_, index) => ({
    id: randomUUID(),
    slug: `${prefix}-${index}`,
    group: "format",
    name: `${prefix} ${index}`,
  }))
  await connection.db.insert(tag).values(fixtures)
  try {
    const first = await list("tag")
    const response = await app.request("/v1/sitemap/tag/1")
    expect(response.status).toBe(200)
    const second = ((await response.json()) as { data: Entry[] }).data
    expect(first.length).toBe(sitemapPageSize)
    expect(second.length).toBeGreaterThan(0)
    expect(second.length).toBeLessThanOrEqual(sitemapPageSize)
    const paths = [...first, ...second].map((entry) => entry.path)
    expect(paths).toEqual([...paths].sort())
    const unique = new Set(paths)
    expect(unique.size).toBe(paths.length)
    expect(
      fixtures.every((entry) => unique.has(`/tag/${entry.id}/${entry.slug}`))
    ).toBe(true)
    expect(await list("tag")).toEqual(first)
    const index = await app.request("/v1/sitemap")
    const { data } = (await index.json()) as {
      data: { resource: string; pages: number }[]
    }
    expect(data.find((entry) => entry.resource === "tag")?.pages).toBe(2)
    expect((await app.request("/v1/sitemap/tag/2")).status).toBe(404)
  } finally {
    await connection.db.delete(tag).where(like(tag.slug, `${prefix}-%`))
  }
})

test("hidden, draft, deleted, R18 and unreadable content stays out of sitemap pages", async () => {
  const entry = (await list("manga"))[0]!
  const id = entry.path.split("/")[2]!
  const [original] = await connection.db
    .select()
    .from(manga)
    .where(eq(manga.id, id))
  const published = parseISO("2026-10-15T00:00:00Z")
  const baseline = {
    publicationState: original!.publicationState,
    moderationHiddenAt: original!.moderationHiddenAt,
    deletedAt: original!.deletedAt,
    contentRating: original!.contentRating,
  }
  try {
    for (const patch of [
      { publicationState: "draft" as const },
      { moderationHiddenAt: published },
      { deletedAt: published },
      { contentRating: "pornographic" as const },
    ]) {
      await connection.db
        .update(manga)
        .set({ ...baseline, ...patch })
        .where(eq(manga.id, id))
      expect(
        (await list("manga")).some((value) => value.path === entry.path)
      ).toBe(false)
      const chapters = await list("chapter")
      const own = await connection.db
        .select({ id: chapter.id })
        .from(chapter)
        .where(eq(chapter.mangaId, id))
      expect(
        chapters.some((value) =>
          own.some((item) => value.path === `/chapter/${item.id}`)
        )
      ).toBe(false)
    }
  } finally {
    await connection.db.update(manga).set(baseline).where(eq(manga.id, id))
  }
  for (const hiddenId of [id]) {
    const hidden = createApp({
      catalog: { ...catalog, hiddenMangaIds: [hiddenId] },
      logger: () => {},
    })
    expect(
      (await list("manga", hidden)).some((value) => value.path === entry.path)
    ).toBe(false)
  }
  const chapterEntry = (await list("chapter"))[0]!
  const chapterId = chapterEntry.path.split("/")[2]!
  const hidden = createApp({
    catalog: { ...catalog, hiddenChapterIds: [chapterId] },
    logger: () => {},
  })
  expect(
    (await list("chapter", hidden)).some(
      (value) => value.path === chapterEntry.path
    )
  ).toBe(false)
  await connection.db
    .update(chapter)
    .set({ isFull: false })
    .where(eq(chapter.id, chapterId))
  try {
    expect(
      (await list("chapter")).some((value) => value.path === chapterEntry.path)
    ).toBe(false)
  } finally {
    await connection.db
      .update(chapter)
      .set({ isFull: true })
      .where(eq(chapter.id, chapterId))
  }
})

test("moderated tags, unpublished groups and people without public roles are excluded", async () => {
  const tagEntry = (await list("tag"))[0]!
  const tagId = tagEntry.path.split("/")[2]!
  await connection.db
    .update(tag)
    .set({ moderationHiddenAt: parseISO("2026-10-15T00:00:00Z") })
    .where(eq(tag.id, tagId))
  try {
    expect(
      (await list("tag")).some((value) => value.path === tagEntry.path)
    ).toBe(false)
  } finally {
    await connection.db
      .update(tag)
      .set({ moderationHiddenAt: null })
      .where(eq(tag.id, tagId))
  }
  const groupEntry = (await list("group"))[0]!
  const groupId = groupEntry.path.split("/")[2]!
  await connection.db
    .update(translationGroupProfile)
    .set({ publicationState: "draft" })
    .where(eq(translationGroupProfile.organizationId, groupId))
  try {
    expect(
      (await list("group")).some((value) => value.path === groupEntry.path)
    ).toBe(false)
  } finally {
    await connection.db
      .update(translationGroupProfile)
      .set({ publicationState: "published" })
      .where(eq(translationGroupProfile.organizationId, groupId))
  }
  const orphanId = randomUUID()
  await connection.db.insert(person).values({
    id: orphanId,
    name: "Orphan sitemap person",
    slug: "orphan-sitemap-person",
  })
  try {
    expect(
      (await list("author")).some((value) => value.path.includes(orphanId))
    ).toBe(false)
    expect(
      (await list("artist")).some((value) => value.path.includes(orphanId))
    ).toBe(false)
  } finally {
    await connection.db.delete(person).where(eq(person.id, orphanId))
  }
})
