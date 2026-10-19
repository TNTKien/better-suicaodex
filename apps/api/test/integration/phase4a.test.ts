import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

import { parseISO } from "date-fns"
import { and, count, eq, inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  chapter,
  chapterGroup,
  chapterPage,
  chapterStats,
  comment,
  manga,
  mangaGroup,
  mangaPerson,
  mangaStats,
  mangaTag,
  mangaVolume,
  member,
  organization as translationGroup,
  person,
  tag,
  translationGroupProfile,
  translationGroupMangaViewStats,
  user,
  userProfile,
} from "../../src/db/schema"
import { createRuntime } from "../../src/runtime"
import type { Runtime } from "../../src/runtime"
import { BusinessCache } from "../../src/shared/cache"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { RuntimeEnv } from "../../src/shared/env"
import {
  catalogGroupSlugs,
  catalogChapterIds,
  catalogMangaIds,
  catalogPersonIds,
  catalogTagIds,
  seedCatalog,
} from "../helpers/catalog-fixture"

const noop = () => undefined
setDefaultTimeout(120_000)
let env: RuntimeEnv
let runtime: Runtime
let app: ReturnType<typeof createApp>
let mangaId = ""
let chapterId = ""
let systemGroupId = ""
let tagId = ""
let emptyTagId = ""
let inactiveGroupId = ""
let emptyGroupId = ""
let hiddenGroupId = ""
let emptyPersonId = ""
let authorOnlyPersonId = ""
let artistOnlyPersonId = ""
let dualRolePersonId = ""
const commentEmail = `phase6a-${randomUUID()}@example.com`
const groupLeaderId = randomUUID()
const groupLeaderEmail = `phase5f-leader-${randomUUID()}@example.com`
const commentIds: string[] = []

describe.serial("Phase 4A public catalog", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    }

    env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      ASSET_BASE_URL: "http://localhost:9000/",
      REDIS_PREFIX: `${process.env.REDIS_PREFIX ?? "redive:test"}:phase4a-test`,
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    await seedCatalog(runtime.database)
    await seedCatalog(runtime.database)
    systemGroupId = (
      await runtime.database
        .select({ id: translationGroup.id })
        .from(translationGroup)
        .where(eq(translationGroup.slug, "system"))
    )[0]!.id
    const [emptyTag] = await runtime.database
      .insert(tag)
      .values({
        id: "018f0000-0000-7000-8000-000000000001",
        slug: "018f0000-0000-7000-8000-000000000001",
        group: "format",
        name: "Phase 5E Empty Tag",
      })
      .onConflictDoUpdate({
        target: tag.id,
        set: {
          slug: "018f0000-0000-7000-8000-000000000001",
          group: "format",
          name: "Phase 5E Empty Tag",
        },
      })
      .returning({ id: tag.id })
    emptyTagId = emptyTag!.id
    const testGroupSlugs = [
      "phase5f-inactive-group",
      "phase5f-empty-group",
      "phase5f-hidden-group",
    ]
    await runtime.database
      .delete(translationGroup)
      .where(inArray(translationGroup.slug, testGroupSlugs))
    const groups = await runtime.database
      .insert(translationGroup)
      .values([
        {
          id: randomUUID(),
          slug: testGroupSlugs[0]!,
          name: "Phase 5F Inactive Group",
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          slug: testGroupSlugs[1]!,
          name: "Phase 5F Empty Group",
          createdAt: new Date(),
        },
        {
          id: randomUUID(),
          slug: testGroupSlugs[2]!,
          name: "Phase 5F Hidden Group",
          createdAt: new Date(),
        },
      ])
      .returning({
        id: translationGroup.id,
        slug: translationGroup.slug,
      })
    await runtime.database.insert(translationGroupProfile).values([
      {
        organizationId: groups[0]!.id,
        createdAt: new Date("2026-01-02T03:04:05.000Z"),
        description: "Inactive but still public attribution",
        links: {
          website: "https://scan.example/about",
          discord: "suicaodex",
          twitter: "@suicaodex",
          unknown: "https://ignored.example",
        },
        inactive: true,
        publicationState: "published",
      },
      {
        organizationId: groups[1]!.id,
        publicationState: "published",
      },
      {
        organizationId: groups[2]!.id,
        publicationState: "hidden",
      },
    ])
    inactiveGroupId = groups.find(({ slug }) => slug === testGroupSlugs[0])!.id
    emptyGroupId = groups.find(({ slug }) => slug === testGroupSlugs[1])!.id
    hiddenGroupId = groups.find(({ slug }) => slug === testGroupSlugs[2])!.id
    await runtime.database.insert(user).values({
      id: groupLeaderId,
      email: groupLeaderEmail,
      emailVerified: true,
      image: "https://example.com/group-leader.webp",
      name: "Phase 5F Leader",
    })
    await runtime.database.insert(userProfile).values({ userId: groupLeaderId })
    await runtime.database.insert(member).values({
      id: randomUUID(),
      organizationId: inactiveGroupId,
      userId: groupLeaderId,
      role: "owner",
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    })
    const testPersonIds = [
      "018f0000-0000-7000-8000-000000000002",
      "018f0000-0000-7000-8000-000000000003",
      "018f0000-0000-7000-8000-000000000004",
    ]
    await runtime.database
      .delete(person)
      .where(inArray(person.id, testPersonIds))
    const people = await runtime.database
      .insert(person)
      .values([
        {
          id: testPersonIds[0]!,
          slug: "018f0000-0000-7000-8000-000000000002",
          name: "Phase 5G Empty Person",
          description: "Creator without a public manga relation",
          links: {
            website: "https://creator.example/about",
            twitter: "@creator",
            pixiv: "https://www.pixiv.net/users/123",
            unknown: "https://ignored.example",
          },
        },
        {
          id: testPersonIds[1]!,
          slug: "018f0000-0000-7000-8000-000000000003",
          name: "Phase 5G Author Only",
        },
        {
          id: testPersonIds[2]!,
          slug: "018f0000-0000-7000-8000-000000000004",
          name: "Phase 5G Artist Only",
        },
      ])
      .returning({ id: person.id })
    emptyPersonId = people.find(({ id }) => id === testPersonIds[0])!.id
    authorOnlyPersonId = people.find(({ id }) => id === testPersonIds[1])!.id
    artistOnlyPersonId = people.find(({ id }) => id === testPersonIds[2])!.id
    await runtime.cache.invalidateCatalog()
    app = createApp({
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: runtime.cache,
        database: runtime.database,
      },
      logger: noop,
      readiness: runtime.readiness,
      webOrigin: env.WEB_ORIGIN,
    })
  })

  afterAll(async () => {
    if (!runtime) return
    for (const id of commentIds.toReversed()) {
      await runtime.database.delete(comment).where(eq(comment.id, id))
    }
    await runtime.database.delete(user).where(eq(user.email, commentEmail))
    await runtime.database.delete(user).where(eq(user.id, groupLeaderId))
    await runtime.database
      .delete(manga)
      .where(inArray(manga.id, catalogMangaIds))
    await runtime.database
      .delete(person)
      .where(
        inArray(person.id, [
          ...catalogPersonIds,
          "018f0000-0000-7000-8000-000000000002",
          "018f0000-0000-7000-8000-000000000003",
          "018f0000-0000-7000-8000-000000000004",
        ])
      )
    if (emptyTagId) {
      await runtime.database.delete(tag).where(eq(tag.id, emptyTagId))
    }
    await runtime.database.delete(tag).where(inArray(tag.id, catalogTagIds))
    await runtime.database
      .delete(translationGroup)
      .where(
        inArray(translationGroup.slug, [
          ...catalogGroupSlugs,
          "phase5f-inactive-group",
          "phase5f-empty-group",
          "phase5f-hidden-group",
        ])
      )
    await runtime.cache.invalidateCatalog()
    await runtime.close()
  })

  test("rerunnable seed preserves the synthetic native catalog", async () => {
    const [mangaCount] = await runtime.database
      .select({ value: count() })
      .from(manga)
      .where(inArray(manga.id, catalogMangaIds))
    const [chapterCount] = await runtime.database
      .select({ value: count() })
      .from(chapter)
      .where(inArray(chapter.id, catalogChapterIds))
    const [pageCount] = await runtime.database
      .select({ value: count() })
      .from(chapterPage)
      .innerJoin(
        chapter,
        and(
          eq(chapter.id, chapterPage.chapterId),
          inArray(chapter.id, catalogChapterIds)
        )
      )

    expect(Number(mangaCount?.value)).toBe(10)
    expect(Number(chapterCount?.value)).toBe(11)
    expect(Number(pageCount?.value)).toBe(146)
  })

  test("lists canonical UUID manga with resolved covers", async () => {
    const first = await app.request("/v1/manga")
    expect(first.status).toBe(200)
    const body = (await first.json()) as {
      data: Array<{
        id: string
        slug: string
        cover: { url: string }
        tags: Array<{ name: string }>
        authors: Array<{ name: string }>
        alternativeTitles: Record<string, string[]>
        statistics: { views: number; follows: number; comments: number }
        latestChapter: {
          number: string | null
          groups: Array<{ name: string }>
          statistics: { views: number; comments: number }
        } | null
      }>
      meta: { total: number }
    }

    expect(body.meta.total).toBeGreaterThanOrEqual(3)
    expect(body.data).toHaveLength(8)
    expect(body.data.map(({ slug }) => slug)).toEqual([
      "sample-manga-1",
      "sample-manga-4",
      "sample-manga-5",
      "sample-manga-6",
      "sample-manga-7",
      "sample-manga-8",
      "sample-manga-9",
      "sample-manga-10",
    ])
    expect(body.data[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.data[0]?.id).not.toBe("f9a5ed37-bdac-454f-8ba6-3b445abdd2f8")
    expect(body.data[0]?.cover.url).toMatch(
      /^http:\/\/localhost:9000\/covers\/.+\.512\.webp$/
    )
    expect(body.data[0]?.tags.length).toBeGreaterThan(0)
    expect(body.data[0]?.authors.length).toBeGreaterThan(0)
    expect(body.data[0]?.alternativeTitles).toMatchObject({
      en: ["Sample title 1 en 1"],
    })
    const statsRows = await runtime.database
      .select()
      .from(mangaStats)
      .where(
        inArray(
          mangaStats.mangaId,
          body.data.map(({ id }) => id)
        )
      )
    for (const item of body.data) {
      const stats = statsRows.find(({ mangaId }) => mangaId === item.id)
      expect(item.statistics).toEqual({
        views: Number(stats?.views ?? 0),
        follows: Number(stats?.follows ?? 0),
        comments: Number(stats?.comments ?? 0),
      })
    }

    const withoutChapters = (await (
      await app.request("/v1/manga?hasChapter=false")
    ).json()) as {
      data: Array<{ latestChapter: unknown }>
      meta: { total: number }
    }
    expect(withoutChapters.meta.total).toBe(2)
    expect(
      withoutChapters.data.every(({ latestChapter }) => !latestChapter)
    ).toBe(true)
    const allManga = (await (
      await app.request("/v1/manga?hasChapter=all")
    ).json()) as { meta: { total: number } }
    expect(allManga.meta.total).toBe(
      body.meta.total + withoutChapters.meta.total
    )

    const chie = body.data.find(({ slug }) => slug === "sample-manga-1")!
    expect(chie.latestChapter).toMatchObject({
      number: "9.5",
      groups: [{ name: "System" }],
      statistics: { views: 0, comments: 0 },
    })
    mangaId = chie.id

    const hits = runtime.cache.metrics.hits
    const second = await app.request("/v1/manga")
    expect(second.status).toBe(200)
    expect(runtime.cache.metrics.hits).toBe(hits)
  })

  test("serves detail, chapter list, and ordered reader pages", async () => {
    const detail = await app.request(`/v1/manga/${mangaId}`)
    expect(detail.status).toBe(200)
    const detailBody = (await detail.json()) as {
      firstChapter: { id: string; number: string | null } | null
      links: Array<{ key: string; label: string; url: string }>
    }
    expect(detailBody).toMatchObject({
      id: mangaId,
      authors: [{ name: "Sample people 1" }],
      artists: [{ name: "Sample people 1" }],
      groups: [{ name: "System", slug: "system", avatarUrl: null }],
      firstChapter: { number: "7.6" },
    })
    expect(detailBody.links).toEqual(
      expect.arrayContaining([
        {
          key: "al",
          label: "AniList",
          url: "https://anilist.co/manga/123456789",
        },
      ])
    )

    const avatarUrl = "https://images.example.test/system-group.webp"
    await runtime.database
      .update(translationGroup)
      .set({ logo: avatarUrl })
      .where(eq(translationGroup.id, systemGroupId))
    try {
      await runtime.cache.invalidateCatalog()
      const withAvatar = await app.request(`/v1/manga/${mangaId}`)
      expect(withAvatar.status).toBe(200)
      expect(await withAvatar.json()).toMatchObject({
        groups: [{ id: systemGroupId, avatarUrl }],
      })
    } finally {
      await runtime.database
        .update(translationGroup)
        .set({ logo: null })
        .where(eq(translationGroup.id, systemGroupId))
      await runtime.cache.invalidateCatalog()
    }

    const list = await app.request(
      `/v1/manga/${mangaId}/chapters?page=1&limit=1`
    )
    expect(list.status).toBe(200)
    const listBody = (await list.json()) as {
      data: Array<{
        id: string
        number: string
        volume: string
        groups: Array<{ slug: string }>
        uploader: { id: string | null; name: string }
        statistics: { views: number; comments: number }
      }>
      meta: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(listBody.meta).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
      releaseTotal: 2,
    })
    expect(listBody.data).toMatchObject([
      {
        number: "9.5",
        volume: "2",
        groups: [{ slug: "system" }],
        uploader: { id: null, name: "System" },
        statistics: { views: 0, comments: 0 },
      },
    ])
    chapterId = listBody.data[0]!.id

    const secondPage = (await (
      await app.request(`/v1/manga/${mangaId}/chapters?page=2&limit=1`)
    ).json()) as { data: Array<{ id: string; number: string; volume: string }> }
    expect(secondPage.data).toMatchObject([{ number: "7.6", volume: "1" }])
    expect(secondPage.data[0]?.id).not.toBe(chapterId)

    const reader = await app.request(`/v1/chapters/${chapterId}`)
    expect(reader.status).toBe(200)
    const readerBody = (await reader.json()) as {
      manga: { cover: { url: string } | null; isLongStrip: boolean }
      pages: Array<{ position: number; url: string }>
      previous: unknown
      next: unknown
    }
    expect(readerBody.pages).toHaveLength(5)
    expect(readerBody.manga.cover?.url).toStartWith(
      "http://localhost:9000/covers/"
    )
    expect(readerBody.manga.isLongStrip).toBe(false)
    expect(readerBody.pages.map(({ position }) => position)).toEqual([
      0, 1, 2, 3, 4,
    ])
    expect(readerBody.pages[0]?.url).toStartWith(
      "http://localhost:9000/data/69280506-3498-47e6-8f16-61413d81bdab/"
    )
    expect(readerBody.previous).toMatchObject({ number: "7.6" })
    expect(readerBody.next).toBeNull()
  })

  test("marks reader chapters from long-strip manga", async () => {
    const [longStripTag] = await runtime.database
      .select({ id: tag.id })
      .from(tag)
      .where(eq(tag.slug, "long-strip"))

    try {
      await runtime.database
        .insert(mangaTag)
        .values({ mangaId, tagId: longStripTag!.id })
        .onConflictDoNothing()
      await runtime.cache.invalidateCatalog()

      const reader = await app.request(`/v1/chapters/${chapterId}`)
      expect(reader.status).toBe(200)
      expect(
        ((await reader.json()) as { manga: { isLongStrip: boolean } }).manga
          .isLongStrip
      ).toBe(true)
    } finally {
      await runtime.database
        .delete(mangaTag)
        .where(
          and(
            eq(mangaTag.mangaId, mangaId),
            eq(mangaTag.tagId, longStripTag!.id)
          )
        )
      await runtime.cache.invalidateCatalog()
    }
  })

  test("searches and filters the catalog with stable pagination", async () => {
    const detail = (await (
      await app.request(`/v1/manga/${mangaId}`)
    ).json()) as {
      tags: Array<{ id: string }>
      authors: Array<{ id: string }>
      artists: Array<{ id: string }>
      groups: Array<{ id: string }>
    }

    const alternative = await app.request(
      "/v1/manga?q=%20SAMPLE%20%20%20TITLE%201%20EN%201%20"
    )
    expect(alternative.status).toBe(200)
    expect(
      ((await alternative.json()) as { data: Array<{ id: string }> }).data.map(
        ({ id }) => id
      )
    ).toContain(mangaId)
    expect(
      (
        (await (await app.request("/v1/manga?q=%25")).json()) as {
          data: unknown[]
        }
      ).data
    ).toEqual([])

    const include = new URLSearchParams({ status: "completed", language: "VI" })
    include.append("includeTag", detail.tags[0]!.id)
    include.append("includeTag", detail.tags[1]!.id)
    include.append("author", detail.authors[0]!.id)
    include.append("artist", detail.artists[0]!.id)
    include.append("group", detail.groups[0]!.id)
    const included = (await (
      await app.request(`/v1/manga?${include}`)
    ).json()) as { data: Array<{ id: string; tags: Array<{ id: string }> }> }
    expect(included.data.map(({ id }) => id)).toContain(mangaId)
    expect(
      included.data.every((item) =>
        detail.tags
          .slice(0, 2)
          .every(({ id }) => item.tags.some((itemTag) => itemTag.id === id))
      )
    ).toBe(true)

    const excluded = (await (
      await app.request(`/v1/manga?excludeTag=${detail.tags[0]!.id}`)
    ).json()) as { data: Array<{ tags: Array<{ id: string }> }> }
    expect(
      excluded.data.every((item) =>
        item.tags.every(({ id }) => id !== detail.tags[0]!.id)
      )
    ).toBe(true)

    const includeOr = new URLSearchParams({ includeTagMode: "or" })
    includeOr.append("includeTag", detail.tags[0]!.id)
    includeOr.append("includeTag", emptyTagId)
    expect(
      (
        (await (await app.request(`/v1/manga?${includeOr}`)).json()) as {
          data: Array<{ id: string }>
        }
      ).data.map(({ id }) => id)
    ).toContain(mangaId)

    const includeAnd = new URLSearchParams({ includeTagMode: "and" })
    includeAnd.append("includeTag", detail.tags[0]!.id)
    includeAnd.append("includeTag", emptyTagId)
    expect(
      (
        (await (await app.request(`/v1/manga?${includeAnd}`)).json()) as {
          data: Array<{ id: string }>
        }
      ).data
    ).toEqual([])

    const excludeAnd = new URLSearchParams({ excludeTagMode: "and" })
    excludeAnd.append("excludeTag", detail.tags[0]!.id)
    excludeAnd.append("excludeTag", emptyTagId)
    expect(
      (
        (await (await app.request(`/v1/manga?${excludeAnd}`)).json()) as {
          data: Array<{ id: string }>
        }
      ).data.map(({ id }) => id)
    ).toContain(mangaId)

    const firstPage = (await (
      await app.request("/v1/manga?sort=title&direction=asc&limit=3&page=1")
    ).json()) as { data: Array<{ id: string; title: string }> }
    const secondPage = (await (
      await app.request("/v1/manga?sort=title&direction=asc&limit=3&page=2")
    ).json()) as { data: Array<{ id: string; title: string }> }
    expect(firstPage.data.map(({ title }) => title)).toEqual(
      [...firstPage.data.map(({ title }) => title)].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      )
    )
    expect(
      firstPage.data.some(({ id }) =>
        secondPage.data.some((item) => item.id === id)
      )
    ).toBe(false)
  })

  test("recommends visible manga by author and meaningful shared tags", async () => {
    const detail = (await (
      await app.request(`/v1/manga/${mangaId}`)
    ).json()) as {
      authors: Array<{ id: string }>
      tags: Array<{ id: string; group: string }>
    }
    const response = await app.request(`/v1/manga/${mangaId}/recommendations`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      byAuthor: Array<{
        id: string
        authors: Array<{ id: string }>
      }>
      similar: Array<{
        id: string
        tags: Array<{ id: string; group: string }>
      }>
    }
    const authorIds = new Set(detail.authors.map(({ id }) => id))
    const tagIds = new Set(
      detail.tags
        .filter(({ group }) => group === "genre" || group === "theme")
        .map(({ id }) => id)
    )
    const allIds = [...body.byAuthor, ...body.similar].map(({ id }) => id)

    expect(body.byAuthor.length).toBeLessThanOrEqual(10)
    expect(body.similar.length).toBeGreaterThan(0)
    expect(body.similar.length).toBeLessThanOrEqual(10)
    expect(allIds).not.toContain(mangaId)
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(
      body.byAuthor.every((item) =>
        item.authors.some(({ id }) => authorIds.has(id))
      )
    ).toBe(true)
    expect(
      body.similar.every(
        (item) =>
          item.tags.filter(
            ({ id, group }) =>
              (group === "genre" || group === "theme") && tagIds.has(id)
          ).length >= Math.min(3, tagIds.size)
      )
    ).toBe(true)
  })

  test("serves latest chapters and a valid random manga", async () => {
    const latest = await app.request("/v1/chapters/latest?limit=5")
    expect(latest.status).toBe(200)
    const latestBody = (await latest.json()) as {
      data: Array<{
        id: string
        publishedAt: string
        manga: { id: string; slug: string; cover: unknown }
      }>
      meta: { total: number }
    }
    expect(latestBody.data).toHaveLength(5)
    expect(latestBody.meta.total).toBe(9)
    expect(latestBody.data.every(({ manga }) => Boolean(manga.id))).toBe(true)
    expect(latestBody.data.map(({ publishedAt }) => publishedAt)).toEqual(
      [...latestBody.data.map(({ publishedAt }) => publishedAt)]
        .sort()
        .reverse()
    )

    const random = await app.request("/v1/manga/random")
    expect(random.status).toBe(200)
    const randomBody = (await random.json()) as {
      data: Array<{ id: string; latestChapter: unknown }>
    }
    expect(randomBody.data).toHaveLength(1)
    expect(randomBody.data[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(randomBody.data[0]?.latestChapter).not.toBeNull()

    const batch = (await (
      await app.request("/v1/manga/random?limit=10")
    ).json()) as typeof randomBody
    expect(batch.data.length).toBeGreaterThan(1)
    expect(batch.data.length).toBeLessThanOrEqual(10)
    expect(new Set(batch.data.map(({ id }) => id)).size).toBe(batch.data.length)
    const repeat = (await (
      await app.request("/v1/manga/random?limit=10")
    ).json()) as typeof randomBody
    expect(repeat.data.map(({ id }) => id)).toEqual(
      batch.data.map(({ id }) => id)
    )
    for (const limit of ["0", "11", "1.5", "abc"])
      expect(
        (await app.request(`/v1/manga/random?limit=${limit}`)).status
      ).toBe(400)

    const selectedId = batch.data[0]!.id
    await runtime.database
      .update(manga)
      .set({ moderationHiddenAt: parseISO("2026-10-14T00:00:00Z") })
      .where(eq(manga.id, selectedId))
    try {
      const moderated = (await (
        await app.request("/v1/manga/random?limit=10")
      ).json()) as typeof randomBody
      expect(moderated.data.some(({ id }) => id === selectedId)).toBe(false)
      expect(moderated.data.map(({ id }) => id)).toEqual(
        batch.data.map(({ id }) => id).filter((id) => id !== selectedId)
      )
    } finally {
      await runtime.database
        .update(manga)
        .set({ moderationHiddenAt: null })
        .where(eq(manga.id, selectedId))
    }

    const all = (await (await app.request("/v1/manga?limit=100")).json()) as {
      data: Array<{ id: string }>
    }
    const emptyApp = createApp({
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: runtime.cache,
        database: runtime.database,
        hiddenMangaIds: all.data.map(({ id }) => id),
      },
      logger: noop,
    })
    expect(await (await emptyApp.request("/v1/manga/random")).json()).toEqual({
      data: [],
    })
  })

  test("lists tag taxonomy and reuses catalog for reverse lookup", async () => {
    const response = await app.request("/v1/tags")
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<{ id: string; slug: string; group: string; name: string }>
    }
    expect(body.data).toContainEqual({
      id: emptyTagId,
      slug: "018f0000-0000-7000-8000-000000000001",
      group: "format",
      name: "Phase 5E Empty Tag",
    })
    expect(body.data).toEqual(
      [...body.data].sort((left, right) =>
        [left.group, left.name, left.id]
          .join("\0")
          .localeCompare([right.group, right.name, right.id].join("\0"))
      )
    )

    const mangaDetail = (await (
      await app.request(`/v1/manga/${mangaId}`)
    ).json()) as { tags: Array<{ id: string }> }
    tagId = mangaDetail.tags[0]!.id
    const listedTag = body.data.find(({ id }) => id === tagId)!
    const detail = await app.request(`/v1/tags/${tagId}`)
    expect(detail.status).toBe(200)
    expect(await detail.json()).toEqual(listedTag)

    const reverse = (await (
      await app.request(`/v1/manga?includeTag=${tagId}`)
    ).json()) as { data: Array<{ tags: Array<{ id: string }> }> }
    expect(reverse.data.length).toBeGreaterThan(0)
    expect(
      reverse.data.every((item) => item.tags.some(({ id }) => id === tagId))
    ).toBe(true)

    const empty = (await (
      await app.request(`/v1/manga?includeTag=${emptyTagId}`)
    ).json()) as { data: unknown[] }
    expect(empty.data).toEqual([])
  })

  test("serves translation group attribution without duplicate manga", async () => {
    await runtime.database
      .insert(mangaGroup)
      .values({ mangaId, groupId: inactiveGroupId })
      .onConflictDoNothing()
    await runtime.database
      .insert(chapterGroup)
      .values({ chapterId, groupId: inactiveGroupId })
      .onConflictDoNothing()
    await runtime.database
      .insert(chapterStats)
      .values({ chapterId, views: 12n })
      .onConflictDoUpdate({
        target: chapterStats.chapterId,
        set: { views: 12n },
      })
    await runtime.database
      .insert(translationGroupMangaViewStats)
      .values({ groupId: inactiveGroupId, mangaId, views: 12 })
      .onConflictDoUpdate({
        target: [
          translationGroupMangaViewStats.groupId,
          translationGroupMangaViewStats.mangaId,
        ],
        set: { views: 12 },
      })
    await runtime.cache.invalidateCatalog()

    const response = await app.request("/v1/groups")
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      data: Array<{
        id: string
        slug: string
        name: string
        inactive: boolean
      }>
      meta: { page: number; limit: number; total: number; totalPages: number }
    }
    expect(body.data.some(({ id }) => id === hiddenGroupId)).toBe(false)
    expect(body.data).toContainEqual({
      id: inactiveGroupId,
      slug: "phase5f-inactive-group",
      name: "Phase 5F Inactive Group",
      avatarUrl: null,
      inactive: true,
    })
    expect(body.data).toEqual(
      [...body.data].sort((left, right) =>
        [left.name, left.id]
          .join("\0")
          .localeCompare([right.name, right.id].join("\0"))
      )
    )
    expect(body.meta).toMatchObject({ page: 1, limit: 20 })
    expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length)
    expect(body.meta.totalPages).toBe(Math.ceil(body.meta.total / 20))

    const secondPage = (await (
      await app.request("/v1/groups?page=2&limit=1")
    ).json()) as typeof body
    expect(secondPage.meta).toEqual({
      page: 2,
      limit: 1,
      total: body.meta.total,
      totalPages: body.meta.total,
    })
    expect(secondPage.data).toEqual([body.data[1]])

    const search = (await (
      await app.request("/v1/groups?q=inactive")
    ).json()) as typeof body
    expect(search.data).toEqual([
      {
        id: inactiveGroupId,
        slug: "phase5f-inactive-group",
        name: "Phase 5F Inactive Group",
        avatarUrl: null,
        inactive: true,
      },
    ])
    const escaped = (await (
      await app.request(`/v1/groups?${new URLSearchParams({ q: "%" })}`)
    ).json()) as typeof body
    expect(escaped.data).toEqual([])

    const systemGroup = body.data.find(({ slug }) => slug === "system")!
    const [catalog, systemReverse] = await Promise.all([
      app.request("/v1/manga"),
      app.request(`/v1/manga?group=${systemGroup.id}`),
    ])
    const catalogBody = (await catalog.json()) as { meta: { total: number } }
    const systemBody = (await systemReverse.json()) as {
      data: Array<{ id: string }>
      meta: { total: number }
    }
    expect(systemBody.meta.total).toBe(catalogBody.meta.total)
    expect(new Set(systemBody.data.map(({ id }) => id)).size).toBe(
      systemBody.data.length
    )

    const detail = await app.request(`/v1/groups/${inactiveGroupId}`)
    expect(detail.status).toBe(200)
    const detailBody = (await detail.json()) as {
      createdAt: string
      leader: string | null
      statistics: { views: number; mangaCount: number; chapterCount: number }
    }
    expect(detailBody).toMatchObject({
      id: inactiveGroupId,
      inactive: true,
      description: "Inactive but still public attribution",
      leader: "Phase 5F Leader",
      links: [
        { key: "website", url: "https://scan.example/about" },
        { key: "discord", url: "https://discord.gg/suicaodex" },
        { key: "twitter", url: "https://x.com/suicaodex" },
      ],
      statistics: { views: 12, mangaCount: 1, chapterCount: 1 },
    })
    expect(parseISO(detailBody.createdAt).toISOString()).toBe(
      "2026-01-02T03:04:05.000Z"
    )

    const reverse = (await (
      await app.request(`/v1/manga?group=${inactiveGroupId}`)
    ).json()) as { data: Array<{ id: string }>; meta: { total: number } }
    expect(reverse.data.map(({ id }) => id)).toContain(mangaId)
    expect(new Set(reverse.data.map(({ id }) => id)).size).toBe(
      reverse.data.length
    )

    const empty = (await (
      await app.request(`/v1/manga?group=${emptyGroupId}`)
    ).json()) as { data: unknown[] }
    expect(empty.data).toEqual([])
    expect((await app.request(`/v1/groups/${hiddenGroupId}`)).status).toBe(404)
    expect(
      (
        (await (
          await app.request(`/v1/manga?group=${hiddenGroupId}`)
        ).json()) as { data: unknown[] }
      ).data
    ).toEqual([])
  })

  test("serves person metadata and keeps author and artist roles separate", async () => {
    const mangaDetail = (await (
      await app.request(`/v1/manga/${mangaId}`)
    ).json()) as {
      authors: Array<{ id: string }>
      artists: Array<{ id: string }>
    }
    dualRolePersonId = mangaDetail.authors.find(({ id }) =>
      mangaDetail.artists.some((artist) => artist.id === id)
    )!.id
    await runtime.database
      .insert(mangaPerson)
      .values([
        { mangaId, personId: authorOnlyPersonId, role: "author" },
        { mangaId, personId: artistOnlyPersonId, role: "artist" },
      ])
      .onConflictDoNothing()
    await runtime.cache.invalidateCatalog()

    const [dual, authorOnly, artistOnly, empty] = await Promise.all([
      app.request(`/v1/people/${dualRolePersonId}`),
      app.request(`/v1/people/${authorOnlyPersonId}`),
      app.request(`/v1/people/${artistOnlyPersonId}`),
      app.request(`/v1/people/${emptyPersonId}`),
    ])
    expect(dual.status).toBe(200)
    expect(await dual.json()).toMatchObject({
      id: dualRolePersonId,
      roles: ["author", "artist"],
    })
    expect(await authorOnly.json()).toMatchObject({
      id: authorOnlyPersonId,
      roles: ["author"],
    })
    expect(await artistOnly.json()).toMatchObject({
      id: artistOnlyPersonId,
      roles: ["artist"],
    })
    expect(await empty.json()).toMatchObject({
      id: emptyPersonId,
      slug: "018f0000-0000-7000-8000-000000000002",
      roles: [],
      links: [
        { key: "website", url: "https://creator.example/about" },
        { key: "twitter", url: "https://x.com/creator" },
        { key: "pixiv", url: "https://www.pixiv.net/users/123" },
      ],
    })

    const authorSearch = await app.request(
      "/v1/people?role=author&q=author%20only"
    )
    expect(authorSearch.status).toBe(200)
    expect(await authorSearch.json()).toMatchObject({
      data: [{ id: authorOnlyPersonId, name: "Phase 5G Author Only" }],
    })
    expect(
      await (
        await app.request(
          `/v1/people?role=artist&id=${artistOnlyPersonId}&limit=50`
        )
      ).json()
    ).toMatchObject({ data: [{ id: artistOnlyPersonId }] })

    for (const [role, id, opposite] of [
      ["author", authorOnlyPersonId, "artist"],
      ["artist", artistOnlyPersonId, "author"],
    ] as const) {
      const matched = (await (
        await app.request(`/v1/manga?${role}=${id}`)
      ).json()) as { data: Array<{ id: string }> }
      const unmatched = (await (
        await app.request(`/v1/manga?${opposite}=${id}`)
      ).json()) as { data: Array<{ id: string }> }
      expect(matched.data.map(({ id }) => id)).toContain(mangaId)
      expect(unmatched.data).toEqual([])
    }
    for (const role of ["author", "artist"] as const) {
      const reverse = (await (
        await app.request(`/v1/manga?${role}=${dualRolePersonId}`)
      ).json()) as { data: Array<{ id: string }> }
      expect(reverse.data.map(({ id }) => id)).toContain(mangaId)
    }
  })

  test("serves empty metadata and orders global chapter numbers regardless of volume", async () => {
    const [emptyManga] = await runtime.database
      .insert(manga)
      .values({
        ownerGroupId: systemGroupId,
        id: "018f0000-0000-7000-8000-000000000006",
        slug: "018f0000-0000-7000-8000-000000000006",
        title: "Phase 5B Empty Feed",
        searchTitle: "phase 5b empty feed",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
        publicationState: "published",
        publishedAt: parseISO("2026-09-02T00:00:00.000Z"),
        links: { bl: "ignored", raw: "javascript:alert(1)" },
      })
      .returning({ id: manga.id })

    try {
      const detail = await app.request(`/v1/manga/${emptyManga!.id}`)
      expect(detail.status).toBe(200)
      expect(await detail.json()).toMatchObject({
        id: emptyManga!.id,
        firstChapter: null,
        latestChapter: null,
        links: [],
        tags: [],
        authors: [],
        artists: [],
        groups: [],
        availableLanguages: [],
      })

      const feed = await app.request(
        `/v1/manga/${emptyManga!.id}/chapters?page=1&limit=20`
      )
      expect(feed.status).toBe(200)
      expect(await feed.json()).toEqual({
        data: [],
        slots: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0, releaseTotal: 0 },
      })

      const volumes = await runtime.database
        .insert(mangaVolume)
        .values(
          ["2", "10"].map((number) => ({ mangaId: emptyManga!.id, number }))
        )
        .returning({ id: mangaVolume.id, number: mangaVolume.number })
      const volumeId = (number: string) =>
        volumes.find((volume) => Number(volume.number) === Number(number))!.id
      const inserted = await runtime.database
        .insert(chapter)
        .values(
          [
            { volumeId: volumeId("10"), number: "2" },
            { volumeId: volumeId("2"), number: "10" },
            { volumeId: volumeId("2"), number: "9.5" },
            { volumeId: null, number: "500" },
            {
              volumeId: null,
              number: null,
              publishedAt: parseISO("2026-09-01T00:00:00Z"),
            },
            { volumeId: null, number: null },
            { volumeId: null, number: null },
          ].map((item) => ({
            ownerGroupId: systemGroupId,
            mangaId: emptyManga!.id,
            language: "vi",
            pageCount: 1,
            availablePageCount: 1,
            isFull: true,
            publicationState: "published" as const,
            publishedAt: parseISO("2026-09-03T00:00:00Z"),
            ...item,
          }))
        )
        .returning({ id: chapter.id })
      await runtime.cache.invalidateCatalog()
      const ordered = (await (
        await app.request(`/v1/manga/${emptyManga!.id}/chapters?limit=20`)
      ).json()) as {
        data: Array<{
          id: string
          volume: string | null
          number: string | null
        }>
      }
      expect(
        ordered.data.map(({ volume, number }) => [volume, number])
      ).toEqual([
        [null, "500"],
        ["2", "10"],
        ["2", "9.5"],
        ["10", "2"],
        [null, null],
        [null, null],
        [null, null],
      ])
      expect(ordered.data.slice(4).map(({ id }) => id)).toEqual(
        inserted
          .slice(4)
          .map(({ id }) => id)
          .sort()
      )
      const ascending = (await (
        await app.request(
          `/v1/manga/${emptyManga!.id}/chapters?limit=20&direction=asc`
        )
      ).json()) as {
        data: Array<{
          id: string
          volume: string | null
          number: string | null
        }>
      }
      expect(
        ascending.data.map(({ volume, number }) => [volume, number])
      ).toEqual([
        ["10", "2"],
        ["2", "9.5"],
        ["2", "10"],
        [null, "500"],
        [null, null],
        [null, null],
        [null, null],
      ])
      expect(ascending.data.slice(4).map(({ id }) => id)).toEqual(
        inserted
          .slice(4)
          .map(({ id }) => id)
          .sort()
      )

      const refreshedDetail = (await (
        await app.request(`/v1/manga/${emptyManga!.id}`)
      ).json()) as { firstChapter: { id: string } | null }
      expect(refreshedDetail.firstChapter?.id).toBe(inserted[0]!.id)

      const reader = (await (
        await app.request(`/v1/chapters/${inserted[3]!.id}`)
      ).json()) as {
        previous: { id: string } | null
        next: { id: string } | null
      }
      expect(reader.previous?.id).toBe(inserted[1]!.id)
      expect(reader.next).toBeNull()
    } finally {
      await runtime.database.delete(manga).where(eq(manga.id, emptyManga!.id))
    }
  })

  test("serves authenticated chapter comments with cursor pagination and tombstones", async () => {
    const unauthenticated = await app.request(
      `/v1/chapters/${chapterId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: env.WEB_ORIGIN },
        body: JSON.stringify({ body: "Không có session" }),
      }
    )
    expect(unauthenticated.status).toBe(401)

    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: env.WEB_ORIGIN },
      body: JSON.stringify({
        name: "Phase 6A Reader",
        email: commentEmail,
        password: "phase6a-integration-password",
      }),
    })
    expect(signUp.status).toBe(200)
    const cookie = signUp.headers.get("set-cookie")?.split(";", 1)[0]
    expect(cookie).toBeTruthy()

    const create = async (body: string, parentId?: string) => {
      const response = await app.request(`/v1/chapters/${chapterId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie!,
          Origin: env.WEB_ORIGIN,
        },
        body: JSON.stringify({ body, parentId }),
      })
      expect(response.status).toBe(201)
      return (await response.json()) as {
        id: string
        body: string
        version: number
      }
    }
    const first = await create("Bình luận đầu tiên")
    commentIds.push(first.id)
    const reply = await create("Bình luận trả lời", first.id)
    commentIds.push(reply.id)
    const second = await create("Bình luận thứ hai")
    commentIds.push(second.id)

    const nestedReply = await app.request(
      `/v1/chapters/${chapterId}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie!,
          Origin: env.WEB_ORIGIN,
        },
        body: JSON.stringify({ body: "Reply lồng", parentId: reply.id }),
      }
    )
    expect(nestedReply.status).toBe(400)

    const firstPage = (await (
      await app.request(`/v1/chapters/${chapterId}/comments?limit=1`)
    ).json()) as {
      data: Array<{ id: string; replies: Array<{ id: string }> }>
      meta: { nextCursor: string | null; total: number }
    }
    expect(firstPage.meta.total).toBe(3)
    expect(firstPage.data).toHaveLength(1)
    expect(firstPage.meta.nextCursor).toBe(firstPage.data[0]!.id)
    const secondPage = (await (
      await app.request(
        `/v1/chapters/${chapterId}/comments?limit=1&cursor=${firstPage.meta.nextCursor}`
      )
    ).json()) as {
      data: Array<{ id: string; replies: Array<{ id: string }> }>
    }
    expect(secondPage.data).toHaveLength(1)
    expect(secondPage.data[0]).toMatchObject({
      id: first.id,
      replies: [{ id: reply.id }],
    })

    const mangaComment = await app.request(`/v1/manga/${mangaId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie!,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ body: "**Hay** 😍 :doro-think:" }),
    })
    expect(mangaComment.status).toBe(201)
    const mangaCommentBody = (await mangaComment.json()) as { id: string }
    commentIds.push(mangaCommentBody.id)
    const mangaFeed = (await (
      await app.request(`/v1/manga/${mangaId}/comments`)
    ).json()) as {
      data: Array<{
        id: string
        chapter: { id: string; number: string | null } | null
      }>
      meta: { total: number }
    }
    expect(mangaFeed.meta.total).toBe(4)
    expect(mangaFeed.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: mangaCommentBody.id, chapter: null }),
        expect.objectContaining({
          id: first.id,
          chapter: expect.objectContaining({ id: chapterId, number: "9.5" }),
        }),
      ])
    )

    const recentComments = (await (
      await app.request("/v1/comments/recent?limit=4")
    ).json()) as {
      data: Array<{
        id: string
        body: string
        manga: { id: string; slug: string; title: string }
        chapter: { id: string; number: string | null } | null
      }>
    }
    expect(recentComments.data.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        first.id,
        reply.id,
        second.id,
        mangaCommentBody.id,
      ])
    )
    expect(recentComments.data).toContainEqual(
      expect.objectContaining({
        id: first.id,
        body: "Bình luận đầu tiên",
        manga: expect.objectContaining({ id: mangaId }),
        chapter: expect.objectContaining({ id: chapterId, number: "9.5" }),
      })
    )
    expect((await app.request("/v1/comments/recent?limit=11")).status).toBe(400)

    const htmlComment = await app.request(`/v1/manga/${mangaId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie!,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ body: "<img src=x onerror=alert(1)>" }),
    })
    expect(htmlComment.status).toBe(400)

    const updated = await app.request(`/v1/comments/${first.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie!,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({
        body: "Đã chỉnh sửa",
        expectedVersion: first.version,
      }),
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      body: "Đã chỉnh sửa",
      deleted: false,
    })

    const deleted = await app.request(`/v1/comments/${first.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie!,
        Origin: env.WEB_ORIGIN,
      },
      body: JSON.stringify({ expectedVersion: first.version + 1 }),
    })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toMatchObject({ body: null, deleted: true })

    const hiddenChapterApp = createApp({
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: runtime.cache,
        database: runtime.database,
        hiddenChapterIds: [chapterId],
      },
      logger: noop,
    })
    expect(
      (await hiddenChapterApp.request(`/v1/chapters/${chapterId}/comments`))
        .status
    ).toBe(404)
    expect(
      await (
        await hiddenChapterApp.request(`/v1/manga/${mangaId}/comments`)
      ).json()
    ).toMatchObject({
      data: [{ id: mangaCommentBody.id, chapter: null }],
      meta: { total: 1 },
    })
    expect(
      await (await hiddenChapterApp.request("/v1/comments/recent")).json()
    ).toMatchObject({ data: [{ id: mangaCommentBody.id, chapter: null }] })
  })

  test("serves PostgreSQL data while Redis is unavailable", async () => {
    const unavailable = new BusinessCache(
      {
        ...env,
        REDIS_CACHE_ENABLED: true,
        REDIS_URL: "redis://127.0.0.1:1",
        REDIS_CONNECT_TIMEOUT_MS: 100,
        REDIS_RECONNECT_RETRY_MS: 100,
      },
      noop
    )
    await unavailable.connect()
    const fallbackApp = createApp({
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache: unavailable,
        database: runtime.database,
      },
      logger: noop,
    })

    const response = await fallbackApp.request("/v1/manga")
    expect(response.status).toBe(200)
    expect(((await response.json()) as { data: unknown[] }).data).toHaveLength(
      8
    )
    expect((await fallbackApp.request("/v1/manga?q=wise%20lover")).status).toBe(
      200
    )
    expect((await fallbackApp.request("/v1/chapters/latest")).status).toBe(200)
    expect((await fallbackApp.request("/v1/manga/random")).status).toBe(200)
    expect((await fallbackApp.request("/v1/tags")).status).toBe(200)
    expect((await fallbackApp.request(`/v1/tags/${tagId}`)).status).toBe(200)
    expect((await fallbackApp.request("/v1/groups")).status).toBe(200)
    expect(
      (await fallbackApp.request(`/v1/groups/${inactiveGroupId}`)).status
    ).toBe(200)
    expect(
      (await fallbackApp.request(`/v1/people/${dualRolePersonId}`)).status
    ).toBe(200)
    expect((await fallbackApp.request(`/v1/manga/${mangaId}`)).status).toBe(200)
    const feed = await fallbackApp.request(`/v1/manga/${mangaId}/chapters`)
    expect(feed.status).toBe(200)
    expect((await feed.json()) as { meta: { total: number } }).toMatchObject({
      meta: { total: 2 },
    })
    await unavailable.close()
  })
  test("isolates cached responses by emergency visibility overrides", async () => {
    const cache = runtime.cache
    const primed = await Promise.all(
      [
        "/v1/manga",
        `/v1/manga/${mangaId}`,
        `/v1/manga/${mangaId}/chapters`,
        `/v1/chapters/${chapterId}`,
      ].map((path) => app.request(path))
    )
    expect(primed.every(({ status }) => status === 200)).toBe(true)

    const hiddenMangaApp = createApp({
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache,
        database: runtime.database,
        hiddenMangaIds: [mangaId],
      },
      logger: noop,
    })
    const list = (await (await hiddenMangaApp.request("/v1/manga")).json()) as {
      data: Array<{ id: string }>
    }
    expect(list.data.some(({ id }) => id === mangaId)).toBe(false)
    const reverse = (await (
      await hiddenMangaApp.request(`/v1/manga?includeTag=${tagId}`)
    ).json()) as { data: Array<{ id: string }> }
    expect(reverse.data.some(({ id }) => id === mangaId)).toBe(false)
    const groupReverse = (await (
      await hiddenMangaApp.request(`/v1/manga?group=${inactiveGroupId}`)
    ).json()) as { data: Array<{ id: string }> }
    expect(groupReverse.data.some(({ id }) => id === mangaId)).toBe(false)
    const personReverse = (await (
      await hiddenMangaApp.request(`/v1/manga?author=${authorOnlyPersonId}`)
    ).json()) as { data: Array<{ id: string }> }
    expect(personReverse.data.some(({ id }) => id === mangaId)).toBe(false)
    expect(
      (await (
        await hiddenMangaApp.request(`/v1/people/${authorOnlyPersonId}`)
      ).json()) as { roles: string[] }
    ).toMatchObject({ roles: [] })
    expect((await hiddenMangaApp.request(`/v1/manga/${mangaId}`)).status).toBe(
      404
    )
    expect(
      (await hiddenMangaApp.request(`/v1/manga/${mangaId}/chapters`)).status
    ).toBe(404)

    const hiddenChapterApp = createApp({
      catalog: {
        assetBaseUrl: env.ASSET_BASE_URL,
        cache,
        database: runtime.database,
        hiddenChapterIds: [chapterId],
      },
      logger: noop,
    })
    expect(
      (await hiddenChapterApp.request(`/v1/chapters/${chapterId}`)).status
    ).toBe(404)
    const visibleFeed = (await (
      await hiddenChapterApp.request(`/v1/manga/${mangaId}/chapters`)
    ).json()) as { data: Array<{ id: string }>; meta: { total: number } }
    expect(visibleFeed.meta.total).toBe(1)
    expect(visibleFeed.data.some(({ id }) => id === chapterId)).toBe(false)
  })

  test("rejects invalid IDs on business routes and documents all public paths", async () => {
    expect((await app.request("/v1/manga/invalid-id")).status).toBe(400)
    expect((await app.request("/v1/manga?page=0")).status).toBe(400)
    expect((await app.request("/v1/manga?limit=101")).status).toBe(400)
    expect((await app.request("/v1/manga?sort=unknown")).status).toBe(400)
    expect((await app.request("/v1/manga?includeTag=not-a-uuid")).status).toBe(
      400
    )
    expect((await app.request("/v1/manga?language=not_valid")).status).toBe(400)
    expect((await app.request("/v1/tags/invalid-id")).status).toBe(400)
    expect((await app.request("/v1/groups/invalid-id")).status).toBe(400)
    expect((await app.request("/v1/people/invalid-id")).status).toBe(400)
    expect(
      (await app.request("/v1/tags/00000000-0000-4000-8000-000000000000"))
        .status
    ).toBe(404)
    expect(
      (await app.request("/v1/people/00000000-0000-4000-8000-000000000000"))
        .status
    ).toBe(404)
    expect(
      (await app.request("/v1/groups/00000000-0000-4000-8000-000000000000"))
        .status
    ).toBe(404)

    const document = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<string, unknown>
    }
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/v1/manga",
        "/v1/manga/random",
        "/v1/manga/{id}",
        "/v1/manga/{id}/comments",
        "/v1/manga/{id}/recommendations",
        "/v1/manga/{id}/chapters",
        "/v1/chapters/latest",
        "/v1/chapters/{id}",
        "/v1/chapters/{id}/comments",
        "/v1/comments/recent",
        "/v1/comments/{id}",
        "/v1/tags",
        "/v1/tags/{id}",
        "/v1/groups",
        "/v1/groups/{id}",
        "/v1/people/{id}",
        "/v1/people",
      ])
    )
  })
})
