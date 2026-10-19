import { queryOptions } from "@tanstack/react-query"

export type AccountIdentity = { userId: string; sessionId: string }

export class AccountApiError extends Error {
  constructor(
    readonly status: number,
    message?: string
  ) {
    super(
      message ??
        (status === 401
          ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          : "Không thể tải thông tin tài khoản. Vui lòng thử lại.")
    )
  }
}

export async function accountRequest<T>(
  apiBaseUrl: string,
  path: string,
  credentials: RequestCredentials,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    credentials,
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8_000)])
      : AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new AccountApiError(response.status)
  return response.json()
}

export async function getPublicProfile<T>(apiBaseUrl: string, id: string) {
  try {
    return await accountRequest<T>(
      apiBaseUrl,
      `/v1/profiles/${encodeURIComponent(id)}`,
      "omit"
    )
  } catch (error) {
    // Private, restricted and missing profiles have the same public result.
    if (error instanceof AccountApiError && [400, 404].includes(error.status))
      return null
    throw error
  }
}

export function currentAccountOptions<T extends { user: { id: string } }>(
  apiBaseUrl: string,
  identity: AccountIdentity | null
) {
  return queryOptions({
    queryKey: [
      "account",
      apiBaseUrl,
      identity?.userId,
      identity?.sessionId,
      "me",
    ],
    enabled: identity !== null,
    gcTime: 0,
    staleTime: 5 * 60 * 1_000,
    retry: false,
    networkMode: "always",
    queryFn: async ({ signal }) => {
      const account = await accountRequest<T>(
        apiBaseUrl,
        "/v1/me",
        "include",
        signal
      )
      // A different tab can switch accounts while this request is in flight.
      if (!identity || account.user?.id !== identity.userId)
        throw new AccountApiError(401)
      return account
    },
  })
}

export function safeReturnTo(value: string | null | undefined) {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    // Reject URL parser whitespace/control normalization and backslash host tricks.
    // eslint-disable-next-line no-control-regex
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return "/"
  try {
    const url = new URL(value, "https://return.invalid")
    const path = decodeURIComponent(url.pathname)
    if (
      url.origin !== "https://return.invalid" ||
      path.startsWith("//") ||
      path.includes("\\") ||
      /^\/(login|api\/auth)(\/|$)/.test(path)
    )
      return "/"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/"
  }
}

export function loginHref(returnTo: string) {
  return `/login?${new URLSearchParams({ returnTo: safeReturnTo(returnTo) })}`
}
