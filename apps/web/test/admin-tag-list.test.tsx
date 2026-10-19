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
const {
  AdminTagList,
  adminTagsPath,
  adminTagsQueryKey,
  runSaveAdminTag,
  runTagVisibility,
} = await import("../modules/moderation/tag-list")
const client = new QueryClient()
const originalFetch = globalThis.fetch
const tag = {
  group: "genre" as const,
  id: "0199f711-739b-7000-8000-000000000001",
  mangaCount: 12,
  moderationHiddenAt: null,
  name: "Hành động",
  slug: "hanh-dong",
  version: 1,
}

try {
  client.setQueryData([...adminTagsQueryKey(apiBaseUrl, "admin"), "", "all"], {
    data: [
      tag,
      {
        ...tag,
        group: "theme",
        id: "0199f711-739b-7000-8000-000000000002",
        moderationHiddenAt: "2026-09-26T10:00:00Z",
        name: "Phiêu lưu",
        slug: "phieu-luu",
      },
    ],
  })
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <AdminTagList />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )

  assert.match(markup, /Hành động/)
  assert.match(markup, /Phiêu lưu/)
  assert.match(markup, /Thể loại/)
  assert.match(markup, /Chủ đề/)
  assert.match(markup, /Đã ẩn/)
  assert.match(markup, /12 truyện/)
  assert.match(markup, /aria-label="Hành động cho thể loại Hành động"/)
  assert.equal(
    adminTagsPath("phiêu lưu", "theme"),
    "/v1/admin/tags?q=phi%C3%AAu+l%C6%B0u&group=theme"
  )

  const requests: Array<{ body: unknown; method: string; url: string }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({
      body: JSON.parse(String(init?.body)),
      method: String(init?.method),
      url: String(input),
    })
    return Response.json({ data: tag })
  }
  await runSaveAdminTag(
    apiBaseUrl,
    { group: "genre", name: " Hành   động ", slug: "" },
    null
  )
  assert.deepEqual(requests.at(-1), {
    body: { group: "genre", name: "Hành động" },
    method: "POST",
    url: `${apiBaseUrl}/v1/admin/tags`,
  })

  await runSaveAdminTag(
    apiBaseUrl,
    { group: "theme", name: "Hành động mới", slug: "hanh-dong-moi" },
    tag
  )
  assert.deepEqual(requests.at(-1), {
    body: {
      expectedVersion: 1,
      group: "theme",
      name: "Hành động mới",
      slug: "hanh-dong-moi",
    },
    method: "PUT",
    url: `${apiBaseUrl}/v1/admin/tags/${tag.id}`,
  })

  await runTagVisibility(apiBaseUrl, tag)
  assert.deepEqual(requests.at(-1), {
    body: { expectedVersion: 1, hidden: true },
    method: "PUT",
    url: `${apiBaseUrl}/v1/admin/tags/${tag.id}/visibility`,
  })
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}

console.log("Admin tag list checks passed")
