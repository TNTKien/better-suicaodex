import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"

const apiBaseUrl = "https://api.example.test"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
const { AdminAuditList, adminAuditPath } =
  await import("../modules/moderation/audit")
const filters = {
  targetKind: "all" as const,
  targetId: "",
  actorUserId: "",
  action: "",
  from: "",
  to: "",
}
const key = ["account", apiBaseUrl, "admin", "admin-audit", filters]
const entry = {
  id: "0199f711-739b-7000-8000-000000000001",
  actor: { id: "admin", name: "Quản trị viên", image: null },
  actorUserId: "admin",
  action: "moderation.manga.hidden",
  targetKind: "manga" as const,
  targetId: "0199f711-739b-7000-8000-000000000010",
  reason: "Vi phạm nội quy",
  before: { moderationHiddenAt: null },
  after: { moderationHiddenAt: "2026-09-26T10:00:00.000Z" },
  createdAt: "2026-09-26T10:00:00.000Z",
}

function renderList(client: QueryClient) {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <AdminAuditList />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )
}

try {
  const client = new QueryClient()
  client.setQueryData(key, {
    pages: [
      {
        data: [
          entry,
          {
            ...entry,
            id: "0199f711-739b-7000-8000-000000000002",
            actor: null,
            actorUserId: null,
            action: "system.tag.imported",
            targetKind: "tag" as const,
            reason: "System import",
          },
        ],
        meta: { limit: 20, nextCursor: null },
      },
    ],
    pageParams: [null],
  })
  const markup = renderList(client)
  assert.match(markup, /moderation\.manga\.hidden/)
  assert.match(markup, /Vi phạm nội quy/)
  assert.match(markup, /Quản trị viên/)
  assert.match(markup, /Hệ thống hoặc tài khoản không còn tồn tại/)
  assert.match(markup, />Truyện</)
  assert.match(markup, />Thể loại</)
  assert.match(markup, />Chi tiết</)
  client.clear()

  assert.equal(
    adminAuditPath({
      targetKind: "chapter",
      targetId: " chapter-id ",
      actorUserId: " actor-id ",
      action: " moderation.chapter.hidden ",
      from: "2026-09-01",
      to: "2026-09-26",
    }),
    "/v1/admin/audit?limit=20&targetKind=chapter&targetId=chapter-id&actorUserId=actor-id&action=moderation.chapter.hidden&from=2026-09-01T00%3A00%3A00.000%2B07%3A00&to=2026-09-26T23%3A59%3A59.999%2B07%3A00"
  )

  const loadingClient = new QueryClient()
  assert.match(renderList(loadingClient), /Đang tải nhật ký quản trị/)
  loadingClient.clear()

  const emptyClient = new QueryClient()
  emptyClient.setQueryData(key, {
    pages: [{ data: [], meta: { limit: 20, nextCursor: null } }],
    pageParams: [null],
  })
  assert.match(renderList(emptyClient), /Không có bản ghi phù hợp/)
  emptyClient.clear()
} finally {
  mock.restore()
}

console.log("Admin audit list rendering checks passed")
