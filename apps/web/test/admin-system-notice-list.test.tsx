import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"

const apiBaseUrl = "https://api.example.test"
const notice = {
  id: "0199f711-739b-7000-8000-000000000001",
  title: "Bảo trì hệ thống",
  content: "Hệ thống sẽ bảo trì vào **22:00**.",
  createdAt: "2026-09-28T10:00:00.000Z",
  updatedAt: "2026-09-28T10:30:00.000Z",
}

mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
mock.module("@workspace/ui/components/toast", () => ({
  toast: { add: () => undefined },
}))

const {
  AdminSystemNoticeList,
  adminSystemNoticesPath,
  adminSystemNoticesQueryKey,
  runDeleteSystemNotice,
  runSaveSystemNotice,
} = await import("../modules/moderation/system-notice-list")
const client = new QueryClient()
const originalFetch = globalThis.fetch

try {
  client.setQueryData(
    [...adminSystemNoticesQueryKey(apiBaseUrl, "admin"), 1, "", 20],
    {
      data: [notice],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }
  )
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <AdminSystemNoticeList />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )
  assert.match(markup, /Bảo trì hệ thống/)
  assert.match(markup, /1 thông báo/)
  assert.match(markup, /aria-label="Sửa thông báo Bảo trì hệ thống"/)
  assert.match(markup, /aria-label="Xóa thông báo Bảo trì hệ thống"/)
  assert.equal(
    adminSystemNoticesPath(2, " bảo trì ", 50),
    "/v1/admin/system-notices?page=2&limit=50&q=b%E1%BA%A3o+tr%C3%AC"
  )

  const requests: Array<{ body: unknown; method: string; url: string }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({
      body: init?.body ? JSON.parse(String(init.body)) : null,
      method: String(init?.method),
      url: String(input),
    })
    return Response.json({ data: notice })
  }
  await runSaveSystemNotice(
    apiBaseUrl,
    { title: " Bảo trì ", content: " Nội dung " },
    null
  )
  assert.deepEqual(requests.at(-1), {
    body: { title: "Bảo trì", content: "Nội dung" },
    method: "POST",
    url: `${apiBaseUrl}/v1/admin/system-notices`,
  })
  await runSaveSystemNotice(
    apiBaseUrl,
    { title: "Bảo trì mới", content: "Nội dung mới" },
    notice
  )
  assert.equal(requests.at(-1)?.method, "PUT")
  assert.equal(
    requests.at(-1)?.url,
    `${apiBaseUrl}/v1/admin/system-notices/${notice.id}`
  )
  await runDeleteSystemNotice(apiBaseUrl, notice.id)
  assert.deepEqual(requests.at(-1), {
    body: null,
    method: "DELETE",
    url: `${apiBaseUrl}/v1/admin/system-notices/${notice.id}`,
  })
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}

console.log("Admin system notice list checks passed")
