import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
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
  animated: true,
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
const { AdminAccountList, adminUsersPath } =
  await import("../modules/moderation/account-list")
const { adminUsersQueryKey } =
  await import("../modules/moderation/account-moderation")
const client = new QueryClient()
const key = [...adminUsersQueryKey(apiBaseUrl, "admin"), 1, "", "all"]
const renderList = (queryClient: QueryClient) =>
  renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter>
        <AdminAccountList />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )

try {
  client.setQueryData(key, {
    data: [
      {
        createdAt: "2026-09-25T10:00:00Z",
        email: "active@example.com",
        emailVerified: true,
        id: "user-active",
        image: null,
        isAdmin: true,
        moderatedAt: null,
        name: "Quản trị viên",
        avatarFrame: frame,
        status: "active",
        updatedAt: "2026-09-25T10:00:00Z",
        version: 1,
      },
      {
        createdAt: "2026-09-24T10:00:00Z",
        email: "suspended@example.com",
        emailVerified: false,
        id: "user-suspended",
        image: null,
        isAdmin: false,
        moderatedAt: "2026-09-26T10:00:00Z",
        name: "Người bị hạn chế",
        status: "suspended",
        updatedAt: "2026-09-26T10:00:00Z",
        version: 2,
      },
      {
        createdAt: "2026-09-23T10:00:00Z",
        email: "banned@example.com",
        emailVerified: true,
        id: "user-banned",
        image: null,
        isAdmin: false,
        moderatedAt: "2026-09-26T11:00:00Z",
        name: "Người đã ban",
        status: "banned",
        updatedAt: "2026-09-26T11:00:00Z",
        version: 3,
      },
    ],
    meta: { page: 1, limit: 20, total: 900, totalPages: 45 },
  })
  const markup = renderList(client)
  assert.match(markup, /data-slot="avatar"[^>]*size-11 overflow-hidden/)
  assert.match(markup, /src="https:\/\/cdn.example.test\/frame.webp"/)
  assert.match(markup, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(markup, /data-slot="avatar(?:-fallback)?"[^>]*rounded-md/)

  assert.match(markup, /Quản trị viên/)
  assert.match(markup, /Hoạt động/)
  assert.match(markup, /Tạm hạn chế/)
  assert.match(markup, /Đã ban/)
  assert.match(markup, />Admin</)
  assert.match(markup, /href="\/admin\/user\/user-active"/)
  assert.match(markup, />Hạn chế</)
  assert.match(markup, />Ban</)
  assert.match(markup, />Khôi phục</)
  assert.match(markup, />Gỡ ban</)
  assert.match(markup, />1\/45</)
  assert.match(markup, /aria-label="Trang trước"/)
  assert.match(markup, /aria-label="Trang sau"/)
  assert.match(markup, /900 người dùng/)
  assert.equal(
    adminUsersPath(2, " user@example.com ", "suspended"),
    "/v1/admin/users?page=2&limit=20&q=user%40example.com&status=suspended"
  )

  const loadingClient = new QueryClient()
  assert.match(renderList(loadingClient), /Đang tải danh sách người dùng/)
  loadingClient.clear()

  const emptyClient = new QueryClient()
  emptyClient.setQueryData(key, {
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  })
  assert.match(renderList(emptyClient), /Chưa có người dùng/)
  emptyClient.clear()

  const errorClient = new QueryClient({
    defaultOptions: {
      queries: { refetchOnMount: false, retry: false, retryOnMount: false },
    },
  })
  await assert.rejects(
    errorClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        throw new Error("Không tải được danh sách thử nghiệm")
      },
    })
  )
  const errorMarkup = renderList(errorClient)
  assert.match(errorMarkup, /Không tải được danh sách thử nghiệm/)
  assert.match(errorMarkup, />Thử lại</)
  errorClient.clear()
} finally {
  client.clear()
  mock.restore()
}

console.log("Admin user list rendering checks passed")
