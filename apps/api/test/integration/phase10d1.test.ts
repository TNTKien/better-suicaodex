import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { parseISO } from "date-fns"
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  chapter,
  chapterGroup,
  chapterPage,
  manga,
  mangaVolume,
  organization,
  translationGroupProfile,
} from "../../src/db/schema"
import {
  ChapterDetailSchema,
  ChapterNavigationReleasesSchema,
  MangaDetailSchema,
  MangaReadingEntrySchema,
  type ChapterList,
} from "../../src/features/catalog/contract"
import { createRuntime, type Runtime } from "../../src/runtime"
import { GroupRankingSchema } from "../../src/features/ranking/contract"
import { parseRuntimeEnv } from "../../src/shared/env"

const groupId = randomUUID()
const mangaId = randomUUID()
const oneshotId = randomUUID()
const volumeMangaId = randomUUID()
const ids = Array.from({ length: 6 }, () => randomUUID())
const stamp = parseISO("2026-01-01T00:00:00Z")
let runtime: Runtime
let app: ReturnType<typeof createApp>
const base = {
  ownerGroupId: groupId,
  mangaId,
  language: "vi",
  pageCount: 1,
  availablePageCount: 1,
  isFull: true,
  publicationState: "published" as const,
  publishedAt: stamp,
}

async function detail(id: string) {
  const response = await app.request(`/v1/chapters/${id}`)
  expect(response.status).toBe(200)
  return ChapterDetailSchema.parse(await response.json())
}

async function constraint(
  operation: Promise<unknown>,
  property: string,
  expected: string
) {
  let error: unknown
  try {
    await operation
  } catch (caught) {
    error = caught
  }
  expect(error).toHaveProperty(`cause.${property}`, expected)
}

describe.serial("Phase 10D.1 native multi-release", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("Dedicated TEST_DATABASE_URL required")
    const parsed = new URL(url)
    if (
      !["localhost", "127.0.0.1"].includes(parsed.hostname) ||
      !parsed.pathname.endsWith("_test")
    )
      throw new Error("This suite requires an isolated local _test database")
    runtime = await createRuntime(
      parseRuntimeEnv({
        NODE_ENV: "test",
        DATABASE_URL: url,
        REDIS_CACHE_ENABLED: "false",
        ASSET_BASE_URL: "https://images.example/",
        WEB_ORIGIN: "http://localhost:3000",
        BETTER_AUTH_URL: "http://localhost:3001",
        BETTER_AUTH_SECRET: "phase10d1-test-only-secret-at-least-32-bytes",
        DISCORD_CLIENT_ID: "test",
        DISCORD_CLIENT_SECRET: "test",
      }),
      () => undefined
    )
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = createApp({
      catalog: {
        database: runtime.database,
        cache: runtime.cache,
        assetBaseUrl: "https://images.example/",
      },
      logger: () => undefined,
    })
    await runtime.database.insert(organization).values({
      id: groupId,
      name: "10D1 fixture",
      slug: `10d1-${groupId}`,
      createdAt: stamp,
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: groupId,
      approvalStatus: "approved",
      publicationState: "published",
    })
    await runtime.database.insert(manga).values(
      [mangaId, oneshotId, volumeMangaId].map((id) => ({
        id,
        ownerGroupId: groupId,
        slug: `10d1-${id}`,
        title: "10D1 fixture",
        searchTitle: "10d1 fixture",
        originalLanguage: "ja",
        status: "ongoing" as const,
        contentRating: "safe" as const,
        publicationState: "published" as const,
        publishedAt: stamp,
      }))
    )
    const [volume] = await runtime.database
      .insert(mangaVolume)
      .values({ mangaId, number: "2" })
      .returning()
    await runtime.database.insert(chapter).values([
      {
        ...base,
        id: ids[0],
        number: "2",
        volumeId: volume!.id,
        isDefault: true,
      },
      {
        ...base,
        id: ids[1],
        number: "2",
        publishedAt: parseISO("2026-09-01T00:00:00Z"),
      },
      {
        ...base,
        id: ids[2],
        number: "10.125",
      },
      {
        ...base,
        id: ids[3],
        number: "11",
      },
      {
        ...base,
        id: ids[4],
        number: "15",
      },
      {
        ...base,
        id: ids[5],
        number: "1",
        language: "en",
      },
    ])
    await runtime.database
      .insert(chapterGroup)
      .values(
        ids
          .filter((id) => id !== ids[3])
          .map((chapterId) => ({ chapterId, groupId }))
      )
    await runtime.database.insert(chapterPage).values(
      ids.map((chapterId) => ({
        chapterId,
        position: 0,
        originalKey: `pages/${chapterId}/0.webp`,
        width: 600,
        height: 900,
      }))
    )
  })

  afterAll(async () => {
    if (!runtime) return
    for (const id of [mangaId, oneshotId, volumeMangaId])
      await runtime.database.delete(manga).where(eq(manga.id, id))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, groupId))
    await runtime.close()
  })

  test("native identities expose reading entries without source metadata", async () => {
    const response = await app.request(`/v1/manga/${mangaId}`)
    const value = MangaDetailSchema.parse(await response.json())
    expect(value.chapterCounts).toEqual({ slots: 5, releases: 6 })
    expect(
      value.readingEntries.map((e) => [
        e.language,
        e.first.selectedChapterId,
        e.last.selectedChapterId,
      ])
    ).toEqual([
      ["en", ids[5], ids[5]],
      ["vi", ids[0], ids[4]],
    ])
    expect(value.firstChapter?.id).toBe(ids[0]!)
  })

  test("pagination contains a whole slot with stable default and exact decimal ordering", async () => {
    const response = await app.request(
      `/v1/manga/${mangaId}/chapters?language=vi&direction=asc&limit=1`
    )
    expect(response.status).toBe(200)
    const value = (await response.json()) as ChapterList
    expect(value.meta).toEqual({
      page: 1,
      limit: 1,
      total: 4,
      totalPages: 4,
      releaseTotal: 5,
    })
    expect(value.slots).toHaveLength(1)
    expect(value.slots[0]!.defaultChapterId).toBe(ids[0]!)
    expect(value.data.map((r) => [r.id, r.volume])).toEqual([
      [ids[0], "2"],
      [ids[1], null],
    ])
    expect(value.data[0]).not.toHaveProperty("laneGroupIds")
    const second = (await (
      await app.request(
        `/v1/manga/${mangaId}/chapters?language=vi&direction=asc&limit=1&page=2`
      )
    ).json()) as ChapterList
    expect(second.data.map((r) => r.number)).toEqual(["10.125"])
    expect((await detail(ids[0]!)).pages[0]!.url).toBe(
      `https://images.example/pages/${ids[0]}/0.webp`
    )
  })

  test("lazy reading entries use actual volume boundaries rather than global numbers or publication dates", async () => {
    const firstResponse = await app.request(
      `/v1/manga/${mangaId}/reading-entry?position=first`
    )
    expect(firstResponse.status).toBe(200)
    expect(firstResponse.headers.get("Cache-Control")).toBe("no-store")
    const first = MangaReadingEntrySchema.parse(await firstResponse.json()).data
    expect(first.map((r) => r.id)).toEqual([ids[0]!])
    expect(first[0]).toMatchObject({
      isDefault: true,
      volume: "2",
      groups: [{ id: groupId }],
      uploader: { id: null, name: "System" },
      statistics: { views: 0, comments: 0 },
    })
    expect(first[0]).not.toHaveProperty("readingKey")
    expect(first[0]).not.toHaveProperty("laneGroupIds")
    const last = MangaReadingEntrySchema.parse(
      await (
        await app.request(`/v1/manga/${mangaId}/reading-entry?position=last`)
      ).json()
    ).data
    expect(last.map((r) => r.id)).toEqual([ids[4]!])
    expect(last[0]!.number).toBe("15")
    const empty = await app.request(
      `/v1/manga/${oneshotId}/reading-entry?position=first`
    )
    expect(await empty.json()).toEqual({ data: [] })
    expect(
      (
        await app.request(
          `/v1/manga/${randomUUID()}/reading-entry?position=last`
        )
      ).status
    ).toBe(404)
    expect(
      (await app.request(`/v1/manga/${mangaId}/reading-entry?position=invalid`))
        .status
    ).toBe(400)
  })

  test("volume display order paginates within actual volumes without changing global defaults", async () => {
    const volumes = await runtime.database
      .insert(mangaVolume)
      .values(["10", "2.5"].map((number) => ({ mangaId, number })))
      .returning()
    const [volume2] = await runtime.database
      .select()
      .from(mangaVolume)
      .where(eq(mangaVolume.mangaId, mangaId))
      .orderBy(mangaVolume.number)
      .limit(1)
    const added = await runtime.database
      .insert(chapter)
      .values([
        { ...base, volumeId: volumes[0]!.id, number: "1" },
        { ...base, volumeId: volumes[0]!.id, number: "2.5" },
        { ...base, volumeId: volumes[1]!.id, number: "9.5" },
        { ...base, volumeId: volume2!.id, number: "3" },
        { ...base, number: "2", publishedAt: parseISO("2026-09-03T00:00:00Z") },
        { ...base, number: null },
        { ...base, number: null },
      ])
      .returning()
    try {
      const unnumbered = added
        .slice(-2)
        .map((r) => r.id)
        .sort()
      const noVolume = [
        [null, "15", [ids[4]!]],
        [null, "11", [ids[3]!]],
        [null, "10.125", [ids[2]!]],
        [null, "2", [added[4]!.id, ids[1]!]],
      ]
      const oneshots = unnumbered.map((id) => [null, null, [id]])
      const numberedVolumes = [
        ["10", "2.5", [added[1]!.id]],
        ["10", "1", [added[0]!.id]],
        ["2.5", "9.5", [added[2]!.id]],
        ["2", "3", [added[3]!.id]],
        ["2", "2", [ids[0]!]],
      ]
      for (const direction of ["desc", "asc"] as const) {
        const slots: ChapterList["slots"] = []
        for (let page = 1; page <= 6; page++) {
          const response = await app.request(
            `/v1/manga/${mangaId}/chapters?sort=volume&language=vi&direction=${direction}&limit=2&page=${page}`
          )
          expect(response.status).toBe(200)
          const value = (await response.json()) as ChapterList
          expect(value.meta).toEqual({
            page,
            limit: 2,
            total: 11,
            totalPages: 6,
            releaseTotal: 12,
          })
          expect(value.data).toEqual(value.slots.flatMap((s) => s.releases))
          expect(value.slots.length).toBeLessThanOrEqual(2)
          slots.push(...value.slots)
        }
        expect(
          slots.map((s) => [s.volume, s.number, s.releases.map((r) => r.id)])
        ).toEqual(
          direction === "desc"
            ? [...noVolume, ...oneshots, ...numberedVolumes]
            : [
                ...numberedVolumes.toReversed(),
                ...noVolume.toReversed(),
                ...oneshots,
              ]
        )
        const chapter2 = slots.filter((s) => s.number === "2")
        expect(chapter2).toHaveLength(2)
        expect(chapter2[0]!.key).toBe(chapter2[1]!.key)
        expect(chapter2.find((s) => s.volume === "2")!.defaultChapterId).toBe(
          ids[0]!
        )
        expect(
          chapter2.find((s) => s.volume === null)!.defaultChapterId
        ).toBeNull()
        expect(
          new Set(slots.flatMap((s) => s.releases.map((r) => r.id))).size
        ).toBe(12)
      }
      for (const direction of ["desc", "asc"] as const) {
        const allLanguages = (await (
          await app.request(
            `/v1/manga/${mangaId}/chapters?sort=volume&direction=${direction}&limit=100`
          )
        ).json()) as ChapterList
        const position = direction === "asc" ? "first" : "last"
        const entry = MangaReadingEntrySchema.parse(
          await (
            await app.request(
              `/v1/manga/${mangaId}/reading-entry?position=${position}`
            )
          ).json()
        )
        expect(entry.data).toEqual(allLanguages.slots[0]!.releases)
        expect(allLanguages.slots.map((s) => s.volume)).toEqual(
          direction === "desc"
            ? [
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "10",
                "10",
                "2.5",
                "2",
                "2",
              ]
            : [
                "2",
                "2",
                "2.5",
                "10",
                "10",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
              ]
        )
      }
      const reading = (await (
        await app.request(
          `/v1/manga/${mangaId}/chapters?language=vi&direction=asc&limit=1&page=2`
        )
      ).json()) as ChapterList
      expect(reading.slots[0]!.defaultChapterId).toBe(ids[0]!)
      expect(reading.slots[0]!.releases.map((r) => r.id)).toEqual([
        ids[0]!,
        added[4]!.id,
        ids[1]!,
      ])
      expect(
        (await detail(ids[0]!)).navigation.next.selectedChapterId
      ).toBeNull()
      expect(
        (await detail(ids[0]!)).navigation.next.options.map((r) => r.id)
      ).toEqual([added[1]!.id])
    } finally {
      for (const row of added)
        await runtime.database.delete(chapter).where(eq(chapter.id, row.id))
      for (const volume of volumes)
        await runtime.database
          .delete(mangaVolume)
          .where(eq(mangaVolume.id, volume.id))
    }
  })

  test("variant date order retains PostgreSQL precision even when serialized labels tie", async () => {
    const prefix = randomUUID().slice(0, 24)
    const earlier = `${prefix}000000000001`
    const later = `${prefix}000000000002`
    await runtime.database.insert(chapter).values([
      {
        ...base,
        id: earlier,
        number: "2",
        publishedAt: parseISO("2026-09-02T00:00:00.100Z"),
      },
      {
        ...base,
        id: later,
        number: "2",
        publishedAt: parseISO("2026-09-02T00:00:00.900Z"),
      },
    ])
    try {
      const value = (await (
        await app.request(
          `/v1/manga/${mangaId}/chapters?language=vi&direction=asc&limit=1`
        )
      ).json()) as ChapterList
      expect(value.data.map((r) => r.id)).toEqual([
        ids[0]!,
        later,
        earlier,
        ids[1]!,
      ])
    } finally {
      for (const id of [earlier, later])
        await runtime.database.delete(chapter).where(eq(chapter.id, id))
    }
  })

  test("navigation does not traverse variants, change group silently, skip a slot or cross language", async () => {
    const first = await detail(ids[0]!)
    expect(first.navigation.next.selectedChapterId).toBe(ids[2]!)
    expect(first.navigation.alternatives.map((r) => r.id)).toEqual([ids[1]!])
    const gap = await detail(ids[2]!)
    expect(gap.next).toBeNull()
    expect(gap.navigation.next).toMatchObject({
      state: "choice-required",
      selectedChapterId: null,
    })
    expect(gap.navigation.next.options.map((r) => r.id)).toEqual([ids[3]!])
    const last = await detail(ids[4]!)
    expect(last.navigation.previous.state).toBe("choice-required")
    expect(last.navigation.next.state).toBe("boundary")
  })

  test("navigation release lookup returns complete cards without manifests and honors visibility", async () => {
    for (const id of [ids[0]!, ids[2]!, ids[4]!]) {
      const current = await detail(id)
      for (const direction of ["previous", "next"] as const) {
        const response = await app.request(
          `/v1/chapters/${id}/navigation-releases?direction=${direction}`
        )
        expect(response.status).toBe(200)
        expect(response.headers.get("cache-control")).toBe("no-store")
        const raw = await response.json()
        const result = ChapterNavigationReleasesSchema.parse(raw)
        expect(result.data.map((r) => r.id)).toEqual(
          current.navigation[direction].options.map((r) => r.id)
        )
        for (const release of result.data) {
          const full = await detail(release.id)
          expect(release).toMatchObject({
            groups: full.groups,
            uploader: full.uploader,
            publishedAt: full.publishedAt,
            statistics: full.statistics,
          })
        }
        expect(JSON.stringify(raw)).not.toMatch(
          /"(?:pages|readingKey|laneGroupIds)":/
        )
      }
    }
    expect(
      (
        await app.request(
          `/v1/chapters/${randomUUID()}/navigation-releases?direction=next`
        )
      ).status
    ).toBe(404)
    expect(
      (
        await app.request(
          `/v1/chapters/${ids[0]}/navigation-releases?direction=invalid`
        )
      ).status
    ).toBe(400)
    const denyApp = createApp({
      catalog: {
        database: runtime.database,
        cache: runtime.cache,
        assetBaseUrl: "https://images.example/",
        hiddenChapterIds: [ids[3]!],
      },
      logger: () => undefined,
    })
    const result = ChapterNavigationReleasesSchema.parse(
      await (
        await denyApp.request(
          `/v1/chapters/${ids[2]}/navigation-releases?direction=next`
        )
      ).json()
    )
    expect(result.data.map((r) => r.id)).not.toContain(ids[3]!)
    expect(
      (
        await denyApp.request(
          `/v1/chapters/${ids[3]}/navigation-releases?direction=next`
        )
      ).status
    ).toBe(404)
    await runtime.database
      .update(chapter)
      .set({ moderationHiddenAt: stamp })
      .where(eq(chapter.id, ids[3]!))
    try {
      const hidden = ChapterNavigationReleasesSchema.parse(
        await (
          await app.request(
            `/v1/chapters/${ids[2]}/navigation-releases?direction=next`
          )
        ).json()
      )
      expect(hidden.data.map((r) => r.id)).not.toContain(ids[3]!)
      expect(
        (
          await app.request(
            `/v1/chapters/${ids[3]}/navigation-releases?direction=next`
          )
        ).status
      ).toBe(404)
    } finally {
      await runtime.database
        .update(chapter)
        .set({ moderationHiddenAt: null })
        .where(eq(chapter.id, ids[3]!))
    }
    await runtime.database
      .update(manga)
      .set({ moderationHiddenAt: stamp })
      .where(eq(manga.id, mangaId))
    try {
      expect(
        (
          await app.request(
            `/v1/chapters/${ids[0]}/navigation-releases?direction=next`
          )
        ).status
      ).toBe(404)
    } finally {
      await runtime.database
        .update(manga)
        .set({ moderationHiddenAt: null })
        .where(eq(manga.id, mangaId))
    }
  })

  test("group statistics and chapter ranking signals do not inflate when another release is added", async () => {
    const partnerId = randomUUID()
    let variantId: string | undefined
    await runtime.database.insert(organization).values({
      id: partnerId,
      name: "10D1 partner",
      slug: `10d1-${partnerId}`,
      createdAt: stamp,
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: partnerId,
      approvalStatus: "approved",
      publicationState: "published",
    })
    await runtime.database
      .insert(chapterGroup)
      .values({ chapterId: ids[0]!, groupId: partnerId })
    const ranking = async () =>
      GroupRankingSchema.parse(
        await (
          await app.request("/v1/rankings/groups?window=all-time&limit=50")
        ).json()
      ).data
    try {
      const before = await ranking()
      expect(before.find((r) => r.group.id === groupId)).toMatchObject({
        chapters: 4,
        releases: 5,
      })
      expect(before.find((r) => r.group.id === partnerId)).toMatchObject({
        chapters: 1,
        releases: 1,
      })
      const [variant] = await runtime.database
        .insert(chapter)
        .values({ ...base, number: "2" })
        .returning()
      variantId = variant!.id
      await runtime.database
        .insert(chapterGroup)
        .values({ chapterId: variantId, groupId })
      const after = await ranking()
      for (const id of [groupId, partnerId]) {
        expect(after.find((r) => r.group.id === id)!.score).toBe(
          before.find((r) => r.group.id === id)!.score
        )
      }
      expect(after.find((r) => r.group.id === groupId)).toMatchObject({
        chapters: 4,
        releases: 6,
      })
      expect(
        await (await app.request(`/v1/groups/${groupId}`)).json()
      ).toMatchObject({ statistics: { chapterCount: 4, releaseCount: 6 } })
    } finally {
      if (variantId)
        await runtime.database.delete(chapter).where(eq(chapter.id, variantId))
      await runtime.database
        .delete(organization)
        .where(eq(organization.id, partnerId))
    }
  })

  test("hidden defaults and denylisted alternatives never leak into slots or navigation", async () => {
    await runtime.database
      .update(chapter)
      .set({ moderationHiddenAt: stamp })
      .where(eq(chapter.id, ids[0]!))
    try {
      expect((await app.request(`/v1/chapters/${ids[0]}`)).status).toBe(404)
      const visible = (await (
        await app.request(
          `/v1/manga/${mangaId}/chapters?language=vi&direction=asc&limit=1`
        )
      ).json()) as ChapterList
      expect(visible.data.map((r) => r.id)).toEqual([ids[1]!])
      expect(visible.slots[0]!.defaultChapterId).toBe(ids[1]!)
      const firstEntry = MangaReadingEntrySchema.parse(
        await (
          await app.request(`/v1/manga/${mangaId}/reading-entry?position=first`)
        ).json()
      )
      expect(firstEntry.data.map((r) => r.id)).toEqual([ids[5]!])
      const denyApp = createApp({
        catalog: {
          database: runtime.database,
          cache: runtime.cache,
          assetBaseUrl: "https://images.example/",
          hiddenChapterIds: [ids[1]!],
        },
        logger: () => undefined,
      })
      const value = ChapterDetailSchema.parse(
        await (await denyApp.request(`/v1/chapters/${ids[2]}`)).json()
      )
      expect(value.navigation.previous.state).toBe("boundary")
      expect(value.navigation.alternatives).toEqual([])
      const deniedEntry = MangaReadingEntrySchema.parse(
        await (
          await denyApp.request(
            `/v1/manga/${mangaId}/reading-entry?position=first`
          )
        ).json()
      )
      expect(deniedEntry.data.map((r) => r.id)).toEqual([ids[5]!])
    } finally {
      await runtime.database
        .update(chapter)
        .set({ moderationHiddenAt: null })
        .where(eq(chapter.id, ids[0]!))
    }
  })

  test("database prevents two defaults, including conflicting soft-delete restore", async () => {
    await constraint(
      runtime.database
        .insert(chapter)
        .values({ ...base, number: "2", isDefault: true })
        .execute(),
      "constraint",
      "chapter_default_slot_uidx"
    )
    const [deleted] = await runtime.database
      .insert(chapter)
      .values({ ...base, number: "2", isDefault: true, deletedAt: stamp })
      .returning()
    await constraint(
      runtime.database
        .update(chapter)
        .set({ deletedAt: null })
        .where(eq(chapter.id, deleted!.id))
        .execute(),
      "constraint",
      "chapter_default_slot_uidx"
    )
  })

  test("a single NULL oneshot opens; multiple NULL releases stay separate and unordered", async () => {
    const [one] = await runtime.database
      .insert(chapter)
      .values({ ...base, mangaId: oneshotId, number: null })
      .returning()
    const first = MangaDetailSchema.parse(
      await (await app.request(`/v1/manga/${oneshotId}`)).json()
    )
    expect(first.readingEntries[0]!.first.selectedChapterId).toBe(one!.id)
    const singleEntry = MangaReadingEntrySchema.parse(
      await (
        await app.request(`/v1/manga/${oneshotId}/reading-entry?position=first`)
      ).json()
    )
    expect(singleEntry.data.map((r) => r.id)).toEqual([one!.id])
    const [two] = await runtime.database
      .insert(chapter)
      .values({ ...base, mangaId: oneshotId, number: null })
      .returning()
    const multiple = MangaDetailSchema.parse(
      await (await app.request(`/v1/manga/${oneshotId}`)).json()
    )
    expect(multiple.chapterCounts).toEqual({ slots: 2, releases: 2 })
    expect(multiple.firstChapter).toBeNull()
    expect(multiple.readingEntries[0]!.first).toMatchObject({
      state: "unordered",
      selectedChapterId: null,
    })
    expect((await detail(one!.id)).navigation.next.state).toBe("unordered")
    for (const position of ["first", "last"]) {
      const entry = MangaReadingEntrySchema.parse(
        await (
          await app.request(
            `/v1/manga/${oneshotId}/reading-entry?position=${position}`
          )
        ).json()
      )
      expect(entry.data.map((r) => r.id)).toEqual([
        [one!.id, two!.id].sort()[0],
      ])
      expect(entry.data.every((r) => r.number === null)).toBe(true)
    }

    // Regression: the reported manga has two No Volume oneshots and Vol. 36 Ch. 36.
    const [volume] = await runtime.database
      .insert(mangaVolume)
      .values({ mangaId: oneshotId, number: "36" })
      .returning()
    const numbered = await runtime.database
      .insert(chapter)
      .values([
        {
          ...base,
          mangaId: oneshotId,
          number: "36",
          volumeId: volume!.id,
          isDefault: true,
        },
        { ...base, mangaId: oneshotId, number: "36", volumeId: volume!.id },
        { ...base, mangaId: oneshotId, number: "36" },
      ])
      .returning()
    try {
      // With only the two oneshots and Vol. 36, latest must still include an oneshot.
      await runtime.database
        .update(chapter)
        .set({ moderationHiddenAt: stamp })
        .where(eq(chapter.id, numbered[2]!.id))
      const latestOneshot = MangaReadingEntrySchema.parse(
        await (
          await app.request(
            `/v1/manga/${oneshotId}/reading-entry?position=last`
          )
        ).json()
      )
      expect(latestOneshot.data.map((r) => r.id)).toEqual([
        [one!.id, two!.id].sort()[0],
      ])
      await runtime.database
        .update(chapter)
        .set({ moderationHiddenAt: null })
        .where(eq(chapter.id, numbered[2]!.id))
      for (const [position, expected] of [
        ["first", numbered.slice(0, 2).map((r) => r.id)],
        ["last", [numbered[2]!.id]],
      ] as const) {
        const entry = MangaReadingEntrySchema.parse(
          await (
            await app.request(
              `/v1/manga/${oneshotId}/reading-entry?position=${position}`
            )
          ).json()
        )
        expect(entry.data.map((r) => r.id)).toEqual(expected)
        const direction = position === "first" ? "asc" : "desc"
        const list = (await (
          await app.request(
            `/v1/manga/${oneshotId}/chapters?sort=volume&direction=${direction}&limit=1`
          )
        ).json()) as ChapterList
        expect(entry.data).toEqual(list.data)
      }
      // Display entry selection does not change reader navigation or numbering mode.
      expect((await detail(one!.id)).navigation.next.state).toBe("unordered")
    } finally {
      for (const row of numbered)
        await runtime.database.delete(chapter).where(eq(chapter.id, row.id))
      await runtime.database
        .delete(mangaVolume)
        .where(eq(mangaVolume.id, volume!.id))
    }
  })

  test("confirmed volume resets cascade mode coherently; missing volume remains unordered", async () => {
    const volumes = await runtime.database
      .insert(mangaVolume)
      .values(["1", "2"].map((number) => ({ mangaId: volumeMangaId, number })))
      .returning()
    const rows = await runtime.database
      .insert(chapter)
      .values([
        {
          ...base,
          mangaId: volumeMangaId,
          number: "1",
          volumeId: volumes[0]!.id,
        },
        {
          ...base,
          mangaId: volumeMangaId,
          number: "1",
          volumeId: volumes[1]!.id,
        },
        { ...base, mangaId: volumeMangaId, number: "2" },
      ])
      .returning()
    await runtime.database
      .update(manga)
      .set({ numberingMode: "volume" })
      .where(eq(manga.id, volumeMangaId))
    const updated = await runtime.database
      .select()
      .from(chapter)
      .where(eq(chapter.mangaId, volumeMangaId))
    expect(updated.every((r) => r.numberingMode === "volume")).toBe(true)
    expect(new Set(updated.map((r) => r.readingKey)).size).toBe(3)
    const value = await detail(rows[0]!.id)
    expect(value.navigation.next.selectedChapterId).toBe(rows[1]!.id)
    expect((await detail(rows[2]!.id)).navigation.next.state).toBe("unordered")
    for (const [position, id] of [
      ["first", rows[0]!.id],
      ["last", rows[2]!.id],
    ]) {
      const entry = MangaReadingEntrySchema.parse(
        await (
          await app.request(
            `/v1/manga/${volumeMangaId}/reading-entry?position=${position}`
          )
        ).json()
      )
      expect(entry.data.map((r) => r.id)).toEqual([id])
    }
    for (const direction of ["asc", "desc"] as const) {
      const list = (await (
        await app.request(
          `/v1/manga/${volumeMangaId}/chapters?sort=volume&direction=${direction}&limit=100`
        )
      ).json()) as ChapterList
      expect(list.data.map((r) => r.id)).toEqual(
        direction === "asc"
          ? rows.map((r) => r.id)
          : rows.toReversed().map((r) => r.id)
      )
    }
    for (const row of rows.slice(0, 2)) {
      await runtime.database
        .update(chapter)
        .set({ isDefault: true })
        .where(eq(chapter.id, row.id))
    }
    await constraint(
      runtime.database
        .update(manga)
        .set({ numberingMode: "global" })
        .where(eq(manga.id, volumeMangaId))
        .execute(),
      "constraint",
      "chapter_default_slot_uidx"
    )
    const [unchanged] = await runtime.database
      .select()
      .from(manga)
      .where(eq(manga.id, volumeMangaId))
    expect(unchanged!.numberingMode).toBe("volume")
  })
})
