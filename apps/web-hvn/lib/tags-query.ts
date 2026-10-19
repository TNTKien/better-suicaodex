import { queryOptions } from "@tanstack/react-query"

import { tagListSchema, type TagList } from "./tags"
import { getApiBaseUrl } from "./api-url"

export const tagsQueryOptions = queryOptions({
  queryKey: ["catalog", "tags"],
  queryFn: async ({ signal }): Promise<TagList["data"]> => {
    const url = new URL("/v1/tags", getApiBaseUrl())
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
    })
    if (!response.ok) throw new Error("Không tải được danh sách thể loại.")
    return tagListSchema.parse(await response.json()).data
  },
  staleTime: 10 * 60 * 1000,
  retry: 1,
})
