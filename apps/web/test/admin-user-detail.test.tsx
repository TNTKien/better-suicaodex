import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import type { AvatarDecorationFrame } from "../modules/avatar-frames/avatar-decoration"

const apiBaseUrl = "https://api.example.test"
const frame: NonNullable<AvatarDecorationFrame> = {
  displayScale: 125,
  offsetX: 0,
  offsetY: 0,
  id: "0199f711-739b-7000-8000-000000000001",
  name: "Khung",
  assetUrl: "https://cdn.example.test/frame.webp",
  previewUrl: "https://cdn.example.test/frame-preview.webp",
  animated: false,
  width: 318,
  height: 318,
}
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
const { AdminAccountDetail } =
  await import("../modules/moderation/account-detail")
const {
  AdminAccountError,
  accountActionErrorMessage,
  adminUserQueryKey,
  runAdminAccountStatusAction,
} = await import("../modules/moderation/account-moderation")
const client = new QueryClient()
const user = {
  bio: "Giới thiệu người dùng",
  createdAt: "2026-09-25T10:00:00Z",
  email: "user@example.com",
  emailVerified: true,
  id: "target-user",
  image: null,
  avatarFrame: frame,
  isAdmin: false,
  isPublic: true,
  linkedProviders: ["credential", "discord"],
  moderatedAt: "2026-09-26T10:00:00Z",
  moderatedByUserId: "admin",
  moderationReason: "account suspended",
  name: "Người dùng thử",
  status: "suspended" as const,
  updatedAt: "2026-09-26T10:00:00Z",
  version: 2,
}
const key = adminUserQueryKey(apiBaseUrl, "admin", user.id)
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36"
const originalFetch = globalThis.fetch

try {
  client.setQueryData(key, { data: user })
  client.setQueryData([...key, "sessions"], {
    data: [
      {
        id: "session-1",
        ipAddress: "203.0.113.10",
        userAgent,
        createdAt: "2026-09-26T09:00:00Z",
        expiresAt: "2026-10-03T09:00:00Z",
      },
    ],
  })
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AdminAccountDetail targetUserId={user.id} />
    </QueryClientProvider>
  )

  assert.match(markup, /Người dùng thử/)
  assert.match(markup, /data-slot="avatar"[^>]*size-14 overflow-hidden/)
  assert.match(markup, /src="https:\/\/cdn.example.test\/frame-preview.webp"/)
  assert.doesNotMatch(markup, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(markup, /data-slot="avatar(?:-fallback)?"[^>]*rounded-md/)
  assert.match(markup, /Tạm hạn chế/)
  assert.match(markup, /Giới thiệu người dùng/)
  assert.match(markup, /Email\/Mật khẩu/)
  assert.match(markup, /Discord/)
  assert.match(markup, /Phiên đăng nhập đang hoạt động/)
  assert.match(markup, /Chrome · Windows · Máy tính/)
  assert.match(markup, /203\.0\.113\.10/)
  assert.match(markup, /account suspended/)
  assert.match(
    markup,
    /href="\/admin\/audit\?targetKind=user&amp;targetId=target-user"/
  )
  assert.match(markup, />Khôi phục</)
  assert.match(markup, />Ban tài khoản</)
  assert.match(markup, /Khung Avatar/)
  assert.match(markup, /Kho khung/)
  assert.match(markup, /Thu gọn hoặc mở rộng Khung Avatar/)

  let actionRequest: { body: unknown; method: string; url: string } | undefined
  globalThis.fetch = async (input, init) => {
    actionRequest = {
      body: JSON.parse(String(init?.body)),
      method: String(init?.method),
      url: String(input),
    }
    return Response.json({ data: { ...user, status: "banned", version: 3 } })
  }
  await runAdminAccountStatusAction(apiBaseUrl, user, "banned")
  assert.deepEqual(actionRequest, {
    body: { expectedVersion: 2, status: "banned" },
    method: "PUT",
    url: `${apiBaseUrl}/v1/admin/users/target-user/status`,
  })
  assert.match(
    accountActionErrorMessage(
      new AdminAccountError("VERSION_CONFLICT", "stale")
    ),
    /Dữ liệu đã được làm mới/
  )
  assert.match(
    accountActionErrorMessage(
      new AdminAccountError("LAST_ACTIVE_ADMIN", "blocked")
    ),
    /quản trị viên đang hoạt động cuối cùng/
  )
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}

console.log("Admin user detail rendering checks passed")
