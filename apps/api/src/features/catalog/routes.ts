import { setTimeout } from "node:timers/promises"

import type { OpenAPIHono } from "@hono/zod-openapi"
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  notExists,
  notInArray,
  or,
  sql,
} from "drizzle-orm"
import type { SQL } from "drizzle-orm"
import { formatISO } from "date-fns"
import { readyReplicaUrls } from "../image-server2/service.js"
import { createRandomMangaSelector } from "./random.js"
import {
  chapterSlots,
  chapterNavigation,
  mangaReadingEntries,
  type ChapterRelease,
} from "./releases.js"

import type { BusinessCache, CacheResource } from "../../shared/cache.js"
import {
  getChapterRoute,
  getChapterNavigationReleasesRoute,
  getGroupRoute,
  getMangaRoute,
  getMangaReadingEntryRoute,
  getMangaRecommendationsRoute,
  getPersonRoute,
  getRandomMangaRoute,
  getTagRoute,
  listLatestChaptersRoute,
  listMangaChaptersRoute,
  listMangaRoute,
  listPeopleRoute,
  listGroupsRoute,
  listTagsRoute,
} from "./contract.js"
import type {
  ChapterDetail,
  ChapterList,
  ChapterSummary,
  LatestChapterList,
  MangaCatalogQuery,
  MangaChapterListQuery,
  MangaDetail,
  MangaList,
  MangaPreview,
  MangaRecommendations,
  MangaSummary,
  PersonDetail,
  PersonList,
  PersonListQuery,
  RandomManga,
  TagList,
  TagSummary,
  TranslationGroupDetail,
  TranslationGroupList,
  TranslationGroupListQuery,
} from "./contract.js"
import { apiError } from "../../shared/contract.js"
import type { Database } from "../../db/client.js"
import {
  chapter,
  chapterGroup,
  chapterPage,
  chapterTikTokReplica,
  chapterStats,
  comment,
  cover,
  manga,
  mangaGroup,
  mangaLanguage,
  mangaPerson,
  mangaStats,
  mangaTag,
  mangaVolume,
  member as translationGroupMember,
  organization as translationGroup,
  person,
  tag,
  translationGroupProfile,
  translationGroupMangaViewStats,
  user,
} from "../../db/schema.js"

export type CatalogDependencies = {
  assetBaseUrl: string
  cache: BusinessCache
  database: Database
  hiddenChapterIds?: readonly string[]
  hiddenMangaIds?: readonly string[]
  hideR18?: boolean
  imageServer2ReadEnabled?: boolean
  avatarFramesEnabled?: boolean
}

export type CatalogVisibility = Pick<
  CatalogDependencies,
  "hiddenChapterIds" | "hiddenMangaIds" | "hideR18"
>

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const recommendationLimit = 10
const recommendationPoolLimit = recommendationLimit * 2

function splitHiddenIds(ids: readonly string[] = []) {
  return {
    uuid: ids.filter((id) => uuidPattern.test(id)),
  }
}

export function visibleManga(visibility: CatalogVisibility): SQL | undefined {
  const conditions: SQL[] = [
    eq(manga.publicationState, "published"),
    isNull(manga.moderationHiddenAt),
    isNull(manga.deletedAt),
    isNotNull(manga.publishedAt),
  ]
  const hidden = splitHiddenIds(visibility.hiddenMangaIds)

  if (visibility.hideR18 ?? true) {
    conditions.push(ne(manga.contentRating, "pornographic"))
  }
  if (hidden.uuid.length > 0) {
    conditions.push(notInArray(manga.id, hidden.uuid))
  }

  return and(...conditions)
}

export function readableChapter(
  visibility: CatalogVisibility
): SQL | undefined {
  const conditions: SQL[] = [
    eq(chapter.publicationState, "published"),
    isNull(chapter.moderationHiddenAt),
    isNull(chapter.deletedAt),
    isNotNull(chapter.publishedAt),
    eq(chapter.isFull, true),
    sql`${chapter.availablePageCount} > 0`,
  ]
  const hidden = splitHiddenIds(visibility.hiddenChapterIds)

  if (hidden.uuid.length > 0) {
    conditions.push(notInArray(chapter.id, hidden.uuid))
  }

  return and(...conditions)
}

const normalizedIds = (values: string[]) => [...new Set(values)].sort()

export function normalizeCatalogQuery(
  query: MangaCatalogQuery
): MangaCatalogQuery {
  return {
    ...query,
    ...(query.q
      ? { q: query.q.trim().replace(/\s+/g, " ").toLowerCase() }
      : {}),
    ...(query.language ? { language: query.language.toLowerCase() } : {}),
    includeTag: normalizedIds(query.includeTag),
    includeTagMode: query.includeTag.length > 0 ? query.includeTagMode : "and",
    excludeTag: normalizedIds(query.excludeTag),
    excludeTagMode: query.excludeTag.length > 0 ? query.excludeTagMode : "or",
    author: normalizedIds(query.author),
    artist: normalizedIds(query.artist),
    group: normalizedIds(query.group),
  }
}

function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`
}

export function mangaTitleSearch(value: string) {
  const pattern = likePattern(value)
  return or(
    sql`lower(${manga.searchTitle}) like ${pattern} escape '\\'`,
    sql`exists (
      select 1
      from jsonb_each(${manga.alternativeTitles}) as titles(language, values)
      cross join lateral jsonb_array_elements_text(titles.values) as alternative(value)
      where lower(alternative.value) like ${pattern} escape '\\'
    )`
  )
}

export function recommendationTagThreshold(tagCount: number) {
  if (tagCount <= 0) return 0
  return tagCount < 3 ? tagCount : 3
}

export function catalogManga(
  database: Pick<Database, "select">,
  visibility: CatalogVisibility,
  query?: MangaCatalogQuery
): SQL | undefined {
  const readableChapters = database
    .select({ id: chapter.id })
    .from(chapter)
    .where(and(eq(chapter.mangaId, manga.id), readableChapter(visibility)))
  const conditions: Array<SQL | undefined> = [
    visibleManga(visibility),
    query?.hasChapter === "all"
      ? undefined
      : query?.hasChapter === "false"
        ? notExists(readableChapters)
        : and(eq(manga.hasUsableChapters, true), exists(readableChapters)),
  ]

  if (!query) return and(...conditions)

  if (query.q) {
    conditions.push(mangaTitleSearch(query.q))
  }
  if (query.status) conditions.push(eq(manga.status, query.status))
  if (query.language) {
    conditions.push(
      exists(
        database
          .select({ language: mangaLanguage.language })
          .from(mangaLanguage)
          .where(
            and(
              eq(mangaLanguage.mangaId, manga.id),
              eq(mangaLanguage.language, query.language)
            )
          )
      )
    )
  }
  if (query.includeTagMode === "and") {
    for (const tagId of query.includeTag) {
      conditions.push(
        exists(
          database
            .select({ tagId: mangaTag.tagId })
            .from(mangaTag)
            .innerJoin(tag, eq(tag.id, mangaTag.tagId))
            .where(
              and(
                eq(mangaTag.mangaId, manga.id),
                eq(mangaTag.tagId, tagId),
                isNull(tag.moderationHiddenAt)
              )
            )
        )
      )
    }
  } else if (query.includeTag.length > 0) {
    conditions.push(
      exists(
        database
          .select({ tagId: mangaTag.tagId })
          .from(mangaTag)
          .innerJoin(tag, eq(tag.id, mangaTag.tagId))
          .where(
            and(
              eq(mangaTag.mangaId, manga.id),
              inArray(mangaTag.tagId, query.includeTag),
              isNull(tag.moderationHiddenAt)
            )
          )
      )
    )
  }
  if (query.excludeTag.length > 0) {
    conditions.push(
      query.excludeTagMode === "or"
        ? notExists(
            database
              .select({ tagId: mangaTag.tagId })
              .from(mangaTag)
              .innerJoin(tag, eq(tag.id, mangaTag.tagId))
              .where(
                and(
                  eq(mangaTag.mangaId, manga.id),
                  inArray(mangaTag.tagId, query.excludeTag),
                  isNull(tag.moderationHiddenAt)
                )
              )
          )
        : or(
            ...query.excludeTag.map((tagId) =>
              notExists(
                database
                  .select({ tagId: mangaTag.tagId })
                  .from(mangaTag)
                  .innerJoin(tag, eq(tag.id, mangaTag.tagId))
                  .where(
                    and(
                      eq(mangaTag.mangaId, manga.id),
                      eq(mangaTag.tagId, tagId),
                      isNull(tag.moderationHiddenAt)
                    )
                  )
              )
            )
          )
    )
  }
  for (const [role, ids] of [
    ["author", query.author],
    ["artist", query.artist],
  ] as const) {
    if (ids.length === 0) continue
    conditions.push(
      exists(
        database
          .select({ personId: mangaPerson.personId })
          .from(mangaPerson)
          .where(
            and(
              eq(mangaPerson.mangaId, manga.id),
              eq(mangaPerson.role, role),
              inArray(mangaPerson.personId, ids)
            )
          )
      )
    )
  }
  if (query.group.length > 0) {
    conditions.push(
      exists(
        database
          .select({ groupId: mangaGroup.groupId })
          .from(mangaGroup)
          .innerJoin(
            translationGroup,
            eq(translationGroup.id, mangaGroup.groupId)
          )
          .innerJoin(
            translationGroupProfile,
            eq(translationGroupProfile.organizationId, translationGroup.id)
          )
          .where(
            and(
              eq(mangaGroup.mangaId, manga.id),
              inArray(mangaGroup.groupId, query.group),
              publicGroup
            )
          )
      )
    )
  }

  return and(...conditions)
}

export const publicGroup = and(
  eq(translationGroupProfile.publicationState, "published"),
  eq(translationGroupProfile.approvalStatus, "approved"),
  isNull(translationGroupProfile.deletedAt)
)
const publishedChapterAt = sql<Date>`${chapter.publishedAt}`
const chapterVolume = sql<
  string | null
>`CASE WHEN ${mangaVolume.deletedAt} IS NULL THEN ${mangaVolume.number} ELSE NULL END`
const readingVolume = sql<
  string | null
>`CASE WHEN ${chapter.numberingMode} = 'volume' THEN ${chapterVolume} ELSE NULL END`
const chapterAscending = [
  sql`${readingVolume} asc nulls last`,
  sql`${chapter.number} asc nulls last`,
  desc(chapter.isDefault),
  desc(chapter.publishedAt),
  asc(chapter.id),
] as const

export function resolveAssetUrl(baseUrl: string, storageKey: string) {
  if (
    !storageKey ||
    storageKey.startsWith("/") ||
    storageKey.includes("\\") ||
    storageKey.split("/").includes("..") ||
    /^[a-z][a-z0-9+.-]*:/i.test(storageKey)
  ) {
    throw new Error("Asset storage key must be relative")
  }

  return new URL(storageKey, `${baseUrl.replace(/\/+$/, "")}/`).href
}

export function resolveCoverUrl(baseUrl: string, storageKey: string) {
  return resolveAssetUrl(baseUrl, resolveCoverKey(storageKey))
}

export function resolveCoverKey(storageKey: string) {
  const native = /^covers\/([^/]+)\/([^/]+)\.webp$/i.exec(storageKey)
  const nativeCover =
    native !== null &&
    uuidPattern.test(native[1]!) &&
    uuidPattern.test(native[2]!)
  return nativeCover && storageKey.endsWith(".webp")
    ? storageKey.replace(/(?<!\.512)\.webp$/, ".512.webp")
    : storageKey
}

export function normalizeDecimal(value: string | null) {
  if (!value?.includes(".")) return value
  return value.replace(/0+$/, "").replace(/\.$/, "")
}

function safeExternalUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base)
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      (!base || url.origin === new URL(base).origin)
      ? url.href
      : null
  } catch {
    return null
  }
}

const mangaLinkResolvers = [
  {
    key: "al",
    label: "AniList",
    resolve: (value: string) =>
      `https://anilist.co/manga/${encodeURIComponent(value)}`,
  },
  { key: "amz", label: "Amazon", resolve: safeExternalUrl },
  {
    key: "ap",
    label: "Anime-Planet",
    resolve: (value: string) =>
      `https://www.anime-planet.com/manga/${encodeURIComponent(value)}`,
  },
  {
    key: "bw",
    label: "BookWalker",
    resolve: (value: string) =>
      safeExternalUrl(value, "https://bookwalker.jp/"),
  },
  { key: "cdj", label: "CDJapan", resolve: safeExternalUrl },
  { key: "ebj", label: "ebookjapan", resolve: safeExternalUrl },
  { key: "engtl", label: "Official English", resolve: safeExternalUrl },
  {
    key: "kt",
    label: "Kitsu",
    resolve: (value: string) =>
      `https://kitsu.io/manga/${encodeURIComponent(value)}`,
  },
  {
    key: "mal",
    label: "MyAnimeList",
    resolve: (value: string) =>
      `https://myanimelist.net/manga/${encodeURIComponent(value)}`,
  },
  {
    key: "mu",
    label: "MangaUpdates",
    resolve: (value: string) =>
      `https://www.mangaupdates.com/series/${encodeURIComponent(value)}`,
  },
  { key: "raw", label: "Raw", resolve: safeExternalUrl },
] as const

export function resolveMangaLinks(links: Record<string, string>) {
  return mangaLinkResolvers.flatMap(({ key, label, resolve }) => {
    const value = links[key]?.trim()
    if (!value) return []
    const url = resolve(value)
    return url ? [{ key, label, url }] : []
  })
}

function socialUrl(value: string, service: "discord" | "twitter") {
  const trimmed = value.trim()
  const bare = trimmed.replace(/^@/, "")
  if (/^[a-z0-9_-]+$/i.test(bare)) {
    return service === "discord"
      ? `https://discord.gg/${bare}`
      : `https://x.com/${bare}`
  }

  const hosts =
    service === "discord"
      ? ["discord.gg", "discord.com"]
      : ["twitter.com", "x.com"]
  return safeHostUrl(trimmed, hosts)
}

function safeHostUrl(value: string, domains: readonly string[]) {
  const resolved = safeExternalUrl(value)
  if (!resolved) return null
  const host = new URL(resolved).hostname.toLowerCase()
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  )
    ? resolved
    : null
}

const groupLinkResolvers = [
  { key: "website", label: "Website", resolve: safeExternalUrl },
  {
    key: "facebook",
    label: "Facebook",
    resolve: (value: string) => safeHostUrl(value, ["facebook.com", "fb.com"]),
  },
  {
    key: "discord",
    label: "Discord",
    resolve: (value: string) => socialUrl(value, "discord"),
  },
  {
    key: "twitter",
    label: "X/Twitter",
    resolve: (value: string) => socialUrl(value, "twitter"),
  },
] as const

export function resolveGroupLinks(links: Record<string, string>) {
  return groupLinkResolvers.flatMap(({ key, label, resolve }) => {
    const value = links[key]?.trim()
    if (!value) return []
    const url = resolve(value)
    return url ? [{ key, label, url }] : []
  })
}

const personLinkResolvers = [
  { key: "website", label: "Website", resolve: safeExternalUrl },
  {
    key: "twitter",
    label: "X/Twitter",
    resolve: (value: string) => socialUrl(value, "twitter"),
  },
  {
    key: "pixiv",
    label: "Pixiv",
    resolve: (value: string) => safeHostUrl(value, ["pixiv.net"]),
  },
  {
    key: "fanbox",
    label: "Fanbox",
    resolve: (value: string) => safeHostUrl(value, ["fanbox.cc"]),
  },
  {
    key: "fantia",
    label: "Fantia",
    resolve: (value: string) => safeHostUrl(value, ["fantia.jp"]),
  },
  {
    key: "skeb",
    label: "Skeb",
    resolve: (value: string) => safeHostUrl(value, ["skeb.jp"]),
  },
  {
    key: "youtube",
    label: "YouTube",
    resolve: (value: string) => safeHostUrl(value, ["youtube.com", "youtu.be"]),
  },
] as const

export function resolvePersonLinks(links: Record<string, string>) {
  return personLinkResolvers.flatMap(({ key, label, resolve }) => {
    const value = links[key]?.trim()
    if (!value) return []
    const url = resolve(value)
    return url ? [{ key, label, url }] : []
  })
}

async function cached<T>(
  cache: BusinessCache,
  resource: CacheResource,
  identity: unknown,
  load: () => Promise<T>,
  lockName?: string
) {
  const hit = await cache.get<T>(resource, identity)
  if (hit) return hit

  const shouldLock = Boolean(lockName && cache.status === "healthy")
  const release = shouldLock ? await cache.acquireLock(lockName!) : null
  if (shouldLock && !release) {
    await setTimeout(50)
    const retry = await cache.get<T>(resource, identity)
    if (retry) return retry
  }

  try {
    const value = await load()
    await cache.set(resource, identity, value)
    return value
  } finally {
    await release?.()
  }
}

function pageMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}

function mapManga(
  row: {
    id: string
    slug: string
    title: string
    description: string | null
    originalLanguage: string
    status: string | null
    contentRating: string | null
    year: number | null
    latestChapterPublishedAt: Date | null
    coverKey: string | null
    coverWidth: number | null
    coverHeight: number | null
  },
  assetBaseUrl: string,
  latestChapter: MangaSummary["latestChapter"] = null
): MangaSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    originalLanguage: row.originalLanguage,
    status: row.status,
    contentRating: row.contentRating,
    year: row.year,
    latestChapterPublishedAt: row.latestChapterPublishedAt
      ? formatISO(row.latestChapterPublishedAt)
      : null,
    latestChapter,
    cover: row.coverKey
      ? {
          url: resolveCoverUrl(assetBaseUrl, row.coverKey),
          width: row.coverWidth,
          height: row.coverHeight,
        }
      : null,
    tags: [],
    authors: [],
  }
}

export const mangaSummaryColumns = {
  id: manga.id,
  slug: manga.slug,
  title: manga.title,
  description: manga.description,
  originalLanguage: manga.originalLanguage,
  status: manga.status,
  contentRating: manga.contentRating,
  year: manga.year,
  latestChapterPublishedAt: manga.latestChapterPublishedAt,
  coverKey: cover.storageKey,
  coverWidth: cover.width,
  coverHeight: cover.height,
}

type MangaSummaryRow = Parameters<typeof mapManga>[0]

export async function hydrateMangaRows(
  database: Database,
  assetBaseUrl: string,
  rows: MangaSummaryRow[],
  visibility: CatalogVisibility
) {
  const mangaIds = rows.map(({ id }) => id)
  const [credits, latestChapters] = await Promise.all([
    mangaCredits(database, mangaIds),
    latestChaptersByManga(database, mangaIds, visibility),
  ])

  return rows.map((row) => ({
    ...mapManga(row, assetBaseUrl, latestChapters.get(row.id) ?? null),
    tags: credits.tags.get(row.id) ?? [],
    authors: credits.authors.get(row.id) ?? [],
  }))
}

function catalogOrder(query: MangaCatalogQuery) {
  const ascending = query.direction === "asc"
  const id = ascending ? asc(manga.id) : desc(manga.id)

  switch (query.sort) {
    case "publishedAt":
      return [ascending ? asc(manga.publishedAt) : desc(manga.publishedAt), id]
    case "title":
      return [ascending ? asc(manga.searchTitle) : desc(manga.searchTitle), id]
    case "year":
      return [
        ascending
          ? sql`${manga.year} asc nulls last`
          : sql`${manga.year} desc nulls last`,
        id,
      ]
    default:
      return [
        ascending
          ? sql`${manga.latestChapterPublishedAt} asc nulls last`
          : sql`${manga.latestChapterPublishedAt} desc nulls last`,
        id,
      ]
  }
}

async function latestChaptersByManga(
  database: Pick<Database, "select" | "selectDistinctOn">,
  mangaIds: string[],
  visibility: CatalogVisibility
): Promise<Map<string, NonNullable<MangaSummary["latestChapter"]>>> {
  if (mangaIds.length === 0) return new Map()

  const rows = await database
    .selectDistinctOn([chapter.mangaId], {
      mangaId: chapter.mangaId,
      id: chapter.id,
      number: chapter.number,
      publishedAt: publishedChapterAt,
    })
    .from(chapter)
    .where(and(inArray(chapter.mangaId, mangaIds), readableChapter(visibility)))
    .orderBy(asc(chapter.mangaId), desc(chapter.publishedAt), desc(chapter.id))
  const chapterIds = rows.map(({ id }) => id)
  const [groups, statistics] = await Promise.all([
    groupsByChapter(database, chapterIds),
    statisticsByChapter(database, chapterIds),
  ])

  return new Map(
    rows.map(
      (row) =>
        [
          row.mangaId,
          {
            id: row.id,
            number: normalizeDecimal(row.number),
            publishedAt: formatISO(row.publishedAt),
            groups: groups.get(row.id) ?? [],
            statistics: statistics.get(row.id) ?? { views: 0, comments: 0 },
          },
        ] as const
    )
  )
}

async function mangaCredits(
  database: Pick<Database, "select">,
  mangaIds: string[]
) {
  const tags = new Map<string, MangaSummary["tags"]>()
  const authors = new Map<string, MangaSummary["authors"]>()
  const artists = new Map<string, MangaDetail["artists"]>()
  if (mangaIds.length === 0) return { tags, authors, artists }

  const [tagRows, peopleRows] = await Promise.all([
    database
      .select({
        mangaId: mangaTag.mangaId,
        id: tag.id,
        slug: tag.slug,
        group: tag.group,
        name: tag.name,
      })
      .from(mangaTag)
      .innerJoin(tag, eq(tag.id, mangaTag.tagId))
      .where(
        and(inArray(mangaTag.mangaId, mangaIds), isNull(tag.moderationHiddenAt))
      )
      .orderBy(
        asc(mangaTag.mangaId),
        asc(tag.group),
        asc(tag.name),
        asc(tag.id)
      ),
    database
      .select({
        mangaId: mangaPerson.mangaId,
        id: person.id,
        slug: person.slug,
        name: person.name,
        role: mangaPerson.role,
      })
      .from(mangaPerson)
      .innerJoin(person, eq(person.id, mangaPerson.personId))
      .where(inArray(mangaPerson.mangaId, mangaIds))
      .orderBy(asc(mangaPerson.mangaId), asc(person.name), asc(person.id)),
  ])

  for (const { mangaId, ...item } of tagRows) {
    const mangaTags = tags.get(mangaId)
    if (mangaTags) mangaTags.push(item)
    else tags.set(mangaId, [item])
  }
  for (const { mangaId, role, ...item } of peopleRows) {
    const target = role === "author" ? authors : artists
    const people = target.get(mangaId)
    if (people) people.push(item)
    else target.set(mangaId, [item])
  }

  return { tags, authors, artists }
}

async function loadMangaList(
  database: Database,
  assetBaseUrl: string,
  query: MangaCatalogQuery,
  visibility: CatalogVisibility
): Promise<MangaList> {
  const visible = catalogManga(database, visibility, query)
  const [[totalRow], rows] = await Promise.all([
    database.select({ value: count() }).from(manga).where(visible),
    database
      .select({
        ...mangaSummaryColumns,
        alternativeTitles: manga.alternativeTitles,
        views: mangaStats.views,
        follows: mangaStats.follows,
        comments: mangaStats.comments,
      })
      .from(manga)
      .leftJoin(
        cover,
        and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
      )
      .leftJoin(mangaStats, eq(mangaStats.mangaId, manga.id))
      .where(visible)
      .orderBy(...catalogOrder(query))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
  ])
  const total = Number(totalRow?.value ?? 0)
  const summaries = await hydrateMangaRows(
    database,
    assetBaseUrl,
    rows,
    visibility
  )
  return {
    data: summaries.map((summary, index) => ({
      ...summary,
      alternativeTitles: rows[index]!.alternativeTitles,
      statistics: {
        views: Number(rows[index]!.views ?? 0),
        follows: Number(rows[index]!.follows ?? 0),
        comments: Number(rows[index]!.comments ?? 0),
      },
    })),
    meta: pageMeta(query.page, query.limit, total),
  }
}

async function loadRandomManga(
  database: Database,
  assetBaseUrl: string,
  visibility: CatalogVisibility,
  ids: string[]
): Promise<RandomManga> {
  if (ids.length === 0) return { data: [] }
  const rows = await database
    .select(mangaSummaryColumns)
    .from(manga)
    .leftJoin(
      cover,
      and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
    )
    .where(and(inArray(manga.id, ids), catalogManga(database, visibility)))
  const byId = new Map(rows.map((row) => [row.id, row]))
  return {
    data: await hydrateMangaRows(
      database,
      assetBaseUrl,
      ids.flatMap((id) => {
        const row = byId.get(id)
        return row ? [row] : []
      }),
      visibility
    ),
  }
}

async function loadMangaRecommendations(
  database: Database,
  assetBaseUrl: string,
  id: string,
  visibility: CatalogVisibility
): Promise<MangaRecommendations | null> {
  const [[owner], authorRows, tagRows] = await Promise.all([
    database
      .select({ id: manga.id })
      .from(manga)
      .where(and(eq(manga.id, id), visibleManga(visibility)))
      .limit(1),
    database
      .select({ id: mangaPerson.personId })
      .from(mangaPerson)
      .where(and(eq(mangaPerson.mangaId, id), eq(mangaPerson.role, "author"))),
    database
      .select({ id: mangaTag.tagId })
      .from(mangaTag)
      .innerJoin(tag, eq(tag.id, mangaTag.tagId))
      .where(
        and(
          eq(mangaTag.mangaId, id),
          inArray(tag.group, ["genre", "theme"]),
          isNull(tag.moderationHiddenAt)
        )
      ),
  ])
  if (!owner) return null

  const authorIds = authorRows.map(({ id }) => id)
  const tagIds = tagRows.map(({ id }) => id)
  const requiredTagMatches = recommendationTagThreshold(tagIds.length)
  const engagementOrder = [
    sql`coalesce(${mangaStats.follows}, 0) desc`,
    sql`coalesce(${mangaStats.views}, 0) desc`,
    sql`coalesce(${mangaStats.comments}, 0) desc`,
    asc(manga.id),
  ] as const

  const [byAuthorRows, similarRows] = await Promise.all([
    authorIds.length > 0
      ? database
          .select({ id: manga.id })
          .from(manga)
          .innerJoin(mangaPerson, eq(mangaPerson.mangaId, manga.id))
          .leftJoin(mangaStats, eq(mangaStats.mangaId, manga.id))
          .where(
            and(
              ne(manga.id, id),
              eq(mangaPerson.role, "author"),
              inArray(mangaPerson.personId, authorIds),
              catalogManga(database, visibility)
            )
          )
          .groupBy(
            manga.id,
            mangaStats.follows,
            mangaStats.views,
            mangaStats.comments
          )
          .orderBy(...engagementOrder)
          .limit(recommendationLimit)
      : Promise.resolve([]),
    requiredTagMatches > 0
      ? database
          .select({
            id: manga.id,
            sharedTags: countDistinct(mangaTag.tagId).mapWith(Number),
          })
          .from(manga)
          .innerJoin(mangaTag, eq(mangaTag.mangaId, manga.id))
          .leftJoin(mangaStats, eq(mangaStats.mangaId, manga.id))
          .where(
            and(
              ne(manga.id, id),
              inArray(mangaTag.tagId, tagIds),
              catalogManga(database, visibility)
            )
          )
          .groupBy(
            manga.id,
            mangaStats.follows,
            mangaStats.views,
            mangaStats.comments
          )
          .having(gte(countDistinct(mangaTag.tagId), requiredTagMatches))
          .orderBy(desc(countDistinct(mangaTag.tagId)), ...engagementOrder)
          .limit(recommendationPoolLimit)
      : Promise.resolve([]),
  ])

  const byAuthorIds = byAuthorRows.map(({ id }) => id)
  const byAuthorSet = new Set(byAuthorIds)
  const similarIds = similarRows
    .map(({ id }) => id)
    .filter((candidateId) => !byAuthorSet.has(candidateId))
    .slice(0, recommendationLimit)
  const ids = [...byAuthorIds, ...similarIds]
  if (ids.length === 0) return { byAuthor: [], similar: [] }

  const rows = await database
    .select(mangaSummaryColumns)
    .from(manga)
    .leftJoin(
      cover,
      and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
    )
    .where(and(inArray(manga.id, ids), catalogManga(database, visibility)))
  const summaries = new Map(
    (await hydrateMangaRows(database, assetBaseUrl, rows, visibility)).map(
      (item) => [item.id, item]
    )
  )
  const resolve = (orderedIds: string[]) =>
    orderedIds.flatMap((mangaId) => {
      const item = summaries.get(mangaId)
      return item ? [item] : []
    })

  return {
    byAuthor: resolve(byAuthorIds),
    similar: resolve(similarIds),
  }
}

async function loadTags(database: Database): Promise<TagList> {
  return {
    data: await database
      .select({ id: tag.id, slug: tag.slug, group: tag.group, name: tag.name })
      .from(tag)
      .where(isNull(tag.moderationHiddenAt))
      .orderBy(asc(tag.group), asc(tag.name), asc(tag.id)),
  }
}

async function loadTag(
  database: Database,
  id: string
): Promise<TagSummary | null> {
  const [value] = await database
    .select({ id: tag.id, slug: tag.slug, group: tag.group, name: tag.name })
    .from(tag)
    .where(and(eq(tag.id, id), isNull(tag.moderationHiddenAt)))
    .limit(1)
  return value ?? null
}

async function loadGroups(
  database: Database,
  { q, page, limit }: TranslationGroupListQuery
): Promise<TranslationGroupList> {
  const where = and(
    publicGroup,
    q
      ? sql`lower(${translationGroup.name}) like ${likePattern(q.toLowerCase())} escape '\\'`
      : undefined
  )
  const [[totalRow], rows] = await Promise.all([
    database
      .select({ value: count() })
      .from(translationGroup)
      .innerJoin(
        translationGroupProfile,
        eq(translationGroupProfile.organizationId, translationGroup.id)
      )
      .where(where),
    database
      .select({
        id: translationGroup.id,
        slug: translationGroup.slug,
        name: translationGroup.name,
        avatarUrl: translationGroup.logo,
        inactive: translationGroupProfile.inactive,
      })
      .from(translationGroup)
      .innerJoin(
        translationGroupProfile,
        eq(translationGroupProfile.organizationId, translationGroup.id)
      )
      .where(where)
      .orderBy(asc(translationGroup.name), asc(translationGroup.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ])
  const total = Number(totalRow?.value ?? 0)

  return {
    data: rows,
    meta: pageMeta(page, limit, total),
  }
}

async function loadGroup(
  database: Database,
  id: string,
  visibility: CatalogVisibility
): Promise<TranslationGroupDetail | null> {
  const [value] = await database
    .select({
      id: translationGroup.id,
      slug: translationGroup.slug,
      name: translationGroup.name,
      avatarUrl: translationGroup.logo,
      bannerUrl: translationGroupProfile.bannerUrl,
      description: translationGroupProfile.description,
      links: translationGroupProfile.links,
      inactive: translationGroupProfile.inactive,
      createdAt: translationGroupProfile.createdAt,
    })
    .from(translationGroup)
    .innerJoin(
      translationGroupProfile,
      eq(translationGroupProfile.organizationId, translationGroup.id)
    )
    .where(and(eq(translationGroup.id, id), publicGroup))
    .limit(1)
  if (!value) return null

  const [[mangaStatistics], [chapterStatistics], [viewStatistics], [leader]] =
    await Promise.all([
      database
        .select({
          mangaCount: countDistinct(manga.id),
        })
        .from(mangaGroup)
        .innerJoin(manga, eq(manga.id, mangaGroup.mangaId))
        .where(and(eq(mangaGroup.groupId, id), visibleManga(visibility))),
      database
        .select({
          chapterCount: countDistinct(
            sql`(${chapter.mangaId}, ${chapter.language}, ${chapter.readingKey})`
          ),
          releaseCount: countDistinct(chapter.id),
        })
        .from(chapterGroup)
        .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
        .innerJoin(manga, eq(manga.id, chapter.mangaId))
        .where(
          and(
            eq(chapterGroup.groupId, id),
            readableChapter(visibility),
            visibleManga(visibility)
          )
        ),
      database
        .select({
          views:
            sql`coalesce(sum(${translationGroupMangaViewStats.views}), 0)`.mapWith(
              Number
            ),
        })
        .from(translationGroupMangaViewStats)
        .innerJoin(manga, eq(manga.id, translationGroupMangaViewStats.mangaId))
        .where(
          and(
            eq(translationGroupMangaViewStats.groupId, id),
            visibleManga(visibility),
            exists(
              database
                .select({ id: chapter.id })
                .from(chapter)
                .where(
                  and(
                    eq(chapter.mangaId, manga.id),
                    readableChapter(visibility)
                  )
                )
            )
          )
        ),
      database
        .select({ name: user.name })
        .from(translationGroupMember)
        .innerJoin(user, eq(user.id, translationGroupMember.userId))
        .where(
          and(
            eq(translationGroupMember.organizationId, id),
            eq(translationGroupMember.role, "owner")
          )
        )
        .limit(1),
    ])

  const group = value
  return {
    ...group,
    createdAt: formatISO(value.createdAt),
    leader: leader?.name ?? null,
    links: resolveGroupLinks(value.links),
    statistics: {
      views: viewStatistics?.views ?? 0,
      mangaCount: mangaStatistics?.mangaCount ?? 0,
      chapterCount: chapterStatistics?.chapterCount ?? 0,
      releaseCount: chapterStatistics?.releaseCount ?? 0,
    },
  }
}

async function loadPerson(
  database: Database,
  id: string,
  visibility: CatalogVisibility
): Promise<PersonDetail | null> {
  const [value] = await database
    .select({
      id: person.id,
      slug: person.slug,
      name: person.name,
      description: person.description,
      links: person.links,
    })
    .from(person)
    .where(eq(person.id, id))
    .limit(1)
  if (!value) return null

  const roles = await database
    .selectDistinct({ role: mangaPerson.role })
    .from(mangaPerson)
    .innerJoin(manga, eq(manga.id, mangaPerson.mangaId))
    .where(
      and(eq(mangaPerson.personId, id), catalogManga(database, visibility))
    )
    .orderBy(asc(mangaPerson.role))

  return {
    ...value,
    links: resolvePersonLinks(value.links),
    roles: roles.map(({ role }) => role),
  }
}

async function loadPeople(
  database: Database,
  query: PersonListQuery,
  visibility: CatalogVisibility
): Promise<PersonList> {
  const filters = and(
    query.q
      ? sql`lower(${person.name}) like ${likePattern(query.q.toLowerCase())} escape '\\'`
      : undefined,
    query.id.length > 0 ? inArray(person.id, query.id) : undefined
  )
  if (!query.role) {
    const rows = await database
      .select({ id: person.id, slug: person.slug, name: person.name })
      .from(person)
      .where(filters)
      .orderBy(asc(person.name), asc(person.id))
      .limit(query.limit)
    return { data: rows }
  }

  const rows = await database
    .selectDistinct({ id: person.id, slug: person.slug, name: person.name })
    .from(person)
    .innerJoin(mangaPerson, eq(mangaPerson.personId, person.id))
    .innerJoin(manga, eq(manga.id, mangaPerson.mangaId))
    .where(
      and(
        eq(mangaPerson.role, query.role),
        filters,
        catalogManga(database, visibility)
      )
    )
    .orderBy(asc(person.name), asc(person.id))
    .limit(query.limit)

  return { data: rows }
}

async function loadLatestChapters(
  database: Database,
  assetBaseUrl: string,
  page: number,
  limit: number,
  visibility: CatalogVisibility
): Promise<LatestChapterList> {
  const where = and(readableChapter(visibility), visibleManga(visibility))
  const [[totalRow], rows] = await Promise.all([
    database
      .select({ value: count() })
      .from(chapter)
      .innerJoin(manga, eq(manga.id, chapter.mangaId))
      .where(where),
    database
      .select({
        id: chapter.id,
        isDefault: chapter.isDefault,
        volume: mangaVolume.number,
        number: chapter.number,
        title: chapter.title,
        language: chapter.language,
        pageCount: chapter.pageCount,
        publishedAt: publishedChapterAt,
        uploaderId: user.id,
        uploaderName: user.name,
        mangaId: manga.id,
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        coverKey: cover.storageKey,
        coverWidth: cover.width,
        coverHeight: cover.height,
      })
      .from(chapter)
      .innerJoin(manga, eq(manga.id, chapter.mangaId))
      .leftJoin(user, eq(user.id, chapter.uploaderUserId))
      .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
      .leftJoin(
        cover,
        and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
      )
      .where(where)
      .orderBy(desc(chapter.publishedAt), desc(chapter.id))
      .limit(limit)
      .offset((page - 1) * limit),
  ])
  const chapterIds = rows.map(({ id }) => id)
  const [groups, statistics] = await Promise.all([
    groupsByChapter(database, chapterIds),
    statisticsByChapter(database, chapterIds),
  ])

  return {
    data: rows.map((row) => ({
      ...mapChapter(
        {
          id: row.id,
          isDefault: row.isDefault,
          volume: row.volume,
          number: row.number,
          title: row.title,
          language: row.language,
          pageCount: row.pageCount,
          publishedAt: row.publishedAt,
          uploaderId: row.uploaderId,
          uploaderName: row.uploaderName,
        },
        groups,
        statistics
      ),
      manga: {
        id: row.mangaId,
        slug: row.mangaSlug,
        title: row.mangaTitle,
        cover: row.coverKey
          ? {
              url: resolveCoverUrl(assetBaseUrl, row.coverKey),
              width: row.coverWidth,
              height: row.coverHeight,
            }
          : null,
      },
    })),
    meta: pageMeta(page, limit, Number(totalRow?.value ?? 0)),
  }
}

async function loadMangaView(
  database: Pick<Database, "select" | "selectDistinct" | "selectDistinctOn">,
  assetBaseUrl: string,
  id: string,
  visibility: CatalogVisibility,
  mangaVisibility: SQL | undefined
): Promise<MangaPreview | null> {
  const [row] = await database
    .select({
      id: manga.id,
      slug: manga.slug,
      title: manga.title,
      description: manga.description,
      originalLanguage: manga.originalLanguage,
      status: manga.status,
      contentRating: manga.contentRating,
      year: manga.year,
      numberingMode: manga.numberingMode,
      latestChapterPublishedAt: manga.latestChapterPublishedAt,
      coverKey: cover.storageKey,
      coverWidth: cover.width,
      coverHeight: cover.height,
      alternativeTitles: manga.alternativeTitles,
      publicationDemographic: manga.publicationDemographic,
      lastVolume: manga.lastVolume,
      lastChapter: manga.lastChapter,
      links: manga.links,
      createdAt: manga.createdAt,
      updatedAt: manga.updatedAt,
      publishedAt: sql<Date>`${manga.publishedAt}`,
      views: mangaStats.views,
      follows: mangaStats.follows,
      comments: mangaStats.comments,
    })
    .from(manga)
    .leftJoin(
      cover,
      and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
    )
    .leftJoin(mangaStats, eq(mangaStats.mangaId, manga.id))
    .where(and(eq(manga.id, id), mangaVisibility))
    .limit(1)

  if (!row) return null

  const [credits, groupRows, languageRows, latestChapters, releases] =
    await Promise.all([
      mangaCredits(database, [id]),
      database
        .selectDistinct({
          id: translationGroup.id,
          slug: translationGroup.slug,
          name: translationGroup.name,
          avatarUrl: translationGroup.logo,
        })
        .from(mangaGroup)
        .innerJoin(
          translationGroup,
          eq(translationGroup.id, mangaGroup.groupId)
        )
        .innerJoin(
          translationGroupProfile,
          eq(translationGroupProfile.organizationId, translationGroup.id)
        )
        .where(and(eq(mangaGroup.mangaId, id), publicGroup))
        .orderBy(asc(translationGroup.name), asc(translationGroup.id)),
      database
        .select({ language: mangaLanguage.language })
        .from(mangaLanguage)
        .where(eq(mangaLanguage.mangaId, id))
        .orderBy(asc(mangaLanguage.language)),
      latestChaptersByManga(database, [id], visibility),
      loadChapterReleases(database, id, visibility),
    ])
  const languageCounts = new Map<string, number>()
  for (const r of releases)
    languageCounts.set(r.language, (languageCounts.get(r.language) ?? 0) + 1)
  const slots = chapterSlots(
    releases,
    row.numberingMode,
    new Set(
      [...languageCounts]
        .filter(([, count]) => count === 1)
        .map(([language]) => language)
    )
  )
  const readingEntries = mangaReadingEntries(releases, row.numberingMode)
  const first = (
    readingEntries.find((e) => e.language === "vi") ?? readingEntries[0]
  )?.first
  const firstRelease = first?.options.find(
    (r) => r.id === first.selectedChapterId
  )

  return {
    ...mapManga(row, assetBaseUrl, latestChapters.get(id) ?? null),
    numberingMode: row.numberingMode,
    readingEntries,
    chapterCounts: { slots: slots.length, releases: releases.length },
    firstChapter: firstRelease
      ? {
          id: firstRelease.id,
          number: firstRelease.number,
        }
      : null,
    statistics: {
      views: Number(row.views ?? 0),
      follows: Number(row.follows ?? 0),
      comments: Number(row.comments ?? 0),
    },
    alternativeTitles: row.alternativeTitles,
    publicationDemographic: row.publicationDemographic,
    lastVolume: row.lastVolume,
    lastChapter: row.lastChapter,
    links: resolveMangaLinks(row.links),
    tags: credits.tags.get(id) ?? [],
    authors: credits.authors.get(id) ?? [],
    artists: credits.artists.get(id) ?? [],
    groups: groupRows,
    availableLanguages: languageRows.map(({ language }) => language),
    createdAt: formatISO(row.createdAt),
    updatedAt: formatISO(row.updatedAt),
    publishedAt: row.publishedAt ? formatISO(row.publishedAt) : null,
  }
}

async function loadMangaDetail(
  database: Pick<Database, "select" | "selectDistinct" | "selectDistinctOn">,
  assetBaseUrl: string,
  id: string,
  visibility: CatalogVisibility
): Promise<MangaDetail | null> {
  const value = await loadMangaView(
    database,
    assetBaseUrl,
    id,
    visibility,
    visibleManga(visibility)
  )
  if (!value?.publishedAt) return null
  return { ...value, publishedAt: value.publishedAt }
}

export function loadMangaPreview(
  database: Database,
  assetBaseUrl: string,
  id: string
) {
  return loadMangaView(
    database,
    assetBaseUrl,
    id,
    {},
    and(
      eq(manga.publicationState, "draft"),
      isNull(manga.deletedAt),
      isNull(manga.publishedAt)
    )
  )
}

async function groupsByChapter(
  database: Pick<Database, "select">,
  chapterIds: string[]
) {
  if (chapterIds.length === 0)
    return new Map<string, ChapterSummary["groups"]>()

  const rows = await database
    .select({
      chapterId: chapterGroup.chapterId,
      id: translationGroup.id,
      slug: translationGroup.slug,
      name: translationGroup.name,
    })
    .from(chapterGroup)
    .innerJoin(translationGroup, eq(translationGroup.id, chapterGroup.groupId))
    .innerJoin(
      translationGroupProfile,
      eq(translationGroupProfile.organizationId, translationGroup.id)
    )
    .where(and(inArray(chapterGroup.chapterId, chapterIds), publicGroup))
    .orderBy(asc(translationGroup.name), asc(translationGroup.id))
  const result = new Map<string, ChapterSummary["groups"]>()

  for (const row of rows) {
    result.set(row.chapterId, [
      ...(result.get(row.chapterId) ?? []),
      { id: row.id, slug: row.slug, name: row.name },
    ])
  }
  return result
}

async function statisticsByChapter(
  database: Pick<Database, "select">,
  chapterIds: string[]
) {
  if (chapterIds.length === 0)
    return new Map<string, ChapterSummary["statistics"]>()

  const rows = await database
    .select({
      id: chapter.id,
      views: chapterStats.views,
      comments: count(comment.id),
    })
    .from(chapter)
    .leftJoin(chapterStats, eq(chapterStats.chapterId, chapter.id))
    .leftJoin(
      comment,
      and(
        eq(comment.chapterId, chapter.id),
        eq(comment.status, "visible"),
        isNull(comment.deletedAt)
      )
    )
    .where(inArray(chapter.id, chapterIds))
    .groupBy(chapter.id, chapterStats.views)

  return new Map(
    rows.map((row) => [
      row.id,
      { views: Number(row.views ?? 0), comments: row.comments },
    ])
  )
}

function mapChapter(
  row: {
    id: string
    isDefault: boolean
    volume: string | null
    number: string | null
    title: string | null
    language: string
    pageCount: number
    publishedAt: Date
    uploaderId: string | null
    uploaderName: string | null
  },
  groups: Map<string, ChapterSummary["groups"]>,
  statistics: Map<string, ChapterSummary["statistics"]>
): ChapterSummary {
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    pageCount: row.pageCount,
    isDefault: row.isDefault,
    volume: normalizeDecimal(row.volume),
    number: normalizeDecimal(row.number),
    publishedAt: formatISO(row.publishedAt),
    groups: groups.get(row.id) ?? [],
    uploader: row.uploaderId
      ? { id: row.uploaderId, name: row.uploaderName ?? "Người dùng" }
      : { id: null, name: "System" },
    statistics: statistics.get(row.id) ?? { views: 0, comments: 0 },
  }
}

async function loadChapterList(
  database: Pick<Database, "select">,
  mangaId: string,
  page: number,
  limit: number,
  direction: MangaChapterListQuery["direction"],
  sort: MangaChapterListQuery["sort"],
  visibility: CatalogVisibility,
  language?: string
): Promise<ChapterList | null> {
  const [owner] = await database
    .select({ id: manga.id, numberingMode: manga.numberingMode })
    .from(manga)
    .where(and(eq(manga.id, mangaId), visibleManga(visibility)))
    .limit(1)
  if (!owner) return null

  const where = and(
    eq(chapter.mangaId, mangaId),
    readableChapter(visibility),
    language ? eq(chapter.language, language) : undefined
  )
  const byVolume = sort === "volume"
  const positionVolume = byVolume ? chapterVolume : readingVolume
  const [[totalRow], positions] = await Promise.all([
    database
      .select({
        slots: countDistinct(
          byVolume
            ? sql`(${chapter.language}, ${chapter.readingKey}, ${positionVolume})`
            : sql`(${chapter.language}, ${chapter.readingKey})`
        ),
        releases: count(),
      })
      .from(chapter)
      .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
      .where(where),
    database
      .select({
        readingKey: chapter.readingKey,
        language: chapter.language,
        number: chapter.number,
        volume: positionVolume,
        languageSlots: sql<number>`(count(*) OVER (PARTITION BY ${chapter.language}))::int`,
      })
      .from(chapter)
      .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
      .where(where)
      .groupBy(
        chapter.readingKey,
        chapter.language,
        chapter.number,
        positionVolume
      )
      .orderBy(
        ...(!byVolume ? [asc(chapter.language)] : []),
        direction === "asc"
          ? sql`${positionVolume} asc nulls last`
          : byVolume
            ? sql`${positionVolume} desc nulls first`
            : sql`${positionVolume} desc nulls last`,
        direction === "asc"
          ? sql`${chapter.number} asc nulls last`
          : sql`${chapter.number} desc nulls last`,
        ...(byVolume ? [asc(chapter.language)] : []),
        asc(chapter.readingKey)
      )
      .limit(limit)
      .offset((page - 1) * limit),
  ])
  const rows = positions.length
    ? await loadChapterReleases(
        database,
        mangaId,
        visibility,
        or(
          ...positions.map((p) =>
            and(
              eq(chapter.readingKey, p.readingKey),
              eq(chapter.language, p.language)
            )
          )
        )!,
        true
      )
    : []
  const singles = new Set(
    positions.filter((p) => p.languageSlots === 1).map((p) => p.language)
  )
  const grouped = chapterSlots(rows, owner.numberingMode, singles)
  const byKey = new Map(
    grouped.map((s) => [JSON.stringify([s.language, s.key]), s])
  )
  const slots = positions.map((p) => {
    const slot = byKey.get(JSON.stringify([p.language, p.readingKey]))!
    if (!byVolume) return slot
    const volume = normalizeDecimal(p.volume)
    const releases = slot.releases.filter((r) => r.volume === volume)
    return {
      ...slot,
      volume,
      releases,
      // A display fragment must not choose a new default for the logical slot.
      defaultChapterId: releases.some((r) => r.id === slot.defaultChapterId)
        ? slot.defaultChapterId
        : null,
    }
  })
  return {
    data: slots.flatMap((s) => s.releases),
    slots,
    meta: {
      ...pageMeta(page, limit, Number(totalRow?.slots ?? 0)),
      releaseTotal: Number(totalRow?.releases ?? 0),
    },
  }
}

async function loadChapterReleases(
  database: Pick<Database, "select">,
  mangaId: string,
  visibility: CatalogVisibility,
  filter?: SQL,
  includeStatistics = false
): Promise<ChapterRelease[]> {
  const rows = await database
    .select({
      id: chapter.id,
      isDefault: chapter.isDefault,
      readingKey: chapter.readingKey,
      volume: chapterVolume,
      number: chapter.number,
      title: chapter.title,
      language: chapter.language,
      pageCount: chapter.pageCount,
      publishedAt: publishedChapterAt,
      uploaderId: user.id,
      uploaderName: user.name,
      laneGroupIds: sql<
        string[]
      >`ARRAY(SELECT group_id FROM chapter_group WHERE chapter_id = ${chapter.id} ORDER BY group_id)`,
    })
    .from(chapter)
    .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
    .leftJoin(user, eq(user.id, chapter.uploaderUserId))
    .where(
      and(eq(chapter.mangaId, mangaId), readableChapter(visibility), filter)
    )
    .orderBy(asc(chapter.language), ...chapterAscending)
  const ids = rows.map((r) => r.id)
  const [groups, statistics] = await Promise.all([
    groupsByChapter(database, ids),
    includeStatistics
      ? statisticsByChapter(database, ids)
      : Promise.resolve(new Map()),
  ])
  return rows.map((r) => ({
    ...mapChapter(r, groups, statistics),
    readingKey: r.readingKey,
    laneGroupIds: r.laneGroupIds,
  }))
}

async function loadChapterNavigationReleases(
  database: Pick<Database, "select">,
  id: string,
  direction: "previous" | "next",
  visibility: CatalogVisibility
): Promise<ChapterSummary[] | null> {
  const [current] = await database
    .select({
      mangaId: chapter.mangaId,
      language: chapter.language,
      mode: manga.numberingMode,
    })
    .from(chapter)
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
    .where(
      and(
        eq(chapter.id, id),
        readableChapter(visibility),
        visibleManga(visibility)
      )
    )
    .limit(1)
  if (!current) return null
  const releases = await loadChapterReleases(
    database,
    current.mangaId,
    visibility,
    eq(chapter.language, current.language)
  )
  const choice = chapterNavigation(releases, id, current.mode)[direction]
  const statistics = await statisticsByChapter(
    database,
    choice.options.map((r) => r.id)
  )
  const byId = new Map(
    releases.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Internal lane identifiers stay private.
      ({ readingKey: _key, laneGroupIds: _lane, ...release }) => [
        release.id,
        release,
      ]
    )
  )
  return choice.options.map((option) => ({
    ...byId.get(option.id)!,
    statistics: statistics.get(option.id) ?? { views: 0, comments: 0 },
  }))
}

async function loadChapterDetail(
  database: Pick<Database, "select">,
  assetBaseUrl: string,
  id: string,
  visibility: CatalogVisibility,
  imageServer2ReadEnabled: boolean
): Promise<ChapterDetail | null> {
  const [row] = await database
    .select({
      id: chapter.id,
      isDefault: chapter.isDefault,
      numberingMode: manga.numberingMode,
      mangaId: chapter.mangaId,
      volume: mangaVolume.number,
      number: chapter.number,
      title: chapter.title,
      language: chapter.language,
      pageCount: chapter.pageCount,
      publishedAt: publishedChapterAt,
      uploaderId: user.id,
      uploaderName: user.name,
      mangaSlug: manga.slug,
      pagesVersion: chapter.pagesVersion,
      mangaTitle: manga.title,
      coverKey: cover.storageKey,
      coverWidth: cover.width,
      coverHeight: cover.height,
      isLongStrip: exists(
        database
          .select({ id: mangaTag.tagId })
          .from(mangaTag)
          .innerJoin(tag, eq(tag.id, mangaTag.tagId))
          .where(
            and(eq(mangaTag.mangaId, manga.id), eq(tag.slug, "long-strip"))
          )
      ),
    })
    .from(chapter)
    .innerJoin(manga, eq(manga.id, chapter.mangaId))
    .leftJoin(user, eq(user.id, chapter.uploaderUserId))
    .leftJoin(mangaVolume, eq(mangaVolume.id, chapter.volumeId))
    .leftJoin(
      cover,
      and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
    )
    .where(
      and(
        eq(chapter.id, id),
        readableChapter(visibility),
        visibleManga(visibility)
      )
    )
    .limit(1)
  if (!row) return null

  const [pages, groups, statistics, navigation] = await Promise.all([
    database
      .select()
      .from(chapterPage)
      .where(eq(chapterPage.chapterId, id))
      .orderBy(asc(chapterPage.position)),
    groupsByChapter(database, [id]),
    statisticsByChapter(database, [id]),
    // ponytail: one manga/language in memory, use indexed neighbor-slot queries if this becomes a measured bottleneck.
    loadChapterReleases(
      database,
      row.mangaId,
      visibility,
      eq(chapter.language, row.language)
    ),
  ])
  const choices = chapterNavigation(navigation, id, row.numberingMode)
  const [replica] = imageServer2ReadEnabled
    ? await database
        .select()
        .from(chapterTikTokReplica)
        .where(eq(chapterTikTokReplica.chapterId, id))
    : []
  const replicaUrls = readyReplicaUrls(pages, row.pagesVersion, replica)

  return {
    ...mapChapter(row, groups, statistics),
    pagesVersion: row.pagesVersion,
    manga: {
      id: row.mangaId,
      slug: row.mangaSlug,
      title: row.mangaTitle,
      isLongStrip: Boolean(row.isLongStrip),
      cover: row.coverKey
        ? {
            url: resolveCoverUrl(assetBaseUrl, row.coverKey),
            width: row.coverWidth,
            height: row.coverHeight,
          }
        : null,
    },
    pages: pages.map((page, index) => ({
      position: page.position,
      url: resolveAssetUrl(assetBaseUrl, page.originalKey),
      replicaUrl: replicaUrls?.[index] ?? null,
      optimizedUrl: page.optimizedKey
        ? resolveAssetUrl(assetBaseUrl, page.optimizedKey)
        : null,
      width: page.width,
      height: page.height,
      optimizedWidth: page.optimizedWidth,
      optimizedHeight: page.optimizedHeight,
    })),
    navigation: choices,
    previous:
      choices.previous.options.find(
        (r) => r.id === choices.previous.selectedChapterId
      ) ?? null,
    next:
      choices.next.options.find(
        (r) => r.id === choices.next.selectedChapterId
      ) ?? null,
  }
}

export function registerCatalogRoutes(
  app: OpenAPIHono,
  dependencies: CatalogDependencies
) {
  const { assetBaseUrl, cache, database } = dependencies
  const visibility: CatalogVisibility = {
    hideR18: dependencies.hideR18 ?? true,
    hiddenMangaIds: [...(dependencies.hiddenMangaIds ?? [])].sort(),
    hiddenChapterIds: [...(dependencies.hiddenChapterIds ?? [])].sort(),
  }
  const selectRandomManga = createRandomMangaSelector(
    cache,
    visibility,
    async (limit) => {
      const rows = await database
        .select({ id: manga.id })
        .from(manga)
        .where(catalogManga(database, visibility))
        .orderBy(sql`random()`)
        .limit(limit)
      return rows.map(({ id }) => id)
    }
  )

  app.openapi(listMangaRoute, async (c) => {
    const query = normalizeCatalogQuery(c.req.valid("query"))
    // ponytail: visibility-sensitive payloads bypass shared cache until a
    // transaction-backed moderation revision can key them safely.
    const value = await loadMangaList(database, assetBaseUrl, query, visibility)
    return c.json(value, 200)
  })

  app.openapi(getRandomMangaRoute, async (c) => {
    const { limit } = c.req.valid("query")
    const ids = await selectRandomManga(limit)
    // Cached IDs are rechecked so moderation/deletion takes effect immediately.
    return c.json(
      await loadRandomManga(database, assetBaseUrl, visibility, ids),
      200
    )
  })

  app.openapi(getMangaRoute, async (c) => {
    const { id } = c.req.valid("param")
    const value = await database.transaction(
      (tx) => loadMangaDetail(tx, assetBaseUrl, id, visibility),
      { isolationLevel: "repeatable read", accessMode: "read only" }
    )
    return value
      ? c.json(value, 200)
      : c.json(
          apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
          404
        )
  })

  app.openapi(getMangaRecommendationsRoute, async (c) => {
    const { id } = c.req.valid("param")
    const value = await loadMangaRecommendations(
      database,
      assetBaseUrl,
      id,
      visibility
    )
    return value
      ? c.json(value, 200)
      : c.json(
          apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
          404
        )
  })

  app.openapi(listMangaChaptersRoute, async (c) => {
    const { id } = c.req.valid("param")
    const query = c.req.valid("query")
    const value = await database.transaction(
      (tx) =>
        loadChapterList(
          tx,
          id,
          query.page,
          query.limit,
          query.direction,
          query.sort,
          visibility,
          query.language
        ),
      { isolationLevel: "repeatable read", accessMode: "read only" }
    )
    return value
      ? c.json(value, 200)
      : c.json(
          apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
          404
        )
  })

  app.openapi(getChapterNavigationReleasesRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { direction } = c.req.valid("query")
    c.header("Cache-Control", "no-store")
    const data = await database.transaction(
      (tx) => loadChapterNavigationReleases(tx, id, direction, visibility),
      { isolationLevel: "repeatable read", accessMode: "read only" }
    )
    return data
      ? c.json({ data }, 200)
      : c.json(
          apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
          404
        )
  })

  app.openapi(getMangaReadingEntryRoute, async (c) => {
    const { id } = c.req.valid("param")
    const { position } = c.req.valid("query")
    c.header("Cache-Control", "no-store")
    const value = await database.transaction(
      (tx) =>
        loadChapterList(
          tx,
          id,
          1,
          1,
          position === "first" ? "asc" : "desc",
          "volume",
          visibility
        ),
      { isolationLevel: "repeatable read", accessMode: "read only" }
    )
    return value
      ? c.json({ data: value.data }, 200)
      : c.json(
          apiError("NOT_FOUND", "Manga not found", c.get("requestId")),
          404
        )
  })

  app.openapi(listLatestChaptersRoute, async (c) => {
    const query = c.req.valid("query")
    const value = await loadLatestChapters(
      database,
      assetBaseUrl,
      query.page,
      query.limit,
      visibility
    )
    return c.json(value, 200)
  })

  app.openapi(listTagsRoute, async (c) => {
    const value = await cached(cache, "manga:list", { tags: "list" }, () =>
      loadTags(database)
    )
    return c.json(value, 200)
  })

  app.openapi(getTagRoute, async (c) => {
    const { id } = c.req.valid("param")
    const value = await cached(cache, "manga:detail", { tag: id }, () =>
      loadTag(database, id)
    )
    return value
      ? c.json(value, 200)
      : c.json(apiError("NOT_FOUND", "Tag not found", c.get("requestId")), 404)
  })

  app.openapi(listGroupsRoute, async (c) => {
    const query = c.req.valid("query")
    if (query.q) return c.json(await loadGroups(database, query), 200)
    const value = await cached(
      cache,
      "manga:list",
      { groups: "list", page: query.page, limit: query.limit },
      () => loadGroups(database, query)
    )
    return c.json(value, 200)
  })

  app.openapi(getGroupRoute, async (c) => {
    const { id } = c.req.valid("param")
    const value = await loadGroup(database, id, visibility)
    return value
      ? c.json(value, 200)
      : c.json(
          apiError(
            "NOT_FOUND",
            "Translation group not found",
            c.get("requestId")
          ),
          404
        )
  })

  app.openapi(getPersonRoute, async (c) => {
    const { id } = c.req.valid("param")
    const value = await loadPerson(database, id, visibility)
    return value
      ? c.json(value, 200)
      : c.json(
          apiError("NOT_FOUND", "Person not found", c.get("requestId")),
          404
        )
  })

  app.openapi(listPeopleRoute, async (c) => {
    const valid = c.req.valid("query")
    const query: PersonListQuery = {
      ...valid,
      ...(valid.q
        ? { q: valid.q.trim().replace(/\s+/g, " ").toLowerCase() }
        : {}),
      id: normalizedIds(valid.id),
    }
    const value = await loadPeople(database, query, visibility)
    return c.json(value, 200)
  })

  app.openapi(getChapterRoute, async (c) => {
    const { id } = c.req.valid("param")
    const value = await database.transaction(
      (tx) =>
        loadChapterDetail(
          tx,
          assetBaseUrl,
          id,
          visibility,
          dependencies.imageServer2ReadEnabled ?? false
        ),
      { isolationLevel: "repeatable read", accessMode: "read only" }
    )
    return value
      ? c.json(value, 200)
      : c.json(
          apiError("NOT_FOUND", "Chapter not found", c.get("requestId")),
          404
        )
  })
}
