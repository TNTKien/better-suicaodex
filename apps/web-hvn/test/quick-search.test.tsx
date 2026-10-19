import assert from "node:assert/strict"
import type { ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MangaSearchError } from "@workspace/catalog/search"
import { QuickSearch, QuickSearchResults } from "../components/quick-search"
import type { components } from "../src/lib/generated/api"

const data: components["schemas"]["MangaList"] = {
  data: [
    {
      id: "manga-id",
      slug: "ten-truyen",
      title: "Tên <script>",
      description: null,
      originalLanguage: "ja",
      contentRating: "safe",
      status: "ongoing",
      year: 2026,
      cover: {
        url: "https://images.test/cover.webp",
        width: 700,
        height: 1000,
      },
      authors: [{ id: "author", name: "Tác giả", slug: "tac-gia" }],
      tags: [],
      latestChapter: null,
      latestChapterPublishedAt: null,
      alternativeTitles: {},
      statistics: { follows: 0, views: 0, comments: 0 },
    },
  ],
  meta: { page: 1, limit: 5, total: 1234, totalPages: 247 },
}
const props: ComponentProps<typeof QuickSearchResults> = {
  hasQuery: true,
  query: "  Bí mật & mùa hè  ",
  loading: false,
  paused: false,
  error: null,
  data,
  onRetry: () => {},
  onResultClick: () => {},
}
const render = (overrides: Partial<typeof props> = {}) =>
  renderToStaticMarkup(<QuickSearchResults {...props} {...overrides} />)

const html = render()
assert.match(html, /href="\/manga\/manga-id\/ten-truyen"/)
assert.match(html, /data-search-result/)
assert.match(html, /Tên &lt;script&gt;/)
assert.doesNotMatch(html, /<script>/)
assert.match(html, /Tác giả/)
assert.match(html, /Đang tiến hành\. · 2026/)
assert.match(html, /Xem tất cả 1\.234 kết quả/)
const destination = html.match(/href="(http:\/\/localhost:3000[^"]+)"/)
assert.ok(destination)
const url = new URL(destination[1]!)
assert.equal(url.pathname, "/advanced-search")
assert.equal(url.searchParams.get("q"), "Bí mật & mùa hè")
assert.match(html, /target="_blank" rel="noopener noreferrer"/)
assert.doesNotMatch(html, /href="\/advanced-search/)
assert.match(render({ hasQuery: false }), /Nhập tên truyện để tìm kiếm/)
const loading = render({ loading: true })
assert.match(loading, /data-slot="skeleton"/)
assert.doesNotMatch(loading, /data-search-result/)
assert.match(
  render({ data: { ...data, data: [] } }),
  /Không tìm thấy truyện nào/
)
const offline = render({ paused: true, loading: true })
assert.match(offline, /Bạn đang ngoại tuyến/)
assert.match(offline, /disabled=""/)
assert.doesNotMatch(offline, /data-search-result|data-slot="skeleton"/)
assert.match(
  render({ error: new MangaSearchError(429, "RATE_LIMITED") }),
  /Bạn tìm quá nhanh/
)
assert.match(
  render({ error: new Error("private details") }),
  /Có lỗi xảy ra, vui lòng thử lại sau/
)

const client = new QueryClient()
const originalFetch = globalThis.fetch
let requests = 0
globalThis.fetch = async () => {
  requests++
  return Response.json(data)
}
try {
  for (const mobile of [false, true]) {
    const initial = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <QuickSearch mobile={mobile} />
      </QueryClientProvider>
    )
    assert.match(initial, /type="search"/)
    assert.match(initial, /aria-label="Tìm kiếm nhanh manga"/)
    assert.match(initial, /maxLength="160"/)
    assert.match(initial, /autoComplete="off"/)
    assert.match(initial, /aria-expanded="false"/)
    assert.doesNotMatch(initial, /action=|data-search-result/)
    assert.equal(/aria-label="Tìm kiếm"/.test(initial), !mobile)
  }
  assert.equal(
    requests,
    0,
    "Closed search never requests manga at initial render"
  )
} finally {
  globalThis.fetch = originalFetch
  client.clear()
}
console.log(
  "HVN quick search results, states, local links and main-domain search checks passed"
)
