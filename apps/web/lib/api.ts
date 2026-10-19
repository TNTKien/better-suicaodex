import "server-only"

import { cacheLife } from "next/cache"
import {
  catalogRequest as request,
  getGroupRanking as sharedGetGroupRanking,
  getMangaList as sharedGetMangaList,
  getMangaRanking as sharedGetMangaRanking,
  getRecentComments as sharedGetRecentComments,
  getRandomManga as sharedGetRandomManga,
  getTags as sharedGetTags,
  getTag as sharedGetTag,
  getPerson as sharedGetPerson,
  getGroup as sharedGetGroup,
  getChapter as sharedGetChapter,
  getMangaChapters as sharedGetMangaChapters,
  isCatalogNotFound as isNotFound,
} from "@workspace/catalog/server"
import { getManga as sharedGetManga } from "@workspace/catalog/next-server"

import type { components, paths } from "@/src/lib/generated/api"

export type MangaList = components["schemas"]["MangaList"]
export type MangaSummary = components["schemas"]["MangaSummary"]
export type MangaRanking = components["schemas"]["MangaRanking"]
export type GroupRanking = components["schemas"]["GroupRanking"]
export type MangaDetail = components["schemas"]["MangaDetail"]
export type MangaRecommendations = components["schemas"]["MangaRecommendations"]
export type TagSummary = components["schemas"]["TagSummary"]
export type PersonDetail = components["schemas"]["PersonDetail"]
export type ChapterList = components["schemas"]["ChapterList"]
export type ChapterSummary = components["schemas"]["ChapterSummary"]
export type ChapterDetail = components["schemas"]["ChapterDetail"]
export type RecentComment = components["schemas"]["RecentComment"]

export function getBrowserApiBaseUrl() {
  const value = new URL(
    process.env.NEXT_PUBLIC_API_URL ??
      process.env.API_URL ??
      "http://localhost:3001"
  )
  if (!["http:", "https:"].includes(value.protocol)) {
    throw new Error("NEXT_PUBLIC_API_URL must use http or https")
  }
  return value.origin
}

type MangaListOptions = Pick<
  NonNullable<paths["/v1/manga"]["get"]["parameters"]["query"]>,
  | "sort"
  | "direction"
  | "limit"
  | "page"
  | "includeTag"
  | "author"
  | "artist"
  | "group"
  | "hasChapter"
> & { tagSlugs?: string[] }

type MangaRankingOptions = NonNullable<
  paths["/v1/rankings/manga"]["get"]["parameters"]["query"]
>

type GroupRankingOptions = NonNullable<
  paths["/v1/rankings/groups"]["get"]["parameters"]["query"]
>

type TranslationGroupListOptions = Partial<
  NonNullable<paths["/v1/groups"]["get"]["parameters"]["query"]>
>

export async function getTags() {
  return sharedGetTags<components["schemas"]["TagList"]>()
}

export async function getGroups({
  q,
  page = 1,
  limit = 20,
}: TranslationGroupListOptions = {}) {
  "use cache"
  cacheLife("seconds")
  const query = new URLSearchParams({ limit: String(limit) })
  if (q) query.set("q", q)
  if (page > 1) query.set("page", String(page))
  return request<components["schemas"]["TranslationGroupList"]>(
    `/v1/groups?${query}`
  )
}

export async function getGroup(id: string) {
  "use cache"
  cacheLife("seconds")
  return sharedGetGroup<components["schemas"]["TranslationGroupDetail"]>(id)
}

export async function getTag(id: string) {
  return sharedGetTag<TagSummary>(id)
}

export async function getPerson(id: string) {
  return sharedGetPerson<PersonDetail>(id)
}

export async function getMangaList(
  options: MangaListOptions = {}
): Promise<MangaList> {
  return sharedGetMangaList<MangaList>(options)
}

export async function getMangaRanking(options: MangaRankingOptions = {}) {
  return sharedGetMangaRanking<MangaRanking>(options)
}

export async function getGroupRanking(options: GroupRankingOptions = {}) {
  return sharedGetGroupRanking<GroupRanking>(options)
}

export async function getRecentComments() {
  return sharedGetRecentComments<components["schemas"]["RecentCommentList"]>()
}

export async function getRandomManga() {
  return sharedGetRandomManga<components["schemas"]["RandomManga"]>()
}

export async function getManga(id: string) {
  return sharedGetManga<MangaDetail>(id)
}

export async function getMangaRecommendations(id: string) {
  try {
    return await request<MangaRecommendations>(
      `/v1/manga/${encodeURIComponent(id)}/recommendations`
    )
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

export async function getMangaChapters(
  id: string,
  page = 1,
  direction: "asc" | "desc" = "desc"
) {
  return sharedGetMangaChapters<ChapterList>(id, page, direction)
}

export async function getChapter(id: string) {
  return sharedGetChapter<ChapterDetail>(id)
}
