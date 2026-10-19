import "server-only"
import { isUuid } from "./routing"

const apiBaseUrl = new URL(process.env.API_URL ?? "http://localhost:3001")
if (!["http:", "https:"].includes(apiBaseUrl.protocol)) {
  throw new Error("API_URL must use http or https")
}
const internalApiKey = process.env.INTERNAL_API_KEY

export class CatalogApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`Catalog API request failed with ${status} ${code}`)
    this.name = "CatalogApiError"
  }
}

export async function catalogRequest<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    headers: {
      accept: "application/json",
      ...(internalApiKey
        ? { "X-Internal-API-Key": internalApiKey }
        : undefined),
    },
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  })
  const body = (await response.json().catch(() => null)) as
    { error: { code: string } } | T | null

  if (!response.ok) {
    const code =
      typeof body === "object" && body && "error" in body
        ? body.error.code
        : "UPSTREAM_ERROR"
    throw new CatalogApiError(response.status, code)
  }

  if (body === null) {
    throw new CatalogApiError(502, "INVALID_RESPONSE")
  }

  return body as T
}

export function isCatalogNotFound(error: unknown) {
  return error instanceof CatalogApiError && error.status === 404
}

type MangaListOptions = {
  sort?: string
  direction?: string
  limit?: number
  page?: number
  includeTag?: string[]
  author?: string[]
  artist?: string[]
  group?: string[]
  hasChapter?: string
  tagSlugs?: string[]
}
type MangaRankingOptions = { metric?: string; window?: string; limit?: number }

export function getTags<T = { data: { id: string; slug: string }[] }>() {
  return catalogRequest<T>("/v1/tags")
}

export async function getTag<T>(id: string) {
  try {
    return await catalogRequest<T>(`/v1/tags/${encodeURIComponent(id)}`)
  } catch (error) {
    if (isCatalogNotFound(error)) return null
    throw error
  }
}

export async function getPerson<T>(id: string) {
  try {
    return await catalogRequest<T>(`/v1/people/${encodeURIComponent(id)}`)
  } catch (error) {
    if (isCatalogNotFound(error)) return null
    throw error
  }
}

export async function getGroup<T>(id: string) {
  try {
    return await catalogRequest<T>(`/v1/groups/${encodeURIComponent(id)}`)
  } catch (error) {
    if (isCatalogNotFound(error)) return null
    throw error
  }
}

export async function getRoutePerson<T>(id: string) {
  const canonicalId = isUuid(id) ? id : null
  return canonicalId ? getPerson<T>(canonicalId) : null
}

export async function getManga<T>(id: string) {
  try {
    return await catalogRequest<T>(`/v1/manga/${encodeURIComponent(id)}`)
  } catch (error) {
    if (isCatalogNotFound(error)) return null
    throw error
  }
}

export async function getChapter<T>(id: string) {
  try {
    return await catalogRequest<T>(`/v1/chapters/${encodeURIComponent(id)}`)
  } catch (error) {
    if (isCatalogNotFound(error)) return null
    throw error
  }
}

export async function getMangaChapters<T>(
  id: string,
  page = 1,
  direction: "asc" | "desc" = "desc"
) {
  try {
    const query = new URLSearchParams({
      sort: "volume",
      direction,
      limit: "20",
      page: String(page),
    })
    return await catalogRequest<T>(
      `/v1/manga/${encodeURIComponent(id)}/chapters?${query}`
    )
  } catch (error) {
    if (isCatalogNotFound(error)) return null
    throw error
  }
}

export async function getMangaList<T>({
  sort = "latestChapter",
  direction = "desc",
  limit = 20,
  page = 1,
  includeTag = [],
  author = [],
  artist = [],
  group = [],
  hasChapter = "true",
  tagSlugs = [],
}: MangaListOptions = {}) {
  const query = new URLSearchParams({ sort, direction, limit: String(limit) })
  if (page > 1) query.set("page", String(page))
  for (const tagId of includeTag) query.append("includeTag", tagId)
  for (const personId of author) query.append("author", personId)
  for (const personId of artist) query.append("artist", personId)
  for (const groupId of group) query.append("group", groupId)
  if (hasChapter !== "true") query.set("hasChapter", hasChapter)
  if (tagSlugs.length > 0) {
    const { data: tags } = await getTags()
    for (const slug of tagSlugs) {
      const tag = tags.find((tag) => tag.slug === slug)
      // Missing taxonomy must not turn a filtered section into an unfiltered list.
      if (!tag) {
        return {
          data: [],
          meta: { page: 1, limit, total: 0, totalPages: 0 },
        }
      }
      query.append("includeTag", tag.id)
    }
  }
  return catalogRequest<T>(`/v1/manga?${query}`)
}

export async function getMangaRanking<T>({
  metric = "score",
  window = "day",
  limit = 5,
}: MangaRankingOptions = {}) {
  const query = new URLSearchParams({ metric, window, limit: String(limit) })
  return catalogRequest<T>(`/v1/rankings/manga?${query}`)
}

export async function getGroupRanking<T>({
  window = "day",
  limit = 10,
}: { window?: string; limit?: number } = {}) {
  const query = new URLSearchParams({ window, limit: String(limit) })
  return catalogRequest<T>(`/v1/rankings/groups?${query}`)
}

export async function getRecentComments<T>(limit = 10) {
  return catalogRequest<T>(`/v1/comments/recent?limit=${limit}`)
}

export async function getRandomManga<T>(limit = 1) {
  return catalogRequest<T>(`/v1/manga/random?limit=${limit}`)
}
