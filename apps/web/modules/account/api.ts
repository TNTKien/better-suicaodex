import { queryOptions } from "@tanstack/react-query"

import {
  AccountApiError,
  accountRequest,
  currentAccountOptions as sharedCurrentAccountOptions,
  type AccountIdentity,
} from "@workspace/account/api"

export {
  AccountApiError,
  accountRequest,
  loginHref,
  safeReturnTo,
} from "@workspace/account/api"

import type { components } from "@/src/lib/generated/api"

export type CurrentAccount = components["schemas"]["CurrentAccount"]
export type PublicProfile = components["schemas"]["PublicProfile"]
export type UpdateProfile = components["schemas"]["UpdateProfile"]

const mutationFallback: Record<number, string> = {
  400: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Tài khoản không được phép thực hiện thao tác này.",
  413: "Ảnh vượt quá dung lượng tối đa 5 MiB.",
  429: "Máy chủ đang xử lý nhiều ảnh. Vui lòng thử lại sau.",
  503: "Chưa thể lưu ảnh. Vui lòng thử lại sau.",
}

async function accountMutation(
  apiBaseUrl: string,
  path: string,
  init: RequestInit,
  timeout = 8_000
): Promise<CurrentAccount> {
  const response = await fetch(new URL(path, apiBaseUrl), {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(timeout),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok)
    throw new AccountApiError(
      response.status,
      mutationFallback[response.status] ??
        "Không thể cập nhật tài khoản. Vui lòng thử lại."
    )
  return body as CurrentAccount
}

export function updateOwnProfile(apiBaseUrl: string, profile: UpdateProfile) {
  return accountMutation(apiBaseUrl, "/v1/me/profile", {
    method: "PATCH",
    body: JSON.stringify(profile),
    headers: { "Content-Type": "application/json" },
  })
}

export function replaceOwnAvatar(apiBaseUrl: string, avatar: File) {
  const body = new FormData()
  body.set("avatar", avatar)
  return accountMutation(
    apiBaseUrl,
    "/v1/me/avatar",
    { method: "POST", body },
    30_000
  )
}

export function removeOwnAvatar(apiBaseUrl: string) {
  return accountMutation(apiBaseUrl, "/v1/me/avatar", { method: "DELETE" })
}

export function currentAccountOptions(
  apiBaseUrl: string,
  identity: AccountIdentity | null
) {
  return sharedCurrentAccountOptions<CurrentAccount>(apiBaseUrl, identity)
}

export function administratorAccessOptions(
  apiBaseUrl: string,
  userId: string | null
) {
  return queryOptions({
    queryKey: ["account", apiBaseUrl, userId, "administrator"],
    enabled: userId !== null,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    networkMode: "always",
    queryFn: ({ signal }) =>
      accountRequest<{ data: unknown[] }>(
        apiBaseUrl,
        "/v1/admin/groups?status=pending&page=1&limit=1",
        "include",
        signal
      ),
  })
}
