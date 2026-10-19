import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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
  AdminMangaList,
  adminMangaQueryKey,
  canSubmitAdminMangaAction,
  invalidateAdminMangaQueries,
  runAdminMangaAction,
} = await import("../modules/moderation/manga-list")
const client = new QueryClient()
const originalFetch = globalThis.fetch
const source = readFileSync(
  new URL("../modules/moderation/manga-list.tsx", import.meta.url),
  "utf8"
)
const queryKey = adminMangaQueryKey(apiBaseUrl, "admin")
const key = [...queryKey, 1, "", "all", "all"]
const visibleManga = {
  id: "manga-visible",
  slug: "truyen-cong-khai",
  title: "Truyện công khai",
  publicationState: "published",
  moderationHiddenAt: null,
  moderationReason: null,
  version: 1,
  updatedAt: "2026-09-22T10:00:00Z",
}

try {
  client.setQueryData(key, {
    data: [
      visibleManga,
      {
        id: "manga-hidden",
        slug: "truyen-bi-an",
        title: "Truyện bị ẩn",
        publicationState: "hidden",
        moderationHiddenAt: "2026-09-22T11:00:00Z",
        moderationReason: "Vi phạm nội quy",
        version: 2,
        updatedAt: "2026-09-22T11:00:00Z",
      },
    ],
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
  })
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <AdminMangaList />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )

  assert.match(markup, /Truyện công khai/)
  assert.match(markup, /Truyện bị ẩn/)
  assert.match(markup, /Bị quản trị viên ẩn/)
  assert.match(markup, /Vi phạm nội quy/)
  assert.match(markup, /aria-label="Hành động cho truyện Truyện công khai"/)
  assert.match(markup, /2 truyện/)
  assert.match(source, /\/admin\/manga\/\$\{manga\.id\}\/edit/)
  assert.match(source, />\s*Chỉnh sửa\s*</)

  const target = {
    action: "visibility" as const,
    manga: visibleManga as unknown as Parameters<
      typeof runAdminMangaAction
    >[1]["manga"],
  }
  assert.equal(canSubmitAdminMangaAction(null, false, "Lý do"), false)
  assert.equal(canSubmitAdminMangaAction(target, false, ""), false)
  assert.equal(canSubmitAdminMangaAction(target, true, "Lý do"), false)
  assert.equal(canSubmitAdminMangaAction(target, false, "Lý do"), true)

  let actionRequest: { body: unknown; method: string; url: string } | undefined
  globalThis.fetch = async (input, init) => {
    actionRequest = {
      body: JSON.parse(String(init?.body)),
      method: String(init?.method),
      url: String(input),
    }
    return Response.json({ data: { version: 2 } })
  }
  await runAdminMangaAction(apiBaseUrl, { ...target, reason: "Lý do" })
  assert.deepEqual(actionRequest, {
    body: { expectedVersion: 1, hidden: true, reason: "Lý do" },
    method: "PUT",
    url: `${apiBaseUrl}/v1/admin/manga/manga-visible/visibility`,
  })

  assert.equal(client.getQueryState(key)?.isInvalidated, false)
  await invalidateAdminMangaQueries(client, apiBaseUrl, "admin")
  assert.equal(client.getQueryState(key)?.isInvalidated, true)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}

console.log("Admin manga list rendering checks passed")
