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

import { isBefore, parseISO, subMinutes } from "date-fns"
import { and, eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  chapter,
  chapterGroup,
  cover,
  libraryItem,
  manga,
  mangaEngagementDaily,
  mangaPerson,
  mangaStats,
  mangaTag,
  organization as translationGroup,
  person,
  tag,
  translationGroupProfile,
  user,
  userProfile,
} from "../../src/db/schema"
import { MangaSummarySchema } from "../../src/features/catalog/contract"
import type { CatalogVisibility } from "../../src/features/catalog/routes"
import { engagementBucketDate } from "../../src/features/ranking/engagement"
import {
  LibraryItemSchema,
  type LibraryItem,
} from "../../src/features/library/contract"
import { createRuntime, type Runtime } from "../../src/runtime"
import { BusinessCache } from "../../src/shared/cache"
import { parseRuntimeEnv, type RuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)
const noop = () => undefined
const baseTime = subMinutes(new Date(), 20)
const emails = [0, 1].map(() => `phase7c-${randomUUID()}@example.com`)
const accounts: { userId: string; cookie: string }[] = []
const ownerGroupId = randomUUID()
const mangas: { id: string }[] = []
let chapters: { id: string; mangaId: string }[] = []
let personId = ""
let tagId = ""
let groupId = ""
let runtime: Runtime
let env: RuntimeEnv
let app: ReturnType<typeof createApp>
const root = "/v1/me/library"
const itemPath = (id: string) => `${root}/${id}`
const id = (index = 0) => mangas[index]!.id

function makeApp(visibility: CatalogVisibility = {}, cache = runtime.cache) {
  return createApp({
    auth: runtime.auth,
    catalog: {
      database: runtime.database,
      cache,
      assetBaseUrl: "http://localhost:9000/",
      ...visibility,
    },
    logger: noop,
    webOrigin: env.WEB_ORIGIN,
  })
}
function request(
  path: string,
  method = "GET",
  body?: unknown,
  account = 0,
  target = app
) {
  return target.request(path, {
    method,
    headers: {
      Cookie: accounts[account]!.cookie,
      Origin: env.WEB_ORIGIN,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
async function getItem(mangaId = id(), account = 0) {
  const response = await request(itemPath(mangaId), "GET", undefined, account)
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  const { data } = (await response.json()) as { data: LibraryItem | null }
  if (data) {
    expect(LibraryItemSchema.safeParse(data).success).toBe(true)
    expect(data).not.toHaveProperty("userId")
  }
  return data
}
async function clearLibrary() {
  await runtime.database.delete(libraryItem).where(
    inArray(
      libraryItem.userId,
      accounts.map(({ userId }) => userId)
    )
  )
}
async function getFollows(mangaId = id()) {
  const [stats] = await runtime.database
    .select({ follows: mangaStats.follows })
    .from(mangaStats)
    .where(eq(mangaStats.mangaId, mangaId))
  return stats?.follows ?? 0n
}

async function getDailyFollows(mangaId: string) {
  const [row] = await runtime.database
    .select({
      adds: mangaEngagementDaily.followAdds,
      removes: mangaEngagementDaily.followRemoves,
    })
    .from(mangaEngagementDaily)
    .where(
      and(
        eq(mangaEngagementDaily.mangaId, mangaId),
        eq(mangaEngagementDaily.bucketDate, engagementBucketDate())
      )
    )
  return row ?? { adds: 0n, removes: 0n }
}
describe.serial("Phase 7C library", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      REDIS_CACHE_ENABLED: "false",
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    await runtime.database.insert(translationGroup).values({
      id: ownerGroupId,
      name: "Phase 7C owner group",
      slug: `phase-7c-owner-${ownerGroupId}`,
      createdAt: new Date(),
    })
    app = makeApp()
    for (const email of emails) {
      const response = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: env.WEB_ORIGIN },
        body: JSON.stringify({
          email,
          name: "Phase 7C reader",
          password: "phase7c-integration-password",
        }),
      })
      expect(response.status).toBe(200)
      const body = (await response.json()) as { user: { id: string } }
      accounts.push({
        userId: body.user.id,
        cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
      })
    }
    for (let index = 0; index < 12; index++) {
      const [row] = await runtime.database
        .insert(manga)
        .values({
          ownerGroupId,

          slug: `phase7c-${randomUUID()}`,
          title: `Phase 7C Manga ${index}`,
          alternativeTitles: index === 2 ? { ja: ["Library Needle"] } : {},
          searchTitle: `phase 7c manga ${index}`,
          description: "Library integration fixture",
          originalLanguage: "ja",
          status: "ongoing",
          contentRating: index === 8 ? "pornographic" : "safe",
          publicationState: index === 10 ? "hidden" : "published",
          publishedAt: baseTime,
          latestChapterPublishedAt: index === 7 ? null : baseTime,
          deletedAt: index === 11 ? baseTime : null,
          hasUsableChapters: index !== 9,
        })
        .returning({ id: manga.id })
      mangas.push(row!)
    }
    chapters = await runtime.database
      .insert(chapter)
      .values(
        mangas
          .filter((_, index) => index !== 9)
          .map(({ id: mangaId }) => ({
            ownerGroupId,
            mangaId,
            number: "1",
            language: "vi",
            pageCount: 3,
            availablePageCount: 3,
            isFull: true,
            publicationState: "published" as const,
            publishedAt: baseTime,
          }))
      )
      .returning({ id: chapter.id, mangaId: chapter.mangaId })
    await runtime.database.insert(cover).values({
      mangaId: id(),
      storageKey:
        "covers/018f0000-0000-7000-8000-000000000001/018f0000-0000-7000-8000-000000000002.webp",
      width: 512,
      height: 720,
      isPrimary: true,
    })
    const [author] = await runtime.database
      .insert(person)
      .values({ slug: `phase7c-${randomUUID()}`, name: "Phase 7C Author" })
      .returning({ id: person.id })
    personId = author!.id
    const [genre] = await runtime.database
      .insert(tag)
      .values({
        slug: `phase7c-${randomUUID()}`,
        name: "Phase 7C Genre",
        group: "genre",
      })
      .returning({ id: tag.id })
    tagId = genre!.id
    const [group] = await runtime.database
      .insert(translationGroup)
      .values({
        id: randomUUID(),
        slug: `phase7c-${randomUUID()}`,
        name: "Phase 7C Team",
        createdAt: new Date(),
      })
      .returning({ id: translationGroup.id })
    groupId = group!.id
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: groupId,
      publicationState: "published",
    })
    await runtime.database
      .insert(mangaPerson)
      .values({ mangaId: id(), personId, role: "author" })
    await runtime.database.insert(mangaTag).values({ mangaId: id(), tagId })
    await runtime.database.insert(chapterGroup).values({
      chapterId: chapters.find((row) => row.mangaId === id())!.id,
      groupId,
    })
  })
  afterAll(async () => {
    if (!runtime) return
    if (mangas.length)
      await runtime.database.delete(manga).where(
        inArray(
          manga.id,
          mangas.map(({ id }) => id)
        )
      )
    if (personId)
      await runtime.database.delete(person).where(eq(person.id, personId))
    if (tagId) await runtime.database.delete(tag).where(eq(tag.id, tagId))
    if (groupId)
      await runtime.database
        .delete(translationGroup)
        .where(eq(translationGroup.id, groupId))
    await runtime.database
      .delete(translationGroup)
      .where(eq(translationGroup.id, ownerGroupId))
    await runtime.database.delete(user).where(inArray(user.email, emails))
    await runtime.close()
  })

  test("requires a private session, validates input and preserves own item identity across category changes", async () => {
    for (const [path, method] of [
      [root, "GET"],
      [itemPath(id()), "GET"],
      [itemPath(id()), "PUT"],
      [itemPath(id()), "DELETE"],
    ]) {
      const response = await app.request(path!, { method })
      expect(response.status).toBe(401)
      expect(response.headers.get("cache-control")).toBe("private, no-store")
    }
    expect(await getItem()).toBeNull()
    for (const body of [
      {},
      { category: "DROPPED" },
      { category: "RE_READING" },
      { category: "plan", userId: accounts[1]!.userId },
      { category: "plan", updatedAt: new Date().toISOString() },
    ]) {
      const response = await request(itemPath(id()), "PUT", body)
      expect(response.status).toBe(400)
      expect(response.headers.get("cache-control")).toBe("private, no-store")
    }
    for (const path of [
      itemPath("invalid-id"),
      `${root}?limit=101`,
      `${root}?limit=0`,
      `${root}?category=favorite`,
      `${root}?cursor=invalid`,
      `${root}?q=%20%20`,
      `${root}?sort=oldest`,
    ])
      expect((await request(path)).status).toBe(400)
    expect(
      (await request(itemPath(randomUUID()), "PUT", { category: "plan" }))
        .status
    ).toBe(404)
    let createdAt: string | undefined
    for (const category of [
      "following",
      "reading",
      "plan",
      "completed",
    ] as const) {
      const response = await request(itemPath(id().toUpperCase()), "PUT", {
        category,
      })
      expect(response.status).toBe(200)
      const { data } = (await response.json()) as { data: LibraryItem }
      expect(data.category).toBe(category)
      createdAt ??= data.createdAt
      expect(data.createdAt).toBe(createdAt)
      expect(isBefore(parseISO(data.updatedAt), parseISO(createdAt))).toBe(
        false
      )
      expect((await request(itemPath(id()), "PUT", { category })).status).toBe(
        200
      )
    }
    const result = (await getItem())!
    const detail = await (await app.request(`/v1/manga/${id()}`)).json()
    expect(result.manga).toEqual(MangaSummarySchema.parse(detail))
    expect(result.manga).toMatchObject({
      cover: {
        url: "http://localhost:9000/covers/018f0000-0000-7000-8000-000000000001/018f0000-0000-7000-8000-000000000002.512.webp",
      },
      authors: [{ id: personId }],
      tags: [{ id: tagId }],
      latestChapter: { groups: [{ id: groupId }] },
    })
    expect(await getItem(id(), 1)).toBeNull()
    expect(
      await (await request(root, "GET", undefined, 1)).json()
    ).toMatchObject({ data: [] })
    const stored = await runtime.database
      .select()
      .from(libraryItem)
      .where(eq(libraryItem.userId, accounts[0]!.userId))
    expect(stored).toHaveLength(1)
    expect(stored[0]!.createdAt).toEqual(parseISO(createdAt!))
    expect(await getFollows()).toBe(1n)
  })

  test("searches titles and sorts by addition or latest chapter", async () => {
    await clearLibrary()
    const ids = [id(0), id(1), id(2), id(7)]
    await runtime.database.insert(libraryItem).values(
      ids.map((mangaId, index) => ({
        userId: accounts[0]!.userId,
        mangaId,
        category: "reading" as const,
        createdAt: subMinutes(baseTime, index),
      }))
    )
    for (const [mangaId, latestChapterPublishedAt] of [
      [id(0), subMinutes(baseTime, 3)],
      [id(1), baseTime],
      [id(2), subMinutes(baseTime, 1)],
    ] as const)
      await runtime.database
        .update(manga)
        .set({ latestChapterPublishedAt })
        .where(eq(manga.id, mangaId))

    const list = async (query: string) =>
      (await (await request(`${root}?category=reading&${query}`)).json()) as {
        data: LibraryItem[]
        meta: { nextCursor: string | null }
      }
    expect((await list("limit=20")).data.map(({ manga }) => manga.id)).toEqual(
      ids
    )
    expect(
      (await list("sort=latestChapter&limit=20")).data.map(
        ({ manga }) => manga.id
      )
    ).toEqual([id(1), id(2), id(0), id(7)])
    expect(
      (await list("q=manga%202&limit=20")).data.map(({ manga }) => manga.id)
    ).toEqual([id(2)])
    expect(
      (await list("q=library%20needle&limit=20")).data.map(
        ({ manga }) => manga.id
      )
    ).toEqual([id(2)])

    const first = await list("sort=latestChapter&limit=1")
    const second = await list(
      `sort=latestChapter&limit=1&cursor=${first.meta.nextCursor}`
    )
    expect(first.data[0]!.manga.id).toBe(id(1))
    expect(second.data[0]!.manga.id).toBe(id(2))
    expect(
      (await request(`${root}?category=reading&q=manga%200&cursor=${id(1)}`))
        .status
    ).toBe(400)
  })

  test("allows public manga without readable chapters", async () => {
    await clearLibrary()
    expect(await getItem(id(9))).toBeNull()

    const response = await request(itemPath(id(9)), "PUT", {
      category: "following",
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: {
        category: "following",
        manga: { id: id(9), latestChapter: null },
      },
    })
    expect(await getItem(id(9))).toMatchObject({ category: "following" })
    expect(
      (
        (await (await request(root)).json()) as { data: LibraryItem[] }
      ).data.map(({ manga }) => manga.id)
    ).toContain(id(9))
  })

  test("paginates creation timestamp ties and imported microseconds without leaking another user's cursor", async () => {
    await clearLibrary()
    const ids = [id(0), id(1), id(2)]
    await runtime.database.insert(libraryItem).values([
      ...ids.map((mangaId) => ({
        userId: accounts[0]!.userId,
        mangaId,
        category: "reading" as const,
        updatedAt: baseTime,
      })),
      {
        userId: accounts[0]!.userId,
        mangaId: id(3),
        category: "plan" as const,
        updatedAt: baseTime,
      },
      {
        userId: accounts[1]!.userId,
        mangaId: id(4),
        category: "reading" as const,
        updatedAt: baseTime,
      },
    ])
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const response = await request(
        `${root}?category=reading&limit=1${cursor ? `&cursor=${cursor}` : ""}`
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        data: LibraryItem[]
        meta: { nextCursor: string | null }
      }
      expect(body.data).toHaveLength(1)
      seen.push(body.data[0]!.manga.id)
      cursor = body.meta.nextCursor
    } while (cursor && seen.length < 10)
    expect(seen).toEqual([...ids].sort().reverse())
    for (const invalid of [id(3), id(4), randomUUID()]) {
      const response = await request(
        `${root}?category=reading&cursor=${invalid}`
      )
      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({
        error: { code: "INVALID_CURSOR" },
      })
    }
    await clearLibrary()
    const [first, second] = [...ids].sort()
    await runtime.database.insert(libraryItem).values([
      {
        userId: accounts[0]!.userId,
        mangaId: first!,
        category: "plan",
        createdAt: sql`'2026-09-01T00:00:00.123900Z'::timestamptz`,
      },
      {
        userId: accounts[0]!.userId,
        mangaId: second!,
        category: "plan",
        createdAt: sql`'2026-09-01T00:00:00.123100Z'::timestamptz`,
      },
    ])
    const page1 = (await (await request(`${root}?limit=1`)).json()) as {
      data: LibraryItem[]
      meta: { nextCursor: string }
    }
    expect(page1.data[0]!.manga.id).toBe(first!)
    const page2 = (await (
      await request(`${root}?limit=1&cursor=${page1.meta.nextCursor}`)
    ).json()) as { data: LibraryItem[]; meta: { nextCursor: string | null } }
    expect(page2.data[0]!.manga.id).toBe(second!)
    expect(page2.meta.nextCursor).toBeNull()
  })

  test("filters hidden/deleted/R18 manga while keeping public manga without chapters", async () => {
    await clearLibrary()
    await runtime.database.insert(libraryItem).values(
      mangas.map(({ id: mangaId }) => ({
        userId: accounts[0]!.userId,
        mangaId,
        category: "following" as const,
      }))
    )
    const list = (await (await request(root)).json()) as { data: LibraryItem[] }
    expect(list.data).toHaveLength(9)
    expect(LibraryItemSchema.array().safeParse(list.data).success).toBe(true)
    expect(
      list.data.find(({ manga }) => manga.id === id(7))!.manga
    ).toMatchObject({
      cover: null,
      latestChapterPublishedAt: null,
    })
    expect((await request(itemPath(id(9)))).status).toBe(200)
    expect(
      (await request(itemPath(id(9)), "PUT", { category: "plan" })).status
    ).toBe(200)
    for (const index of [8, 10, 11]) {
      expect((await request(itemPath(id(index)))).status).toBe(404)
      expect(
        (await request(itemPath(id(index)), "PUT", { category: "plan" })).status
      ).toBe(404)
    }
    const chapterId = chapters.find((row) => row.mangaId === id())!.id
    for (const visibility of [
      { hiddenMangaIds: [id()] },
      { hiddenMangaIds: [mangas[0]!.id] },
    ]) {
      const target = makeApp(visibility)
      expect(
        (await request(itemPath(id()), "GET", undefined, 0, target)).status
      ).toBe(404)
      expect(
        (await request(itemPath(id()), "PUT", { category: "plan" }, 0, target))
          .status
      ).toBe(404)
      const body = (await (
        await request(root, "GET", undefined, 0, target)
      ).json()) as { data: LibraryItem[] }
      expect(body.data.map(({ manga }) => manga.id)).not.toContain(id())
    }
    const hiddenChapterApp = makeApp({ hiddenChapterIds: [chapterId] })
    expect(
      (await request(itemPath(id()), "GET", undefined, 0, hiddenChapterApp))
        .status
    ).toBe(200)
    const hiddenChapterList = (await (
      await request(root, "GET", undefined, 0, hiddenChapterApp)
    ).json()) as { data: LibraryItem[] }
    expect(hiddenChapterList.data.map(({ manga }) => manga.id)).toContain(id())
    expect(
      hiddenChapterList.data.find(({ manga }) => manga.id === id())!.manga
        .latestChapter
    ).toBeNull()
    await runtime.database
      .update(manga)
      .set({ hasUsableChapters: false })
      .where(eq(manga.id, id()))
    expect((await request(itemPath(id()))).status).toBe(200)
    await runtime.database
      .update(manga)
      .set({ hasUsableChapters: true })
      .where(eq(manga.id, id()))
    await runtime.database
      .update(chapter)
      .set({ isFull: false })
      .where(eq(chapter.id, chapterId))
    expect((await request(itemPath(id()))).status).toBe(200)
    await runtime.database
      .update(chapter)
      .set({ isFull: true })
      .where(eq(chapter.id, chapterId))
    expect(
      (
        await request(
          itemPath(id(8)),
          "GET",
          undefined,
          0,
          makeApp({ hideR18: false })
        )
      ).status
    ).toBe(200)
    const stored = await runtime.database
      .select()
      .from(libraryItem)
      .where(eq(libraryItem.userId, accounts[0]!.userId))
    expect(stored).toHaveLength(12)
  })

  test("keeps the follow aggregate atomic under concurrent writes and rollback", async () => {
    await clearLibrary()
    const mangaId = id(6)
    const before = await getDailyFollows(mangaId)
    await Promise.all(
      accounts.map((_, account) =>
        request(itemPath(mangaId), "PUT", { category: "following" }, account)
      )
    )
    expect(await getFollows(mangaId)).toBe(2n)
    expect(await getDailyFollows(mangaId)).toEqual({
      adds: before.adds + 2n,
      removes: before.removes,
    })
    expect(
      (await request(itemPath(mangaId), "PUT", { category: "reading" })).status
    ).toBe(200)
    expect((await getDailyFollows(mangaId)).adds).toBe(before.adds + 2n)

    await Promise.all(
      accounts.map((_, account) =>
        request(itemPath(mangaId), "DELETE", undefined, account)
      )
    )
    expect(await getFollows(mangaId)).toBe(0n)
    expect(await getDailyFollows(mangaId)).toEqual({
      adds: before.adds + 2n,
      removes: before.removes + 2n,
    })

    let rollbackError: unknown
    try {
      await runtime.database.transaction(async (transaction) => {
        await transaction.insert(libraryItem).values({
          userId: accounts[0]!.userId,
          mangaId,
          category: "following",
        })
        throw new Error("phase7c rollback")
      })
    } catch (error) {
      rollbackError = error
    }
    expect(rollbackError).toHaveProperty("message", "phase7c rollback")
    expect(await getFollows(mangaId)).toBe(0n)
  })

  test("ignores Redis failures and permits restricted self reads/deletes while updating follows", async () => {
    await clearLibrary()
    const failedCache = new BusinessCache(
      {
        ...env,
        REDIS_CACHE_ENABLED: true,
        REDIS_URL: "redis://127.0.0.1:1",
        REDIS_CONNECT_TIMEOUT_MS: 50,
      },
      noop
    )
    try {
      await failedCache.connect()
      expect(failedCache.status).toBe("degraded")
      const target = makeApp({}, failedCache)
      expect(
        (
          await request(
            itemPath(id()),
            "PUT",
            { category: "completed" },
            0,
            target
          )
        ).status
      ).toBe(200)
      expect(await getFollows()).toBe(1n)
      expect((await request(root, "GET", undefined, 0, target)).status).toBe(
        200
      )
      expect(
        (await request(itemPath(id()), "PUT", { category: "reading" }, 1))
          .status
      ).toBe(200)
      expect(await getFollows()).toBe(2n)
      for (const status of ["suspended", "banned"] as const) {
        await runtime.database
          .update(userProfile)
          .set({
            status,
            moderatedAt: new Date(),
            moderationReason: "phase7c_test",
          })
          .where(eq(userProfile.userId, accounts[0]!.userId))
        expect((await request(root)).status).toBe(200)
        expect((await request(itemPath(id()))).status).toBe(200)
        expect(
          (await request(itemPath(id()), "PUT", { category: "plan" })).status
        ).toBe(403)
        for (let retry = 0; retry < 2; retry++)
          expect(
            (
              await request(
                itemPath(id()),
                "DELETE",
                undefined,
                0,
                makeApp({ hiddenMangaIds: [id()] })
              )
            ).status
          ).toBe(204)
        expect(await getItem()).toBeNull()
        expect(await getItem(id(), 1)).toMatchObject({ category: "reading" })
        expect(await getFollows()).toBe(1n)
      }
      const [stats] = await runtime.database
        .select()
        .from(mangaStats)
        .where(eq(mangaStats.mangaId, id()))
      expect(stats).toMatchObject({
        follows: 1n,
        views: 0n,
      })
    } finally {
      await failedCache.close()
    }
  })
})
