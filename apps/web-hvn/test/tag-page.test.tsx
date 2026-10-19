import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { components } from "../src/lib/generated/api"

mock.module("server-only", () => ({}))
mock.module("next/cache", () => ({ io: async () => {} }))
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
const originalKey = process.env.INTERNAL_API_KEY
process.env.API_URL = "https://catalog.example.test"
process.env.INTERNAL_API_KEY = "tag-server-only-key"
const { TagPageContent, TagRedirect, tagMetadata } =
  await import("../modules/manga/tag-page")
const { CatalogResults } = await import("../modules/manga/catalog")
const { MangaRow } = await import("../modules/manga/manga-row")

const id = "00000000-0000-4000-8000-000000000001"
const tag: components["schemas"]["TagSummary"] = {
  id,
  slug: "co-che",
  name: "Có che",
  group: "content",
}
const path = `/tag/${id}/co-che`
const manga: components["schemas"]["MangaListItem"] = {
  id: "manga-id",
  slug: "manga-slug",
  title: "Truyện <script>",
  alternativeTitles: {
    en: ["Truyện <script>", "Alias <b>", "Alias <b>"],
    ja: ["Tên thứ hai", "Tên thứ ba"],
  },
  statistics: { follows: 1234, views: 56789, comments: 6 },
  cover: {
    url: "https://images.example.test/cover.512.webp",
    width: 700,
    height: 1000,
  },
  tags: [tag],
  authors: [],
  contentRating: "safe",
  description: null,
  originalLanguage: "ja",
  status: "completed",
  year: 2026,
  latestChapter: null,
  latestChapterPublishedAt: null,
}
let missing = false
let unavailable = false
let empty = false
const requests: string[] = []
function props(slug = tag.slug, page?: string | string[], requestedId = id) {
  return {
    params: Promise.resolve({ id: requestedId, slug }),
    searchParams: Promise.resolve({ page }),
  }
}
function is404(error: unknown) {
  return (
    error instanceof Error &&
    "digest" in error &&
    error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
  )
}
function redirectTo(target: string) {
  return (error: unknown) =>
    error instanceof Error &&
    "digest" in error &&
    error.digest === `NEXT_REDIRECT;replace;${target};308;`
}
try {
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    requests.push(url.pathname)
    assert.equal(url.origin, "https://catalog.example.test")
    assert.equal(
      new Headers(init?.headers).get("X-Internal-API-Key"),
      "tag-server-only-key"
    )
    assert.equal(init?.redirect, "error")
    if (unavailable)
      return Response.json(
        { error: { code: "UPSTREAM_ERROR" } },
        { status: 503 }
      )
    if (missing)
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
    if (url.pathname === `/v1/tags/${id}`) return Response.json(tag)
    assert.equal(url.pathname, "/v1/manga")
    assert.deepEqual(url.searchParams.getAll("includeTag"), [id])
    assert.equal(url.searchParams.get("sort"), "latestChapter")
    assert.equal(url.searchParams.get("direction"), "desc")
    assert.equal(url.searchParams.get("limit"), "36")
    return Response.json({
      data: empty ? [] : [manga],
      meta: {
        page: Number(url.searchParams.get("page") ?? 1),
        limit: 36,
        total: empty ? 0 : 72,
        totalPages: empty ? 0 : 2,
      },
    })
  }) as typeof fetch

  const page = await TagPageContent(props())
  const shell = renderToStaticMarkup(page)
  assert.match(shell, /Trang chủ/)
  assert.match(shell, /Thể loại/)
  assert.match(shell, /aria-current="page">Có che/)
  assert.match(shell, /Thông tin/)
  assert.match(shell, /the-loai-mac-dinh\.webp/)
  assert.match(shell, /Các truyện thuộc thể loại Có che/)
  assert.match(shell, /Danh sách truyện: Có che/)
  assert.deepEqual(await tagMetadata(props()), {
    title: "Có che",
    alternates: { canonical: path },
  })
  await assert.rejects(
    TagPageContent(props("sai-slug", "2")),
    redirectTo(`${path}?page=2`)
  )
  await assert.rejects(
    TagPageContent(props("sai-slug", ["02", "3"])),
    redirectTo(`${path}?page=2`)
  )
  await assert.rejects(
    TagPageContent(props("cu", "2", "invalid-tag")),
    /NEXT_HTTP_ERROR_FALLBACK;404/
  )
  await assert.rejects(TagRedirect(props()), redirectTo(path))
  await assert.rejects(
    TagRedirect(props("", "2", "invalid-tag")),
    /NEXT_HTTP_ERROR_FALLBACK;404/
  )
  assert.deepEqual(await tagMetadata(props("", undefined, "invalid-tag")), {
    title: "Không tìm thấy thể loại",
  })

  const html = renderToStaticMarkup(
    await CatalogResults({
      path,
      sort: "latestChapter",
      title: tag.name,
      tag,
      searchParams: Promise.resolve({ page: "2" }),
    })
  )
  assert.doesNotMatch(html, /manga-grid-all/)
  assert.match(html, /Truyện &lt;script&gt;/)
  assert.match(html, /Alias &lt;b&gt;/)
  assert.equal((html.match(/Alias &lt;b&gt;/g) ?? []).length, 1)
  assert.match(html, /Tên thứ hai/)
  assert.doesNotMatch(html, /Tên thứ ba/)
  assert.match(html, /Kết thúc\./)
  assert.match(html, /Theo dõi: <\/span>1\.234/)
  assert.match(html, /Lượt xem: <\/span>56\.789/)
  assert.doesNotMatch(html, /Like:/)
  assert.match(html, /cover\.256\.webp/)
  assert.match(html, new RegExp(`href="${path}"`))
  assert.match(html, new RegExp(`href="${path}\\?page=2"`))
  assert.match(html, /hvn-pagination/)
  const noCover = renderToStaticMarkup(
    <MangaRow
      manga={{
        ...manga,
        cover: null,
        status: null,
        tags: [],
        alternativeTitles: {},
        statistics: { views: 0, follows: 0, comments: 0 },
      }}
    />
  )
  assert.match(noCover, /Bìa truyện Truyện &lt;script&gt; chưa có ảnh/)
  assert.match(noCover, /Tên Khác: <\/span><span[^>]*><\/span>/)
  assert.match(noCover, /Theo dõi: <\/span>0/)
  await assert.rejects(
    CatalogResults({
      path,
      sort: "latestChapter",
      title: tag.name,
      tag,
      searchParams: Promise.resolve({ page: "3" }),
    }),
    is404
  )
  empty = true
  const emptyList = renderToStaticMarkup(
    await CatalogResults({
      path,
      sort: "latestChapter",
      title: tag.name,
      tag,
      searchParams: Promise.resolve({}),
    })
  )
  assert.match(emptyList, /Không có truyện nào/)
  assert.doesNotMatch(emptyList, /hvn-pagination/)

  missing = true
  await assert.rejects(TagPageContent(props()), is404)
  await assert.rejects(
    TagPageContent(props("", undefined, "invalid-tag")),
    /NEXT_HTTP_ERROR_FALLBACK;404/
  )
  await assert.rejects(TagRedirect(props()), is404)
  assert.deepEqual(await tagMetadata(props()), {
    title: "Không tìm thấy thể loại",
  })
  missing = false
  unavailable = true
  await assert.rejects(TagPageContent(props()), /503 UPSTREAM_ERROR/)
  await assert.rejects(TagRedirect(props()), /503 UPSTREAM_ERROR/)
  assert.ok(requests.includes(`/v1/tags/${id}`))
  assert.ok(
    requests.every((path) => path === `/v1/tags/${id}` || path === "/v1/manga")
  )
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  if (originalKey === undefined) delete process.env.INTERNAL_API_KEY
  else process.env.INTERNAL_API_KEY = originalKey
}
console.log(
  "web-hvn tag filtering, canonical redirects, horizontal cards and error checks passed"
)
