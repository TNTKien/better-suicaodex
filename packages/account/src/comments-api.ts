import { infiniteQueryOptions } from "@tanstack/react-query"

export type CommentScope = "manga" | "chapter"

export class CommentApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function commentRequest<T>(
  apiBaseUrl: string,
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal
) {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  const body = (await response.json().catch(() => null)) as
    T | { error?: { message?: string } } | null
  if (!response.ok)
    throw new CommentApiError(
      response.status,
      (typeof body === "object" &&
        body &&
        "error" in body &&
        body.error?.message) ||
        "Không thể kết nối tới máy chủ"
    )
  return body as T
}

export const commentKey = (
  apiBaseUrl: string,
  scope: CommentScope,
  targetId: string
) => ["comments", apiBaseUrl, scope, targetId] as const

export function commentOptions<T>(
  apiBaseUrl: string,
  scope: CommentScope,
  targetId: string
) {
  return infiniteQueryOptions({
    queryKey: commentKey(apiBaseUrl, scope, targetId),
    initialPageParam: null as string | null,
    staleTime: 30_000,
    retry: false,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ limit: "10" })
      if (pageParam) query.set("cursor", pageParam)
      return commentRequest<{ data: T[]; meta: { nextCursor: string | null } }>(
        apiBaseUrl,
        `/v1/${scope === "manga" ? "manga" : "chapters"}/${encodeURIComponent(targetId)}/comments?${query}`,
        {},
        signal
      )
    },
    getNextPageParam: ({ meta }) => meta.nextCursor ?? undefined,
  })
}

export function createComment<T>(
  apiBaseUrl: string,
  scope: CommentScope,
  targetId: string,
  body: string,
  parentId?: string
) {
  return commentRequest<T>(
    apiBaseUrl,
    `/v1/${scope === "manga" ? "manga" : "chapters"}/${encodeURIComponent(targetId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentId }),
    }
  )
}

export function updateComment<T>(
  apiBaseUrl: string,
  id: string,
  body: string,
  expectedVersion: number
) {
  return commentRequest<T>(
    apiBaseUrl,
    `/v1/comments/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, expectedVersion }),
    }
  )
}

export function deleteComment<T>(
  apiBaseUrl: string,
  id: string,
  expectedVersion: number
) {
  return commentRequest<T>(
    apiBaseUrl,
    `/v1/comments/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion }),
    }
  )
}
