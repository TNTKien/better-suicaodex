import type { components, paths } from "@/src/lib/generated/api"

export type AdminUserDetail =
  paths["/v1/admin/users/{id}"]["get"]["responses"][200]["content"]["application/json"]["data"]
export type AccountStatus = AdminUserDetail["status"]
type ApiError = components["schemas"]["ApiError"]
type StatusTarget = Pick<AdminUserDetail, "id" | "version">

export const accountStatusLabels: Record<AccountStatus, string> = {
  active: "Hoạt động",
  suspended: "Tạm hạn chế",
  banned: "Đã ban",
}

export class AdminAccountError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export async function adminAccountRequest<T>(
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
  const body = (await response.json().catch(() => null)) as T | ApiError | null
  if (!response.ok) {
    const apiError =
      body && typeof body === "object" && "error" in body ? body.error : null
    throw new AdminAccountError(
      apiError?.code ?? "UPSTREAM_ERROR",
      apiError?.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại."
    )
  }
  return body as T
}

export function adminUsersQueryKey(
  apiBaseUrl: string,
  userId: string | undefined
) {
  return ["account", apiBaseUrl, userId, "admin-users"] as const
}

export function adminUserQueryKey(
  apiBaseUrl: string,
  actorUserId: string | undefined,
  targetUserId: string
) {
  return [
    "account",
    apiBaseUrl,
    actorUserId,
    "admin-user",
    targetUserId,
  ] as const
}

export function runAdminAccountStatusAction(
  apiBaseUrl: string,
  user: StatusTarget,
  status: AccountStatus
) {
  return adminAccountRequest<{ data: AdminUserDetail }>(
    apiBaseUrl,
    `/v1/admin/users/${encodeURIComponent(user.id)}/status`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: user.version, status }),
    }
  )
}

export function accountActionLabel(
  current: AccountStatus,
  target: AccountStatus
) {
  if (target === "suspended") return "Tạm hạn chế"
  if (target === "banned") return "Ban tài khoản"
  return current === "banned" ? "Gỡ ban" : "Khôi phục"
}

export function accountActionDescription(
  current: AccountStatus,
  target: AccountStatus
) {
  if (target === "suspended")
    return "Phiên đăng nhập hiện tại sẽ bị thu hồi. Người dùng có thể đăng nhập lại để xem dữ liệu riêng, nhưng không thể tạo hoặc chỉnh sửa nội dung cho đến khi được khôi phục. Nội dung cũ không bị ẩn."
  if (target === "banned")
    return "Phiên đăng nhập hiện tại sẽ bị thu hồi và người dùng không thể đăng nhập cho đến khi được gỡ ban. Ban không có thời hạn. Nội dung cũ không bị ẩn."
  return current === "banned"
    ? "Người dùng sẽ có thể đăng nhập và sử dụng tài khoản trở lại."
    : "Người dùng sẽ được phép đóng góp và chỉnh sửa nội dung trở lại."
}

export function accountActionErrorMessage(error: unknown) {
  if (!(error instanceof AdminAccountError))
    return "Không thể cập nhật tài khoản. Vui lòng thử lại."
  if (error.code === "VERSION_CONFLICT")
    return "Tài khoản vừa thay đổi. Dữ liệu đã được làm mới, hãy kiểm tra và xác nhận lại."
  if (error.code === "SELF_RESTRICTION")
    return "Bạn không thể tự hạn chế hoặc ban tài khoản của mình."
  if (error.code === "LAST_ACTIVE_ADMIN")
    return "Không thể hạn chế quản trị viên đang hoạt động cuối cùng."
  if (error.code === "STATE_UNCHANGED")
    return "Tài khoản đã ở trạng thái này. Dữ liệu đang được làm mới."
  return error.message
}
