import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { pageHref, pageNumber } from "@workspace/catalog/pagination"
import { PagePagination } from "@workspace/ui/components/page-pagination"
import type { components } from "../src/lib/generated/api"

mock.module("server-only", () => ({}))
mock.module("next/cache", () => ({ io: async () => {} }))
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
const originalKey = process.env.INTERNAL_API_KEY
process.env.API_URL = "https://catalog.example.test"
process.env.INTERNAL_API_KEY = "latest-server-only-key"
const { CatalogResults } = await import("../modules/manga/catalog")

const manga: components["schemas"]["MangaListItem"] = {
  alternativeTitles: { en: ["Tên thứ nhất", "Tên thứ hai", "Tên thứ ba"] },
  statistics: { views: 1234, follows: 42, comments: 0 },
  id: "manga-id",
  slug: "truyen-moi",
  title: "Truyện <script>",
  authors: [],
  cover: {
    url: "https://images.example.test/cover.512.webp",
    width: 700,
    height: 1000,
  },
  contentRating: "safe",
  description: null,
  latestChapter: {
    id: "chapter-id",
    number: "2.5",
    publishedAt: "2026-10-14T00:00:00Z",
    groups: [],
    statistics: { views: 0, comments: 0 },
  },
  latestChapterPublishedAt: null,
  originalLanguage: "ja",
  status: "ongoing",
  tags: [],
  year: 2026,
}

try {
  for (const value of [
    undefined,
    "0",
    "-1",
    "1.5",
    "02",
    "abc",
    ["2", "3"],
    "9007199254740992",
  ])
    assert.equal(pageNumber(value), 1)
  assert.equal(pageNumber("2"), 2)
  assert.equal(pageHref("/latest", 1), "/latest")
  assert.equal(pageHref("/latest", 3), "/latest?page=3")

  let requestedPage = "1"
  let totalPages = 20
  let empty = false
  let expectedSort = "latestChapter"
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    assert.equal(url.origin, "https://catalog.example.test")
    assert.equal(url.pathname, "/v1/manga")
    assert.equal(url.searchParams.get("sort"), expectedSort)
    assert.equal(url.searchParams.get("direction"), "desc")
    assert.equal(url.searchParams.get("limit"), "36")
    assert.equal(url.searchParams.get("hasChapter"), null)
    requestedPage = url.searchParams.get("page") ?? "1"
    assert.equal(
      new Headers(init?.headers).get("X-Internal-API-Key"),
      "latest-server-only-key"
    )
    assert.equal(init?.redirect, "error")
    assert.notEqual(init?.credentials, "include")
    return Response.json({
      data: empty ? [] : [manga],
      meta: { page: Number(requestedPage), limit: 36, total: 720, totalPages },
    })
  }) as typeof fetch
  async function results(
    page?: string | string[],
    path: "/latest" | "/recent" = "/latest"
  ) {
    return renderToStaticMarkup(
      await CatalogResults({
        path,
        title: path === "/recent" ? "Truyện mới đăng" : "Mới cập nhật",
        sort: path === "/recent" ? "publishedAt" : "latestChapter",
        searchParams: Promise.resolve({ page }),
      })
    )
  }

  const first = await results()
  assert.equal(requestedPage, "1")
  assert.doesNotMatch(first, /manga-grid-all/)
  assert.match(first, /href="\/manga\/manga-id\/truyen-moi"/)
  assert.match(first, /cover\.256\.webp/)
  assert.match(first, /srcSet="[^"]+256w, [^"]+512w"/)
  assert.match(first, /sizes="\(min-width: 640px\) 160px, 96px"/)
  assert.match(first, /Tên thứ nhất; Tên thứ hai/)
  assert.doesNotMatch(first, /Tên thứ ba/)
  assert.match(first, /Theo dõi: <\/span>42/)
  assert.match(first, /Lượt xem: <\/span>1\.234/)
  assert.match(first, /Truyện &lt;script&gt;/)
  assert.match(first, /aria-label="Phân trang mới cập nhật"/)
  assert.match(first, /hvn-pagination/)
  assert.match(first, /◀ Prev/)
  assert.match(first, /Next ▶/)
  assert.match(first, /href="\/latest\?page=10"/)
  assert.match(first, /href="\/latest\?page=20"/)
  assert.match(first, /pagination-ellipsis/)
  assert.match(first, /aria-disabled="true"/)

  const second = await results("2")
  assert.equal(requestedPage, "2")
  assert.match(second, /href="\/latest"/)
  assert.match(second, /aria-current="page"[^>]*[\s\S]*?>2<\//)
  const last = await results("20")
  assert.equal(requestedPage, "20")
  assert.match(last, /href="\/latest\?page=19"/)
  assert.match(
    last,
    /aria-label="Đến trang sau"[^>]*aria-disabled="true"|aria-disabled="true"[^>]*aria-label="Đến trang sau"/
  )
  await results(["2", "3"])
  assert.equal(requestedPage, "1")

  await assert.rejects(
    results("21"),
    (error: unknown) =>
      error instanceof Error &&
      "digest" in error &&
      error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
  )
  totalPages = 0
  empty = true
  const noData = await results()
  assert.match(noData, /Không có truyện nào/)
  assert.doesNotMatch(noData, /data-slot="pagination"/)
  await assert.rejects(
    results("2"),
    (error: unknown) =>
      error instanceof Error &&
      "digest" in error &&
      error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
  )

  expectedSort = "publishedAt"
  totalPages = 20
  empty = false
  const recent = await results(undefined, "/recent")
  assert.equal(requestedPage, "1")
  assert.doesNotMatch(recent, /manga-grid-all/)
  assert.match(recent, /Tên thứ nhất; Tên thứ hai/)
  assert.doesNotMatch(recent, /Tên thứ ba/)
  assert.match(recent, /Theo dõi: <\/span>42/)
  assert.match(recent, /Lượt xem: <\/span>1\.234/)
  assert.match(recent, /aria-label="Phân trang truyện mới đăng"/)
  assert.match(recent, /hvn-pagination/)
  assert.match(recent, /href="\/recent\?page=20"/)
  assert.doesNotMatch(recent, /href="\/latest/)
  const recentSecond = await results("2", "/recent")
  assert.equal(requestedPage, "2")
  assert.match(recentSecond, /href="\/recent"/)
  await assert.rejects(
    results("21", "/recent"),
    (error: unknown) =>
      error instanceof Error &&
      "digest" in error &&
      error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
  )
  empty = true
  totalPages = 0
  assert.match(await results(undefined, "/recent"), /Không có truyện nào/)

  globalThis.fetch = (async () =>
    Response.json(
      { error: { code: "UPSTREAM_ERROR" } },
      { status: 503 }
    )) as typeof fetch
  await assert.rejects(results(), /503 UPSTREAM_ERROR/)
  await assert.rejects(results(undefined, "/recent"), /503 UPSTREAM_ERROR/)
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  if (originalKey === undefined) delete process.env.INTERNAL_API_KEY
  else process.env.INTERNAL_API_KEY = originalKey
}

function pagination(page: number, totalPages: number) {
  return renderToStaticMarkup(
    <PagePagination
      variant="hvn"
      ariaLabel="Phân trang mới cập nhật"
      currentPage={page}
      getPageHref={(target) => pageHref("/latest", target)}
      totalPages={totalPages}
    />
  )
}
function pageNumbers(html: string) {
  return [...html.matchAll(/aria-label="Đến trang (\d+)"/g)].map((match) =>
    Number(match[1])
  )
}
const sample = pagination(4, 1757)
assert.deepEqual(pageNumbers(sample), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1757])
assert.equal((sample.match(/data-slot="pagination-ellipsis"/g) ?? []).length, 1)
assert.match(sample, /href="\/latest\?page=3"/)
assert.match(sample, /href="\/latest\?page=5"/)
assert.deepEqual(
  pageNumbers(pagination(1000, 1757)),
  [1, 996, 997, 998, 999, 1000, 1001, 1002, 1003, 1004, 1005, 1757]
)
assert.deepEqual(
  pageNumbers(pagination(1757, 1757)),
  [1, 1748, 1749, 1750, 1751, 1752, 1753, 1754, 1755, 1756, 1757]
)
assert.deepEqual(pageNumbers(pagination(3, 5)), [1, 2, 3, 4, 5])
assert.equal(pagination(1, 1), "")

console.log(
  "web-hvn latest/recent queries, HVN pagination, empty and 404 checks passed"
)
