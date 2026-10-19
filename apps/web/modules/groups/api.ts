import { queryOptions } from "@tanstack/react-query"

import type { components } from "@/src/lib/generated/api"

export function groupDirectoryOptions(
  apiBaseUrl: string,
  q: string,
  page: number
) {
  return queryOptions({
    queryKey: ["groups", "directory", apiBaseUrl, q, page, 36],
    staleTime: 60_000,
    retry: false,
    queryFn: async ({
      signal,
    }): Promise<components["schemas"]["TranslationGroupList"]> => {
      const url = new URL("/v1/groups", apiBaseUrl)
      url.search = new URLSearchParams({
        ...(q ? { q } : {}),
        page: String(page),
        limit: "36",
      }).toString()
      const response = await fetch(url, {
        credentials: "omit",
        headers: { accept: "application/json" },
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      })
      if (!response.ok) throw new Error("Không thể tải danh sách nhóm dịch.")
      return response.json()
    },
  })
}
