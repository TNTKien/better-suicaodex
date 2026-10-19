import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { renderToStaticMarkup } from "react-dom/server"
import { useLibrary } from "@workspace/account/library"
import {
  libraryCategories,
  libraryItemKey,
  libraryListOptions,
  LibraryApiError,
} from "@workspace/account/library-api"
import type { components } from "../src/lib/generated/api"

const apiBaseUrl = "https://api.example.test"
let status = "guest"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    status,
    user: status === "authenticated" ? { id: "reader" } : null,
    retry: () => {},
  }),
}))
const { MyLibrary } = await import("../modules/library/my-library")
const { LibraryMangaRow } = await import("../modules/library/manga-row")
type LibraryPage = {
  data: components["schemas"]["LibraryItem"][]
  meta: { limit: number; nextCursor: string | null }
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
const options = libraryListOptions<LibraryPage>(
  apiBaseUrl,
  "reader",
  "reading",
  "needle",
  "latestChapter"
)
const originalFetch = globalThis.fetch
const item: components["schemas"]["LibraryItem"] = {
  category: "reading",
  createdAt: "2026-10-14T00:00:00Z",
  updatedAt: "2026-10-14T00:00:00Z",
  manga: {
    id: "manga",
    slug: "manga-slug",
    title: "Truyện <script>",
    authors: [],
    contentRating: "safe",
    description: null,
    originalLanguage: "ja",
    status: "ongoing",
    year: 2026,
    latestChapterPublishedAt: "2026-10-14T00:00:00Z",
    latestChapter: {
      id: "chapter",
      number: "2.5",
      publishedAt: "2026-10-14T00:00:00Z",
      groups: [],
      statistics: { views: 0, comments: 0 },
    },
    tags: [{ id: "tag", slug: "comedy", name: "Hài hước", group: "genre" }],
    cover: {
      url: "https://images.example.test/cover.512.webp",
      width: 700,
      height: 1000,
    },
  },
}
const params = "?tab=reading&q=needle&sort=latestChapter"
let controller!: ReturnType<typeof useLibrary<LibraryPage>>
function Capture() {
  // eslint-disable-next-line react-hooks/globals -- SSR harness exposes hook actions without a browser.
  controller = useLibrary<LibraryPage>(
    apiBaseUrl,
    status === "authenticated" ? "reader" : null
  )
  return null
}
function render(children: React.ReactNode, searchParams = params) {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams}>
        {children}
      </NuqsTestingAdapter>
    </QueryClientProvider>
  )
}
function capture() {
  render(<Capture />)
  return controller
}
function ui(searchParams = params) {
  return render(<MyLibrary />, searchParams)
}
let deletes = 0
let requests = 0
let errorStatus = 0
try {
  globalThis.fetch = (async (input, init) => {
    requests++
    const url = new URL(String(input))
    assert.equal(url.origin, apiBaseUrl)
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.equal(new Headers(init?.headers).get("X-Internal-API-Key"), null)
    if (errorStatus) return Response.json({}, { status: errorStatus })
    if (init?.method === "DELETE") {
      deletes++
      assert.equal(url.pathname, "/v1/me/library/manga")
      return new Response(null, { status: 204 })
    }
    assert.equal(url.pathname, "/v1/me/library")
    assert.equal(url.searchParams.get("category"), "reading")
    assert.equal(url.searchParams.get("q"), "needle")
    assert.equal(url.searchParams.get("sort"), "latestChapter")
    assert.equal(url.searchParams.get("limit"), "20")
    if (url.searchParams.has("cursor")) {
      assert.equal(url.searchParams.get("cursor"), "cursor+2")
      return Response.json({
        data: [
          {
            ...item,
            manga: { ...item.manga, id: "second", title: "Truyện tiếp theo" },
          },
        ],
        meta: { limit: 20, nextCursor: null },
      })
    }
    return Response.json({
      data: [item],
      meta: { limit: 20, nextCursor: "cursor+2" },
    })
  }) as typeof fetch

  assert.equal(libraryListOptions(apiBaseUrl, null, "reading").enabled, false)
  assert.match(ui(), /Bạn chưa đăng nhập/)
  assert.match(ui(), /href="\/login\?returnTo=%2Fmy-library"/)
  assert.equal(requests, 0)
  status = "loading"
  assert.match(ui(), /Đang tải thư viện/)
  status = "error"
  assert.match(ui(), /Chưa tải được thư viện/)
  status = "authenticated"
  assert.match(ui(), /Đang tải thư viện/)
  await client.fetchInfiniteQuery(options)
  const populated = ui()
  for (const { label } of libraryCategories)
    assert.match(populated, new RegExp(label))
  assert.match(populated, /aria-label="Danh mục thư viện"/)
  assert.match(populated, /aria-label="Sắp xếp thư viện"/)
  assert.match(populated, /aria-label="Tìm trong thư viện"/)
  assert.match(populated, /value="needle"/)
  assert.match(populated, /hvn-library-tabs/)
  assert.match(populated, /Truyện &lt;script&gt;/)
  assert.match(populated, /href="\/manga\/manga\/manga-slug"/)
  assert.match(populated, /href="\/chapter\/chapter"/)
  assert.match(populated, /Ch\. 2\.5/)
  assert.match(populated, /cover\.256\.webp/)
  assert.match(populated, /href="\/tag\/tag\/comedy"/)
  assert.match(
    populated,
    /aria-label="Xóa Truyện &lt;script&gt; khỏi thư viện"/
  )
  assert.match(populated, /Xem thêm/)
  await capture().library.fetchNextPage()
  assert.equal(capture().items.length, 2)
  assert.equal(capture().library.hasNextPage, false)
  assert.match(ui(), /Truyện tiếp theo/)
  assert.doesNotMatch(ui(), /Xem thêm/)
  assert.equal(capture().category, "reading")
  assert.equal(capture().search, "needle")
  assert.equal(capture().sort, "latestChapter")

  const detailKey = libraryItemKey(apiBaseUrl, "reader", "manga")
  client.setQueryData(detailKey, item)
  client.setQueryData(["account", "reader"], { user: { id: "reader" } })
  errorStatus = 503
  await assert.rejects(
    capture().remove.mutateAsync("manga"),
    (error: unknown) => error instanceof LibraryApiError && error.status === 503
  )
  assert.equal(capture().items.length, 2)
  assert.deepEqual(client.getQueryData(detailKey), item)
  errorStatus = 401
  await assert.rejects(
    capture().remove.mutateAsync("manga"),
    (error: unknown) => error instanceof LibraryApiError && error.status === 401
  )
  assert.equal(client.getQueryState(["account", "reader"])?.isInvalidated, true)
  assert.equal(capture().items.length, 2)
  errorStatus = 0
  await capture().remove.mutateAsync("manga")
  assert.equal(deletes, 1)
  assert.deepEqual(
    capture().items.map(({ manga }) => manga.id),
    ["second"]
  )
  assert.equal(client.getQueryData(detailKey), null)
  assert.equal(client.getQueryState(options.queryKey)?.isInvalidated, true)

  for (const { value, label } of libraryCategories) {
    const key = libraryListOptions<LibraryPage>(
      apiBaseUrl,
      "reader",
      value
    ).queryKey
    client.setQueryData(key, {
      pages: [{ data: [], meta: { limit: 20, nextCursor: null } }],
      pageParams: [null],
    })
    assert.match(
      ui(`?tab=${value}`),
      new RegExp(`Chưa có truyện trong mục ${label}`)
    )
  }
  client.setQueryData(options.queryKey, {
    pages: [{ data: [], meta: { limit: 20, nextCursor: null } }],
    pageParams: [null],
  })
  assert.match(ui(), /Không tìm thấy truyện “needle”/)
  assert.doesNotMatch(ui(), /Xem thêm/)
  const query = client.getQueryCache().find({ queryKey: options.queryKey })!
  query.setState({ status: "error", error: new LibraryApiError(503) })
  assert.match(ui(), /Chưa tải được thư viện/)
  query.setState({ status: "error", error: new LibraryApiError(401) })
  assert.match(ui(), /Bạn chưa đăng nhập/)
  const withoutChapter = renderToStaticMarkup(
    <LibraryMangaRow
      manga={{ ...item.manga, cover: null, latestChapter: null }}
    />
  )
  assert.match(withoutChapter, /Chưa có chương/)
  assert.match(withoutChapter, /Bìa truyện Truyện &lt;script&gt; chưa có ảnh/)
  status = "guest"
  const before = requests
  await assert.rejects(
    capture().remove.mutateAsync("manga"),
    (error: unknown) => error instanceof LibraryApiError && error.status === 401
  )
  assert.equal(requests, before)
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log(
  "HVN library categories, search/sort, pagination, guest/error states and deletion checks passed"
)
