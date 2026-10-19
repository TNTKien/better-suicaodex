import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import {
  createParser,
  createSerializer,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server"

import type { components } from "@/src/lib/generated/api"

const statuses = ["", "ongoing", "completed", "hiatus", "cancelled"] as const
const chapterAvailability = ["true", "false"] as const
const sorts = ["latestChapter", "publishedAt", "title", "year"] as const
const directions = ["asc", "desc"] as const
const tagModes = ["and", "or"] as const

const positiveIntegerParser = createParser({
  parse(value) {
    const number = Number(value)
    return Number.isSafeInteger(number) && number > 0 ? number : null
  },
  serialize: String,
})

export const advancedSearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(statuses).withDefault(""),
  hasChapter: parseAsStringLiteral(chapterAvailability).withDefault("true"),
  includeTag: parseAsArrayOf(parseAsString).withDefault([]),
  excludeTag: parseAsArrayOf(parseAsString).withDefault([]),
  includeTagMode: parseAsStringLiteral(tagModes).withDefault("and"),
  excludeTagMode: parseAsStringLiteral(tagModes).withDefault("or"),
  author: parseAsArrayOf(parseAsString).withDefault([]),
  artist: parseAsArrayOf(parseAsString).withDefault([]),
  sort: parseAsStringLiteral(sorts).withDefault("latestChapter"),
  direction: parseAsStringLiteral(directions).withDefault("desc"),
  page: positiveIntegerParser.withDefault(1),
}

export type AdvancedSearchState = {
  [Key in keyof typeof advancedSearchParams]: ReturnType<
    (typeof advancedSearchParams)[Key]["parseServerSide"]
  >
}

export const defaultAdvancedSearchState: AdvancedSearchState = {
  q: "",
  status: "",
  hasChapter: "true",
  includeTag: [],
  excludeTag: [],
  includeTagMode: "and",
  excludeTagMode: "or",
  author: [],
  artist: [],
  sort: "latestChapter",
  direction: "desc",
  page: 1,
}

const serializeAdvancedSearch = createSerializer(advancedSearchParams)

const normalizeIds = (ids: string[]) => [...new Set(ids)].sort()

export function normalizeAdvancedSearch(
  value: AdvancedSearchState
): AdvancedSearchState {
  return {
    ...value,
    q: value.q.trim().replace(/\s+/g, " "),
    includeTag: normalizeIds(value.includeTag),
    excludeTag: normalizeIds(value.excludeTag),
    author: normalizeIds(value.author),
    artist: normalizeIds(value.artist),
  }
}

export function advancedSearchHref(
  value: AdvancedSearchState,
  page = value.page
) {
  return serializeAdvancedSearch("/advanced-search", { ...value, page })
}

function appendAll(query: URLSearchParams, key: string, values: string[]) {
  for (const value of values) query.append(key, value)
}

export function advancedSearchApiUrl(
  apiBaseUrl: string,
  value: AdvancedSearchState
) {
  const url = new URL("/v1/manga", apiBaseUrl)
  const query = new URLSearchParams({
    sort: value.sort,
    direction: value.direction,
    hasChapter: value.hasChapter,
    includeTagMode: value.includeTagMode,
    excludeTagMode: value.excludeTagMode,
    page: String(value.page),
    limit: "36",
  })
  if (value.q) query.set("q", value.q)
  if (value.status) query.set("status", value.status)
  appendAll(query, "includeTag", value.includeTag)
  appendAll(query, "excludeTag", value.excludeTag)
  appendAll(query, "author", value.author)
  appendAll(query, "artist", value.artist)
  url.search = query.toString()
  return url
}

export class AdvancedSearchError extends Error {
  constructor(readonly status: number) {
    super(
      status === 429
        ? "Bạn thao tác quá nhanh. Vui lòng đợi một chút rồi thử lại."
        : "Không thể tải kết quả tìm kiếm."
    )
  }
}

async function publicRequest<T>(url: URL, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    credentials: "omit",
    signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
  })
  if (!response.ok) throw new AdvancedSearchError(response.status)
  return (await response.json()) as T
}

export function advancedSearchOptions(
  apiBaseUrl: string,
  value: AdvancedSearchState
) {
  return queryOptions({
    queryKey: ["manga", "advanced-search", apiBaseUrl, value],
    queryFn: ({ signal }) =>
      publicRequest<components["schemas"]["MangaList"]>(
        advancedSearchApiUrl(apiBaseUrl, value),
        signal
      ),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}

export function peopleOptions(
  apiBaseUrl: string,
  role: "author" | "artist",
  query: string,
  ids: string[],
  enabled = true
) {
  return queryOptions({
    queryKey: ["people", apiBaseUrl, role, query, ...ids],
    enabled,
    queryFn: ({ signal }) => {
      const url = new URL("/v1/people", apiBaseUrl)
      url.searchParams.set("role", role)
      url.searchParams.set("limit", ids.length > 0 ? "50" : "10")
      if (query) url.searchParams.set("q", query)
      appendAll(url.searchParams, "id", ids)
      return publicRequest<components["schemas"]["PersonList"]>(url, signal)
    },
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
