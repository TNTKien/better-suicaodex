import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import * as NextNavigation from "next/navigation"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"
import { cloneElement } from "react"
import type { components } from "../src/lib/generated/api"
import {
  libraryItemKey,
  libraryListOptions,
  LibraryApiError,
} from "@workspace/account/library-api"

const navigation = { ...NextNavigation }
mock.module("next/navigation", () => ({
  ...navigation,
  useRouter: () => ({ push: (href: string) => destinations.push(href) }),
}))
mock.module("server-only", () => ({}))
mock.module("next/cache", () => ({
  navigation: async () => {},
  cacheLife: () => {},
}))
const feedback: {
  type: string
  title: string
  actionProps?: { onClick: () => void }
}[] = []
const destinations: string[] = []
mock.module("@workspace/ui/components/toast", () => ({
  toast: {
    add: (message: (typeof feedback)[number]) => {
      feedback.push(message)
      return "toast"
    },
    close: () => {},
  },
}))
let status = "guest"
let profileStatus = "active"
const apiBaseUrl = "https://api.example.test"
mock.module("../modules/account/provider", () => ({
  useAccount: () => ({
    apiBaseUrl,
    status,
    user: status === "authenticated" ? { id: "reader" } : null,
    account: { profile: { status: profileStatus } },
    retry: () => {},
  }),
}))
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
const originalKey = process.env.INTERNAL_API_KEY
process.env.API_URL = "https://catalog.example.test"
process.env.INTERNAL_API_KEY = "manga-server-only-key"
const { MangaPageContent, MangaChaptersContent, MangaRedirect, mangaMetadata } =
  await import("../modules/manga/manga-page")
const { MangaDetailView } = await import("../modules/manga/manga-detail-view")
const { MangaDescription } = await import("../modules/manga/manga-description")
const { MangaLibraryAction } =
  await import("../modules/library/manga-library-action")
const { useLibraryItem, showLibraryLoginToast } =
  await import("@workspace/account/library-item")
const id = "00000000-0000-4000-8000-000000000001"
const path = `/manga/${id}/manga-slug`
const manga: components["schemas"]["MangaDetail"] = {
  id,
  slug: "manga-slug",
  title: "Truyện <script>",
  alternativeTitles: {
    en: ["Truyện <script>", "Tên khác <b>", "Tên khác <b>"],
    ja: ["Tên hai", "Tên ba"],
  },
  authors: [{ id: "author", slug: "author-slug", name: "Tác giả A" }],
  artists: [{ id: "artist", slug: "artist-slug", name: "Họa sĩ B" }],
  groups: [
    {
      id: "group",
      slug: "group-slug",
      name: "Nhóm dịch C",
      avatarUrl: "https://images.example.test/group.webp",
    },
  ],
  tags: [{ id: "tag", slug: "comedy", name: "Hài hước", group: "genre" }],
  cover: {
    url: "https://images.example.test/cover.512.webp",
    width: 700,
    height: 1000,
  },
  contentRating: "safe",
  description: "**In đậm**\n\nNội dung truyện.",
  originalLanguage: "ja",
  status: "ongoing",
  year: 2026,
  statistics: { views: 162700, follows: 12, comments: 4 },
  latestChapter: null,
  latestChapterPublishedAt: null,
  firstChapter: null,
  readingEntries: [],
  chapterCounts: { slots: 0, releases: 0 },
  numberingMode: "global",
  availableLanguages: [],
  lastChapter: null,
  lastVolume: null,
  links: [{ key: "al", label: "AniList", url: "https://anilist.co/manga/1" }],
  publicationDemographic: null,
  createdAt: "2026-01-01T00:00:00Z",
  publishedAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T18:04:05Z",
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})
function render(children: React.ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}
function props(
  slug = manga.slug,
  requestedId = id,
  query: { page?: string; direction?: string; tab?: string } = {}
) {
  return {
    params: Promise.resolve({ id: requestedId, slug }),
    searchParams: Promise.resolve(query),
  }
}
const is404 = (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
const redirectTo = (target: string) => (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === `NEXT_REDIRECT;replace;${target};308;`
type LibraryItem = components["schemas"]["LibraryItem"]
let controller!: ReturnType<typeof useLibraryItem<LibraryItem>>
function Capture() {
  // eslint-disable-next-line react-hooks/globals -- SSR harness exposes hook actions without a browser.
  controller = useLibraryItem<LibraryItem>(
    apiBaseUrl,
    status === "authenticated" ? "reader" : null,
    id
  )
  return null
}
function capture() {
  render(<Capture />)
  return controller
}
try {
  let missing = false
  let missingChapters = false
  let unavailable = false
  const paths: string[] = []
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input))
    paths.push(url.pathname)
    assert.equal(url.origin, "https://catalog.example.test")
    assert.equal(
      new Headers(init?.headers).get("X-Internal-API-Key"),
      "manga-server-only-key"
    )
    assert.equal(init?.redirect, "error")
    if (unavailable)
      return Response.json(
        { error: { code: "UPSTREAM_ERROR" } },
        { status: 503 }
      )
    if (missing)
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
    if (url.pathname === `/v1/manga/${id}/chapters`) {
      assert.equal(url.searchParams.get("sort"), "volume")
      assert.equal(url.searchParams.get("limit"), "20")
      assert.ok(["asc", "desc"].includes(url.searchParams.get("direction")!))
      if (missingChapters)
        return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
      return Response.json({
        data: [],
        slots: [],
        meta: {
          page: Number(url.searchParams.get("page")),
          limit: 20,
          total: 21,
          totalPages: 2,
          releaseTotal: 21,
        },
      })
    }
    assert.equal(url.pathname, `/v1/manga/${id}`)
    return Response.json(manga)
  }) as typeof fetch
  const page = await MangaPageContent(props())
  assert.deepEqual(paths, [`/v1/manga/${id}`])
  const chapterContent = (query: { page?: string } = {}) =>
    MangaChaptersContent({ manga, searchParams: Promise.resolve(query) })
  const html = render(cloneElement(page, { chapters: await chapterContent() }))
  assert.match(html, /aria-label="Bình luận truyện"/)
  assert.doesNotMatch(html, /id="comments-heading"|Viết bình luận/)
  assert.ok(paths.every((path) => !path.endsWith("/comments")))
  assert.match(html, /Thông tin truyện/)
  assert.match(html, /Ảnh bìa/)
  assert.match(html, /Truyện &lt;script&gt;/)
  assert.match(html, /Tên khác &lt;b&gt;; Tên hai; Tên ba/)
  assert.match(html, /href="\/tag\/tag\/comedy"/)
  assert.match(html, /href="\/author\/author\/author-slug"/)
  assert.match(html, /href="\/artist\/artist\/artist-slug"/)
  assert.match(html, /href="\/group\/group\/group-slug"/)
  assert.match(html, /Liên kết:/)
  const externalLink = html.match(
    /<a\b[^>]*href="https:\/\/anilist\.co\/manga\/1"[^>]*>AniList,<\/a>/
  )?.[0]
  assert.ok(externalLink)
  assert.match(externalLink, /target="_blank"/)
  assert.match(externalLink, /rel="noopener noreferrer"/)
  assert.match(html, /Đang tiến hành/)
  assert.match(html, /162\.700/)
  assert.match(html, /01:04 - 02\/01\/2026/)
  assert.match(html, /data-streamdown="strong"[^>]*>In đậm<\/span>/)
  assert.match(html, /Đăng nhập để theo dõi truyện/)
  assert.match(html, /loginto-follow\.webp/)
  assert.match(html, /cover\.512\.webp/)
  assert.match(html, /srcSet="[^"]+256w, [^"]+512w"/)
  assert.match(html, /sizes="\(min-width: 768px\) 244px, 300px"/)
  assert.equal((html.match(/doc-online\.webp/g) ?? []).length, 2)
  const readButtons = [
    ...html.matchAll(/<button\b[^>]*data-kind="(?:first|latest)"[^>]*>/g),
  ]
  assert.equal(readButtons.length, 2)
  for (const button of readButtons) assert.match(button[0], /\sdisabled=""/)
  const available = render(
    <MangaDetailView
      manga={{ ...manga, chapterCounts: { slots: 1, releases: 2 } }}
    />
  )
  const availableButtons = [
    ...available.matchAll(/<button\b[^>]*data-kind="(?:first|latest)"[^>]*>/g),
  ]
  assert.equal(availableButtons.length, 2)
  for (const button of availableButtons)
    assert.doesNotMatch(button[0], /\sdisabled=""/)
  assert.match(html, /ĐỌC ONLINE/)
  assert.match(html, /ĐỌC MỚI NHẤT/)
  assert.doesNotMatch(
    html,
    /Xem trước|XEM TRƯỚC|Nhân vật:|Doujinshi:|Thực hiện:|Theo dõi tại:/
  )
  assert.match(html, /DANH SÁCH CHƯƠNG/)
  assert.match(html, /Copy link truyện/)
  assert.match(html, /src="https:\/\/images\.example\.test\/group.webp"/)
  assert.deepEqual([...paths].sort(), [
    `/v1/manga/${id}`,
    `/v1/manga/${id}/chapters`,
  ])
  assert.match(html, /Truyện này chưa có chương nào/)
  assert.doesNotMatch(html, /href="\/chapter\//)
  assert.deepEqual(await mangaMetadata(props()), {
    title: manga.title,
    description: manga.description,
    alternates: { canonical: path },
  })
  await assert.rejects(
    MangaPageContent(
      props("wrong", id, { page: "2", direction: "asc", tab: "comments" })
    ),
    redirectTo(`${path}?page=2&direction=asc&tab=comments`)
  )
  await assert.rejects(
    MangaPageContent(props("old", "invalid-manga")),
    /NEXT_HTTP_ERROR_FALLBACK;404/
  )
  await assert.rejects(MangaRedirect(props()), redirectTo(path))
  await assert.rejects(
    MangaRedirect(props("", "invalid-manga", { page: "2" })),
    /NEXT_HTTP_ERROR_FALLBACK;404/
  )
  await assert.rejects(chapterContent({ page: "3" }), is404)
  missingChapters = true
  await assert.rejects(chapterContent(), is404)
  missingChapters = false
  const empty = render(
    <MangaDetailView
      manga={{
        ...manga,
        alternativeTitles: {},
        authors: [],
        artists: [],
        groups: [],
        links: [],
        tags: [],
        cover: null,
        status: null,
        description: null,
        statistics: { views: 0, follows: 0, comments: 0 },
      }}
    />
  )
  assert.doesNotMatch(empty, /Chưa có mô tả/)
  assert.doesNotMatch(empty, /Liên kết:/)
  assert.match(empty, /Chưa rõ trạng thái/)
  assert.match(empty, /Bìa truyện Truyện &lt;script&gt; chưa có ảnh/)
  const markdown = renderToStaticMarkup(
    <MangaDescription>
      {
        "**In đậm** và [liên kết](https://example.com).\n\n![Ẩn](https://example.com/unsafe.webp)\n\n<b>HTML</b>\n\n[Ẩn](javascript:alert(1))"
      }
    </MangaDescription>
  )
  assert.doesNotMatch(markdown, /<img|<b>|javascript:/)
  missing = true
  await assert.rejects(MangaPageContent(props()), is404)
  await assert.rejects(MangaRedirect(props()), is404)
  await assert.rejects(MangaPageContent(props("", "invalid-manga")), is404)
  assert.deepEqual(await mangaMetadata(props()), {
    title: "Không tìm thấy truyện",
  })
  missing = false
  unavailable = true
  await assert.rejects(MangaPageContent(props()), /503 UPSTREAM_ERROR/)
  await assert.rejects(MangaRedirect(props()), /503 UPSTREAM_ERROR/)
  assert.ok(
    paths.every(
      (value) =>
        value === `/v1/manga/${id}` || value === `/v1/manga/${id}/chapters`
    )
  )

  status = "authenticated"
  const itemKey = libraryItemKey(apiBaseUrl, "reader", id)
  client.setQueryData(itemKey, null)
  assert.match(
    render(<MangaLibraryAction mangaId={id} returnTo={path} />),
    /Theo dõi truyện/
  )
  const listKey = libraryListOptions(apiBaseUrl, "reader", "following").queryKey
  client.setQueryData(listKey, { pages: [], pageParams: [] })
  const item: LibraryItem = {
    manga,
    category: "following",
    createdAt: manga.createdAt,
    updatedAt: manga.updatedAt,
  }
  let failure = 0
  globalThis.fetch = (async (input, init) => {
    assert.equal(String(input), `${apiBaseUrl}/v1/me/library/${id}`)
    assert.equal(init?.credentials, "include")
    assert.equal(init?.cache, "no-store")
    assert.equal(new Headers(init?.headers).get("X-Internal-API-Key"), null)
    if (failure) return Response.json({}, { status: failure })
    if (init?.method === "DELETE") return new Response(null, { status: 204 })
    assert.equal(init?.method, "PUT")
    assert.deepEqual(JSON.parse(String(init.body)), { category: "following" })
    return Response.json({ data: item })
  }) as typeof fetch
  await capture().update.mutateAsync("following")
  assert.deepEqual(client.getQueryData(itemKey), item)
  assert.equal(client.getQueryState(listKey)?.isInvalidated, true)
  assert.match(
    render(<MangaLibraryAction mangaId={id} returnTo={path} />),
    /Theo dõi/
  )
  failure = 403
  await assert.rejects(
    capture().update.mutateAsync(null),
    (error: unknown) => error instanceof LibraryApiError && error.status === 403
  )
  assert.deepEqual(client.getQueryData(itemKey), item)
  assert.equal(feedback.at(-1)?.title, "Tài khoản không thể chỉnh sửa thư viện")
  profileStatus = "suspended"
  assert.match(
    render(<MangaLibraryAction mangaId={id} returnTo={path} />),
    /Tài khoản bị hạn chế/
  )
  profileStatus = "active"
  failure = 0
  await capture().update.mutateAsync(null)
  assert.equal(client.getQueryData(itemKey), null)
  status = "guest"
  await assert.rejects(
    capture().update.mutateAsync("following"),
    (error: unknown) => error instanceof LibraryApiError && error.status === 401
  )
  showLibraryLoginToast(path, (href) => destinations.push(href))
  feedback.at(-1)?.actionProps?.onClick()
  assert.equal(
    destinations.at(-1),
    `/login?returnTo=${encodeURIComponent(path)}`
  )
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  if (originalKey === undefined) delete process.env.INTERNAL_API_KEY
  else process.env.INTERNAL_API_KEY = originalKey
  client.clear()
}
console.log(
  "HVN manga metadata/cover, canonical routes, safe Markdown, reading buttons and library action checks passed"
)
