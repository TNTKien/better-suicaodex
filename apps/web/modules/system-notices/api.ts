import { infiniteQueryOptions } from "@tanstack/react-query"

import type { components, paths } from "@/src/lib/generated/api"

export type SystemNotice = components["schemas"]["SystemNotice"]
export type SystemNoticePage =
  paths["/v1/system-notices"]["get"]["responses"][200]["content"]["application/json"]

async function systemNoticeRequest<T>(
  apiBaseUrl: string,
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json" },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  if (!response.ok)
    throw new Error(`System notice API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export function systemNoticeOptions(apiBaseUrl: string) {
  return infiniteQueryOptions({
    queryKey: ["system-notices", apiBaseUrl],
    initialPageParam: null as string | null,
    staleTime: 60_000,
    retry: false,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ limit: "20" })
      if (pageParam) query.set("cursor", pageParam)
      return systemNoticeRequest<SystemNoticePage>(
        apiBaseUrl,
        `/v1/system-notices?${query}`,
        signal
      )
    },
    getNextPageParam: ({ meta }) => meta.nextCursor ?? undefined,
  })
}
