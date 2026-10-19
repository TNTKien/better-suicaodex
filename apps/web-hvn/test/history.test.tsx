import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import {
  mangaReadingHistoryOptions,
  mergeReadingHistory,
  readingKeys,
  ReadingApiError,
} from "@workspace/account/reading-api"
import * as localHistory from "@workspace/account/reading-local-history"
import type { components } from "../src/lib/generated/api"

// SSR uses the initial store snapshot; read the current store in this hook harness.
mock.module("@workspace/account/reading-local-history", () => ({
  ...localHistory,
  useLocalReadingHistory: localHistory.readLocalReadingHistory,
}))
const feedback: { type: string; title: string }[] = []
mock.module("@workspace/ui/components/toast", () => ({
  toast: {
    add: (message: { type: string; title: string }) => feedback.push(message),
  },
}))
const apiBaseUrl = "https://api.example.test"
let status = "authenticated"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    status,
    user: status === "authenticated" ? { id: "reader" } : null,
    retry: () => {},
  }),
}))
const { useReadingHistory, groupHistory, chapterName } =
  await import("@workspace/account/reading-history")
const { HistoryClient } = await import("../modules/reading/history-client")
type HistoryPage = {
  data: components["schemas"]["MangaReadingHistoryItem"][]
  meta: { limit: number; nextCursor: string | null }
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
const options = mangaReadingHistoryOptions<HistoryPage>(apiBaseUrl, "reader")
const originalFetch = globalThis.fetch
const manga = {
  id: "manga",
  slug: "manga-slug",
  title: "Truyện <script>",
  cover: {
    url: "https://images.example.test/cover.512.webp",
    width: 700,
    height: 1000,
  },
}
function chapter(id: string, number: string, readAt: string) {
  return {
    chapter: { id, number, title: "Tên <b>", volume: null, language: "vi" },
    progress: { chapterId: id, mangaId: manga.id, readAt, updatedAt: readAt },
  }
}
const firstPage: HistoryPage = {
  data: [
    {
      manga,
      chapters: [
        chapter("chapter-2", "2", "2026-10-13T02:00:00Z"),
        chapter("chapter-1", "1", "2026-10-13T01:00:00Z"),
      ],
    },
  ],
  meta: { limit: 20, nextCursor: "cursor+2" },
}
let controller!: ReturnType<typeof useReadingHistory<HistoryPage>>
function Capture() {
  // eslint-disable-next-line react-hooks/globals -- SSR harness exposes hook actions without a browser.
  controller = useReadingHistory(
    apiBaseUrl,
    status === "authenticated" ? "reader" : null,
    mangaReadingHistoryOptions<HistoryPage>(
      apiBaseUrl,
      status === "authenticated" ? "reader" : null
    )
  )
  return null
}
function capture() {
  renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Capture />
    </QueryClientProvider>
  )
  return controller
}
function ui() {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <HistoryClient />
    </QueryClientProvider>
  )
}
let fails = false
let deletes = 0
try {
  localHistory.localReadingHistoryStore.setState({ guest: [], accounts: {} })
  assert.equal(mangaReadingHistoryOptions(apiBaseUrl, null).enabled, false)
  assert.equal(options.staleTime, 30_000)
  assert.equal(options.retry, false)
  assert.notDeepEqual(
    options.queryKey,
    mangaReadingHistoryOptions(apiBaseUrl, "other").queryKey
  )
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.origin, apiBaseUrl)
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.equal(new Headers(init?.headers).get("X-Internal-API-Key"), null)
    if (fails) return Response.json({}, { status: 503 })
    if (init?.method === "DELETE") {
      deletes++
      assert.equal(url.pathname, "/v1/me/reading-progress/chapter-2")
      return new Response(null, { status: 204 })
    }
    if (init?.method === "POST") {
      assert.equal(url.pathname, "/v1/me/reading-history/merge")
      assert.deepEqual(JSON.parse(String(init.body)), {
        entries: [{ chapterId: "guest", readAt: "2026-10-13T03:00:00Z" }],
      })
      return Response.json({ merged: [], ignored: [] })
    }
    assert.equal(url.pathname, "/v1/me/reading-history/manga")
    assert.equal(url.searchParams.get("limit"), "20")
    if (url.searchParams.has("cursor")) {
      assert.equal(url.searchParams.get("cursor"), "cursor+2")
      return Response.json({
        data: [
          {
            manga: {
              ...manga,
              id: "second-manga",
              slug: "second-manga",
              title: "Truyện tiếp theo",
            },
            chapters: [chapter("chapter-next", "9", "2026-10-12T00:00:00Z")],
          },
        ],
        meta: { limit: 20, nextCursor: null },
      })
    }
    return Response.json(firstPage)
  }) as typeof fetch
  await client.fetchInfiniteQuery(options)
  const loaded = ui()
  assert.match(loaded, /Truyện &lt;script&gt;/)
  assert.match(loaded, /Ch\. 2 - Tên &lt;b&gt;/)
  assert.match(loaded, /href="\/chapter\/chapter-2"/)
  assert.match(loaded, /href="\/manga\/manga\/manga-slug"/)
  assert.match(loaded, /cover\.256\.webp/)
  assert.match(loaded, /Xem thêm/)
  assert.doesNotMatch(loaded, /Lịch sử đang lưu trên thiết bị này/)
  await capture().history.fetchNextPage()
  assert.equal(capture().groups.length, 2)
  assert.equal(capture().history.hasNextPage, false)
  assert.match(ui(), /Truyện tiếp theo/)
  assert.doesNotMatch(ui(), /Xem thêm/)

  for (const scope of ["guest", "account:reader"] as const) {
    localHistory.recordLocalReadingProgress(scope, {
      chapterId: "chapter-2",
      mangaId: manga.id,
      readAt: "2026-10-13T02:00:00Z",
      snapshot: { manga, chapter: firstPage.data[0]!.chapters[0]!.chapter },
    })
  }
  const item = capture().groups[0]!.chapters[0]!
  assert.equal(item.chapterId, "chapter-2")
  fails = true
  await assert.rejects(
    capture().remove.mutateAsync(item),
    (error: unknown) => error instanceof ReadingApiError && error.status === 503
  )
  assert.equal(localHistory.readLocalReadingHistory("guest").length, 1)
  assert.equal(localHistory.readLocalReadingHistory("account:reader").length, 1)
  assert.equal(capture().groups[0]!.chapters.length, 2)
  assert.equal(feedback.at(-1)?.type, "error")
  fails = false
  await capture().remove.mutateAsync(item)
  assert.equal(deletes, 1)
  assert.equal(localHistory.readLocalReadingHistory("guest").length, 0)
  assert.equal(localHistory.readLocalReadingHistory("account:reader").length, 0)
  assert.equal(capture().groups[0]!.chapters[0]!.chapterId, "chapter-1")
  assert.equal(client.getQueryState(options.queryKey)?.isInvalidated, true)
  assert.equal(feedback.at(-1)?.type, "success")
  await mergeReadingHistory(apiBaseUrl, [
    { chapterId: "guest", readAt: "2026-10-13T03:00:00Z" },
  ])

  const source = capture().groups[0]!.chapters[0]!
  const sorted = groupHistory([
    source,
    { ...source, chapterId: "third", readAt: "2026-10-13T03:00:00Z" },
    { ...source, chapterId: "fourth", readAt: "2026-10-13T04:00:00Z" },
    { ...source, chapterId: "fifth", readAt: "2026-10-13T05:00:00Z" },
    source,
  ])
  assert.deepEqual(
    sorted[0]!.chapters.map(({ chapterId }) => chapterId),
    ["fifth", "fourth", "third"]
  )
  assert.equal(
    chapterName({ ...source, chapterNumber: null, chapterTitle: null }),
    "Oneshot"
  )

  status = "guest"
  assert.match(ui(), /Lịch sử đang lưu trên thiết bị này/)
  assert.match(ui(), /href="\/login\?returnTo=%2Fhistory"/)
  assert.match(ui(), /Chưa có lịch sử đọc/)
  localHistory.recordLocalReadingProgress("guest", {
    chapterId: "guest",
    mangaId: manga.id,
    readAt: "2026-10-13T03:00:00Z",
    snapshot: null,
  })
  assert.match(ui(), /Chapter đã đọc/)
  assert.match(ui(), /href="\/chapter\/guest"/)
  const requestsBefore = deletes
  await capture().remove.mutateAsync(capture().groups[0]!.chapters[0]!)
  assert.equal(deletes, requestsBefore)
  assert.match(ui(), /Chưa có lịch sử đọc/)
  status = "loading"
  assert.match(ui(), /Đang tải lịch sử đọc/)
  status = "error"
  assert.match(ui(), /Không thể kiểm tra tài khoản/)
  status = "authenticated"
  client.setQueryData(options.queryKey, {
    pages: [{ data: [], meta: { limit: 20, nextCursor: null } }],
    pageParams: [null],
  })
  assert.match(ui(), /Chưa có lịch sử đọc/)
  client
    .getQueryCache()
    .find({ queryKey: options.queryKey })!
    .setState({ status: "error", error: new Error("offline") })
  assert.match(ui(), /Chưa tải được lịch sử đọc/)
  assert.ok(readingKeys.account(apiBaseUrl, "reader").includes("reader"))
} finally {
  globalThis.fetch = originalFetch
  localHistory.localReadingHistoryStore.setState({ guest: [], accounts: {} })
  client.clear()
}
console.log(
  "HVN reading history states, grouping, pagination, guest/account deletion and failure checks passed"
)
