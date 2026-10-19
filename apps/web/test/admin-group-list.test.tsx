import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"

import type { components } from "../src/lib/generated/api"

const apiBaseUrl = "https://api.example.test"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
const { AdminGroups, adminGroupsPath } = await import("../modules/groups/admin")
const client = new QueryClient()
const group: components["schemas"]["AdminGroupManagement"] = {
  approvalStatus: "approved",
  avatarUrl: null,
  bannerUrl: null,
  createdAt: "2026-09-25T10:00:00Z",
  creator: null,
  description: "Nhóm dịch thử nghiệm",
  id: "0199f711-739b-7000-8000-000000000001",
  inactive: false,
  links: {},
  name: "BFang Team",
  publicationState: "published",
  slug: "bfang-team",
  updatedAt: "2026-09-25T10:00:00Z",
}
const key = (status: string, query: string, page: number) => [
  "account",
  apiBaseUrl,
  "admin",
  "admin-groups",
  status,
  query,
  page,
]
const renderList = (searchParams = "", queryClient = client) =>
  renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <NuqsTestingAdapter searchParams={searchParams}>
        <AdminGroups />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )

try {
  client.setQueryData(key("all", "", 1), {
    data: [group],
    meta: { page: 1, limit: 20, hasMore: true },
  })
  const markup = renderList()
  assert.match(markup, /BFang Team/)
  assert.match(markup, /Quản lý|Hành động/)
  assert.match(markup, /Tạo nhóm dịch/)
  assert.match(markup, /aria-label="Trang sau"/)
  assert.doesNotMatch(markup, /Xóa bộ lọc/)

  client.setQueryData(key("approved", "BFang Team", 3), {
    data: [group],
    meta: { page: 3, limit: 20, hasMore: true },
  })
  const restored = renderList("?q=++BFang+++Team++&status=approved&page=3")
  assert.match(restored, /BFang Team/)
  assert.match(restored, /value="BFang Team"/)
  assert.match(restored, /Đã duyệt/)
  assert.match(restored, />3<\/span>/)
  assert.match(restored, /Xóa bộ lọc/)
  assert.equal(
    adminGroupsPath("approved", 3, " BFang Team "),
    "/v1/admin/groups?status=approved&q=BFang+Team&page=3&limit=20"
  )

  for (const page of ["0", "-3", "invalid", "9007199254740992"]) {
    const fallback = renderList(`?status=invalid&page=${page}`)
    assert.match(fallback, /BFang Team/)
    assert.doesNotMatch(fallback, /Xóa bộ lọc/)
    assert.match(fallback, />1<\/span>/)
  }

  client.setQueryData(key("rejected", "Không có", 1), {
    data: [],
    meta: { page: 1, limit: 20, hasMore: false },
  })
  assert.match(
    renderList("?q=Không+có&status=rejected"),
    /Không tìm thấy nhóm dịch phù hợp/
  )

  // A fresh render restores URL state; going back to defaults restores the default list.
  assert.match(renderList("?q=BFang+Team&status=approved&page=3"), /BFang Team/)
  assert.doesNotMatch(renderList(), /Xóa bộ lọc/)

  const loadingClient = new QueryClient()
  assert.match(renderList("", loadingClient), /Đang tải danh sách nhóm dịch/)
  loadingClient.clear()
} finally {
  client.clear()
  mock.restore()
}

console.log("Admin group URL state checks passed")
