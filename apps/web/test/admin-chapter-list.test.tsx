import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"

const apiBaseUrl = "https://api.example.test"
const mangaId = "e9aa16d2-66de-4c1f-b85c-e48e4a1a92c2"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    user: { id: "admin" },
    status: "authenticated",
  }),
}))
const {
  AdminChapterList,
  adminChapterListPath,
  adminChapterQueryKey,
  canSubmitAdminChapterAction,
  invalidateAdminChapterQueries,
  runAdminChapterAction,
} = await import("../app/admin/(panel)/manga/[id]/chapter/chapter-list")
const client = new QueryClient()
const originalFetch = globalThis.fetch
const hiddenChapter = {
  id: "chapter-1",
  mangaId,
  volume: "1",
  number: "2",
  title: "Chương bị ẩn",
  publicationState: "published",
  moderationHiddenAt: "2026-09-23T10:00:00Z",
  moderationReason: "Vi phạm nội quy",
  processingState: "idle",
  failureReason: null,
  pageCount: 16,
  stagedPageCount: 0,
  availablePageCount: 16,
  isFull: true,
  version: 2,
  updatedAt: "2026-09-23T10:00:00Z",
}

try {
  assert.equal(
    adminChapterListPath(mangaId, 2, "volume", "asc", "draft", "hidden"),
    `/v1/admin/manga/${mangaId}/chapters?page=2&limit=20&sort=volume&direction=asc&publicationState=draft&moderation=hidden`
  )
  client.setQueryData(["manga-management", apiBaseUrl, "admin", mangaId], {
    data: {
      id: mangaId,
      title: "Truyện kiểm duyệt",
      alternativeTitles: {},
      cover: null,
      publicationState: "published",
      status: "ongoing",
      moderationHiddenAt: null,
      moderationReason: null,
      ownerGroup: {
        id: "3654281a-b35c-4e9d-8413-b40e944c9edd",
        name: "Nhóm kiểm duyệt",
        slug: "nhom-kiem-duyet",
      },
      groups: [
        {
          id: "3654281a-b35c-4e9d-8413-b40e944c9edd",
          name: "Nhóm kiểm duyệt",
          slug: "nhom-kiem-duyet",
        },
      ],
    },
  })
  client.setQueryData(
    [
      "admin-chapters",
      apiBaseUrl,
      mangaId,
      1,
      "updatedAt",
      "desc",
      "all",
      "all",
    ],
    {
      data: [
        hiddenChapter,
        {
          id: "chapter-2",
          mangaId,
          volume: null,
          number: null,
          title: null,
          publicationState: "draft",
          moderationHiddenAt: null,
          moderationReason: null,
          processingState: "idle",
          failureReason: null,
          pageCount: 0,
          stagedPageCount: 3,
          availablePageCount: 0,
          isFull: false,
          version: 1,
          updatedAt: "2026-09-23T09:00:00Z",
        },
      ],
      meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
    }
  )
  const markup = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter>
        <AdminChapterList mangaId={mangaId} />
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )
  assert.match(markup, /Chương bị ẩn/)
  assert.match(markup, /Vi phạm nội quy/)
  assert.match(markup, /Bị quản trị viên ẩn/)
  assert.match(markup, /Oneshot/)
  assert.match(markup, /3 trang/)

  const target = {
    action: "visibility" as const,
    chapter: hiddenChapter as Parameters<
      typeof runAdminChapterAction
    >[1]["chapter"],
  }
  assert.equal(canSubmitAdminChapterAction(null, false, ""), false)
  assert.equal(canSubmitAdminChapterAction(target, true, ""), false)
  assert.equal(canSubmitAdminChapterAction(target, false, ""), true)

  let actionRequest: { body: unknown; method: string; url: string } | undefined
  globalThis.fetch = async (input, init) => {
    actionRequest = {
      body: JSON.parse(String(init?.body)),
      method: String(init?.method),
      url: String(input),
    }
    return Response.json({ data: { version: 3 } })
  }
  await runAdminChapterAction(apiBaseUrl, { ...target, reason: "" })
  assert.deepEqual(actionRequest, {
    body: { expectedVersion: 2, hidden: false },
    method: "PUT",
    url: `${apiBaseUrl}/v1/admin/chapters/chapter-1/visibility`,
  })

  const chapterKey = [
    ...adminChapterQueryKey(apiBaseUrl, mangaId),
    1,
    "updatedAt",
    "desc",
    "all",
    "all",
  ]
  const mangaKey = [
    "account",
    apiBaseUrl,
    "admin",
    "admin-mangas",
    1,
    "",
    "all",
    "all",
  ]
  client.setQueryData(mangaKey, { data: [] })
  assert.equal(client.getQueryState(chapterKey)?.isInvalidated, false)
  assert.equal(client.getQueryState(mangaKey)?.isInvalidated, false)
  await invalidateAdminChapterQueries(client, apiBaseUrl, "admin", mangaId)
  assert.equal(client.getQueryState(chapterKey)?.isInvalidated, true)
  assert.equal(client.getQueryState(mangaKey)?.isInvalidated, true)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
  mock.restore()
}

console.log("Admin chapter list rendering checks passed")
