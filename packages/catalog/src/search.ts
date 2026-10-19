"use client"

import { useState, type KeyboardEvent } from "react"
import { useDebouncedValue } from "@mantine/hooks"
import { queryOptions, useQuery } from "@tanstack/react-query"

type SearchList = { data: unknown[]; meta: { total: number } }
type ApiError = { error: { code: string } }

export function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLowerCase()
}

export class MangaSearchError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(
      status === 429
        ? "Bạn tìm quá nhanh. Vui lòng đợi một chút rồi thử lại."
        : "Có lỗi xảy ra, vui lòng thử lại sau."
    )
  }
}

export function mangaSearchOptions<T extends SearchList>(
  apiBaseUrl: string,
  query: string
) {
  const q = normalizeSearchQuery(query)
  return queryOptions({
    queryKey: ["manga", "quick-search", apiBaseUrl, q],
    enabled: q.length > 0 && q.length <= 160,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }): Promise<T> => {
      const url = new URL("/v1/manga", apiBaseUrl)
      url.search = new URLSearchParams({ q, limit: "5" }).toString()
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        credentials: "omit",
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      })
      const body = (await response.json().catch(() => null)) as
        T | ApiError | null

      if (!response.ok) {
        throw new MangaSearchError(
          response.status,
          body && typeof body === "object" && "error" in body
            ? body.error.code
            : "UPSTREAM_ERROR"
        )
      }
      if (
        !body ||
        typeof body !== "object" ||
        !("data" in body) ||
        !Array.isArray(body.data) ||
        !body.meta ||
        typeof body.meta.total !== "number"
      ) {
        throw new MangaSearchError(502, "INVALID_RESPONSE")
      }
      return body
    },
  })
}

export function useMangaQuickSearch<T extends SearchList>(
  apiBaseUrl: string,
  open: boolean
) {
  const [query, setQuery] = useState("")
  const [composing, setComposing] = useState(false)
  const searchQuery = normalizeSearchQuery(query)
  const activeQuery = open && !composing ? searchQuery : ""
  const [debouncedQuery] = useDebouncedValue(activeQuery, 300)

  // Change the key immediately to abort stale requests during the debounce too.
  const options = mangaSearchOptions<T>(apiBaseUrl, activeQuery)
  const search = useQuery({
    ...options,
    enabled: options.enabled && activeQuery === debouncedQuery,
  })
  const loading =
    open &&
    Boolean(searchQuery) &&
    (composing || search.isPending || search.isFetching)
  return { query, setQuery, setComposing, searchQuery, search, loading }
}

export function handleSearchKeys(event: KeyboardEvent<HTMLElement>) {
  if (event.nativeEvent.isComposing) return
  const input = event.currentTarget.querySelector<HTMLInputElement>("input")
  const links = Array.from(
    event.currentTarget.querySelectorAll<HTMLAnchorElement>(
      "a[data-search-result]"
    )
  )
  const target = event.target
  if (event.key === "Escape" && target instanceof HTMLElement) target.blur()
  if (event.key === "Enter" && target === input && links[0]) {
    event.preventDefault()
    links[0].click()
    input?.blur()
  }
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
  const index = links.findIndex((link) => link === target)
  if (target !== input && index === -1) return
  event.preventDefault()
  if (event.key === "ArrowUp") {
    if (index <= 0) input?.focus()
    else links[index - 1]?.focus()
  } else {
    links[Math.min(index + 1, links.length - 1)]?.focus()
  }
}
