import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock, setSystemTime } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { MangaCard, MangaSection } from "../modules/home/manga-section"
import type { MangaSummary } from "../modules/home/api"
import { TopView, TopViewResult } from "../modules/home/top-view"
import { TopGroups, TopGroupsResult } from "../modules/home/top-groups"
import {
  RecentComments,
  type RecentComment,
} from "../modules/home/recent-comments"
import {
  topGroupsOptions,
  topViewOptions,
  type GroupRanking,
  type MangaRanking,
} from "../modules/home/ranking"

mock.module("server-only", () => ({}))
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
const originalInternalApiKey = process.env.INTERNAL_API_KEY
process.env.API_URL = "https://server.example.test"
process.env.INTERNAL_API_KEY = "home-test-server-only-key"
const { getHomeCatalog } = await import("../modules/home/api")
const { catalogRequest, CatalogApiError } =
  await import("@workspace/catalog/server")

const manga: MangaSummary = {
  id: "manga-id",
  slug: "ten-truyen",
  title: "Tên truyện <script>",
  cover: {
    url: "https://images.example.test/cover.512.webp",
    width: 700,
    height: 1000,
  },
  authors: [{ id: "author-id", slug: "tac-gia", name: "Tác giả & cộng sự" }],
  contentRating: "safe",
  description: null,
  latestChapter: {
    id: "chapter-id",
    number: "9.5",
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
const rankedManga = {
  ...manga,
  id: "featured-id",
  slug: "tieu-diem",
  title: "Truyện tiêu điểm",
}
const recentManga = { ...manga, id: "recent-id", title: "Truyện mới đăng" }
const randomManga = {
  ...manga,
  id: "random-id",
  title: "Truyện ngẫu nhiên",
  tags: [
    {
      id: "tag-id",
      slug: "romance",
      name: "Tình cảm",
      group: "genre" as const,
    },
  ],
}
const topRanking: MangaRanking = {
  data: [
    {
      manga: rankedManga,
      rank: 1,
      views: 12345,
      follows: 5,
      comments: 2,
      score: null,
    },
    { manga, rank: 2, views: 0, follows: 0, comments: 0, score: null },
  ],
  meta: {
    activeSignals: { views: true, follows: true, comments: true },
    bucketDate: "2026-10-14",
    calculatedAt: "2026-10-14T00:00:00Z",
    insufficientData: false,
    limit: 10,
    metric: "views",
    window: "day",
  },
}
const groupRanking: GroupRanking = {
  data: Array.from({ length: 5 }, (_, index) => ({
    group: {
      id: `group-${index}`,
      slug: `nhom-${index}`,
      name: `Nhóm ${index}`,
      avatarUrl: null,
      inactive: false,
    },
    rank: index + 1,
    views: index === 0 ? 12345 : 0,
    chapters: 2,
    releases: 1,
    score: 10 - index,
  })),
  meta: {
    bucketDate: "2026-10-14",
    calculatedAt: "2026-10-14T00:00:00Z",
    limit: 5,
    window: "day",
  },
}
const comments: RecentComment[] = Array.from({ length: 6 }, (_, index) => ({
  id: `comment-${index}`,
  author: {
    id: `user-${index}`,
    name: `Người ${index}`,
    image: [
      "https://images.example.test/avatar.webp",
      "https://lh3.googleusercontent.com/a/default-initials=s96-c",
      "https://lh3.googleusercontent.com/a-/real-profile-photo=s96-c",
      null,
      "",
      "https://lh4.googleusercontent.com/a/default-initials=s96-c",
    ][index]!,
    avatarFrame: {
      id: "frame-id",
      name: "Khung",
      assetUrl: "https://images.example.test/frame.webp",
      previewUrl: "https://images.example.test/frame-preview.webp",
      width: 128,
      height: 128,
      animated: false,
      displayScale: 1,
      offsetX: 0,
      offsetY: 0,
    },
  },
  body: "Nội dung <script>alert(1)</script>",
  createdAt: "2026-10-14T00:00:00Z",
  manga: { id: manga.id, slug: manga.slug, title: manga.title },
  chapter:
    index === 0 ? { id: "chapter-id", number: "9.5", title: null } : null,
}))
const requests: string[] = []
let rankingEmpty = false
let latestEmpty = false
let rankingFails = false
let latestFails = false
let recentFails = false
let recentEmpty = false
let topViewFails = false
let groupsFail = false
let commentsFail = false
let randomFail = false
let randomEmpty = false
function responseFor(path: string) {
  if (path.startsWith("/v1/manga/random?"))
    return randomFail
      ? Response.json({}, { status: 503 })
      : Response.json({ data: randomEmpty ? [] : [randomManga] })
  if (path.startsWith("/v1/rankings/groups?"))
    return groupsFail
      ? Response.json({}, { status: 503 })
      : Response.json(groupRanking)
  if (path.startsWith("/v1/comments/recent?"))
    return commentsFail
      ? Response.json({}, { status: 503 })
      : Response.json({ data: comments })
  if (path.includes("metric=views")) {
    return topViewFails
      ? Response.json({}, { status: 503 })
      : Response.json(topRanking)
  }
  if (path.includes("sort=publishedAt")) {
    return recentFails
      ? Response.json({}, { status: 503 })
      : Response.json({
          data: recentEmpty ? [] : [recentManga],
          meta: { page: 1, limit: 6, total: 1, totalPages: 1 },
        })
  }
  if (path.startsWith("/v1/rankings/manga?")) {
    if (rankingFails)
      return Response.json(
        { error: { code: "UPSTREAM_ERROR" } },
        { status: 503 }
      )
    return Response.json({ data: rankingEmpty ? [] : [{ manga: rankedManga }] })
  }
  if (latestFails)
    return Response.json({ error: { code: "UPSTREAM_ERROR" } }, { status: 503 })
  return Response.json({
    data: latestEmpty ? [] : [manga],
    meta: { page: 1, limit: 18, total: 1, totalPages: 1 },
  })
}
try {
  const releases: (() => void)[] = []
  globalThis.fetch = ((input, init) =>
    new Promise<Response>((resolve) => {
      const url = new URL(String(input))
      const path = url.pathname + url.search
      requests.push(path)
      assert.equal(url.origin, "https://server.example.test")
      assert.equal(
        new Headers(init?.headers).get("X-Internal-API-Key"),
        "home-test-server-only-key"
      )
      assert.equal(init?.redirect, "error")
      assert.notEqual(init?.credentials, "include")
      releases.push(() => resolve(responseFor(path)))
    })) as typeof fetch
  const pending = getHomeCatalog()
  assert.deepEqual(
    requests,
    [
      "/v1/manga?sort=latestChapter&direction=desc&limit=18",
      "/v1/rankings/manga?metric=score&window=week&limit=6",
      "/v1/manga?sort=publishedAt&direction=desc&limit=6",
      "/v1/rankings/manga?metric=views&window=day&limit=10",
      "/v1/rankings/groups?window=day&limit=5",
      "/v1/comments/recent?limit=6",
      "/v1/manga/random?limit=6",
    ],
    "All homepage requests start before waiting for any response"
  )
  releases.forEach((release) => release())
  const result = await pending
  assert.deepEqual(result, {
    latest: [manga],
    featured: [rankedManga],
    recent: [recentManga],
    recentError: false,
    initialRanking: topRanking,
    initialGroupRanking: groupRanking,
    comments,
    commentsError: false,
    latestError: false,
    featuredError: false,
    random: [randomManga],
    randomError: false,
  })

  globalThis.fetch = (async (input) => {
    const url = new URL(String(input))
    return responseFor(url.pathname + url.search)
  }) as typeof fetch
  recentFails = true
  topViewFails = true
  groupsFail = true
  commentsFail = true
  randomFail = true
  const degradedNewSections = await getHomeCatalog()
  assert.deepEqual(degradedNewSections.latest, [manga])
  assert.deepEqual(degradedNewSections.featured, [rankedManga])
  assert.equal(degradedNewSections.recentError, true)
  assert.deepEqual(degradedNewSections.recent, [])
  assert.equal(degradedNewSections.initialRanking, undefined)
  assert.equal(degradedNewSections.initialGroupRanking, undefined)
  assert.deepEqual(degradedNewSections.comments, [])
  assert.equal(degradedNewSections.commentsError, true)
  assert.equal(degradedNewSections.randomError, true)
  assert.deepEqual(degradedNewSections.random, [])
  recentFails = false
  topViewFails = false
  groupsFail = false
  commentsFail = false
  randomFail = false
  rankingEmpty = true
  assert.deepEqual((await getHomeCatalog()).featured, [manga])
  rankingEmpty = false
  rankingFails = true
  const degradedRanking = await getHomeCatalog()
  assert.deepEqual(degradedRanking.featured, [manga])
  assert.equal(degradedRanking.featuredError, false)
  rankingFails = false
  latestFails = true
  const degradedLatest = await getHomeCatalog()
  assert.deepEqual(degradedLatest.featured, [rankedManga])
  assert.equal(degradedLatest.latestError, true)
  rankingFails = true
  const unavailable = await getHomeCatalog()
  assert.equal(unavailable.latestError, true)
  assert.equal(unavailable.featuredError, true)
  latestFails = false
  rankingFails = false
  latestEmpty = true
  rankingEmpty = true
  recentEmpty = true
  randomEmpty = true
  assert.deepEqual(await getHomeCatalog(), {
    latest: [],
    featured: [],
    recent: [],
    recentError: false,
    initialRanking: topRanking,
    initialGroupRanking: groupRanking,
    comments,
    commentsError: false,
    latestError: false,
    featuredError: false,
    random: [],
    randomError: false,
  })
  globalThis.fetch = (async () => new Response("invalid-json")) as typeof fetch
  await assert.rejects(
    catalogRequest("/v1/manga"),
    (error: unknown) => error instanceof CatalogApiError && error.status === 502
  )
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  if (originalInternalApiKey === undefined) delete process.env.INTERNAL_API_KEY
  else process.env.INTERNAL_API_KEY = originalInternalApiKey
}

const router = {
  bfcacheId: "home-test",
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch() {},
}
function section(props: Parameters<typeof MangaSection>[0]) {
  return renderToStaticMarkup(
    <AppRouterContext value={router}>
      <MangaSection {...props} />
    </AppRouterContext>
  )
}
const featured = section({ kind: "featured", manga: [rankedManga] })
assert.match(featured, /<h1[^>]*>.*Thịnh hành<\/h1>/)
assert.match(featured, /href="\/manga\/featured-id\/tieu-diem"/)
assert.doesNotMatch(featured, /Cách hiển thị truyện/)
const latest = section({ kind: "latest", manga: [manga] })
assert.match(latest, /Mới cập nhật/)
assert.match(latest, /Tên truyện &lt;script&gt;/)
assert.match(latest, /Ch\. 9\.5/)
assert.match(latest, /src="https:\/\/images\.example\.test\/cover\.512\.webp"/)
assert.match(latest, /srcSet="[^"]+256w, [^"]+512w"/)
assert.match(latest, /sizes="auto, [^"]+"/)
assert.match(latest, /loading="lazy"/)
assert.doesNotMatch(latest, /Tác giả &amp; cộng sự/)
assert.match(latest, /href="\/latest"/)
assert.doesNotMatch(latest, /Cách hiển thị truyện|aria-pressed/)
assert.doesNotMatch(latest, /<script>|home-test-server-only-key/)
assert.doesNotMatch(latest, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/)
const recent = section({ kind: "recent", manga: [recentManga] })
assert.match(recent, /Truyện mới đăng/)
assert.match(recent, /src="https:\/\/images\.example\.test\/cover\.256\.webp"/)
assert.match(recent, /href="\/recent"/)
assert.match(recent, /href="\/chapter\/chapter-id"/)
assert.match(recent, /Giờ đăng:/)
assert.match(recent, /<time dateTime="2026-10-14T00:00:00Z">07:00 \(/)
assert.doesNotMatch(recent, /Tác giả:/)
assert.doesNotMatch(recent, /<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<a\b/)
assert.match(
  section({ kind: "recent", manga: [], error: true }),
  /Không tải được truyện mới đăng/
)
assert.match(section({ kind: "recent", manga: [] }), /Chưa có truyện/)
/* eslint-disable turbo/no-undeclared-env-vars -- Test both host time zones without making TZ an application setting. */
const originalTimeZone = process.env.TZ
try {
  for (const timeZone of ["UTC", "America/Los_Angeles"]) {
    process.env.TZ = timeZone
    for (const [publishedAt, now, expected] of [
      ["2026-10-14T14:30:00Z", "2026-10-14T15:25:00Z", "21:30 (55 phút trước)"],
      ["2026-10-14T18:30:00Z", "2026-10-14T19:25:00Z", "01:30 (55 phút trước)"],
      ["2026-11-01T08:30:00Z", "2026-11-01T09:30:00Z", "15:30 (1 giờ trước)"],
    ] as const) {
      setSystemTime(new Date(now))
      const markup = section({
        kind: "recent",
        manga: [
          { ...manga, latestChapter: { ...manga.latestChapter!, publishedAt } },
        ],
      })
      assert.ok(markup.includes(expected), `${timeZone}: ${expected}`)
    }
  }
} finally {
  setSystemTime()
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
}
/* eslint-enable turbo/no-undeclared-env-vars */
const recentWithoutChapter = section({
  kind: "recent",
  manga: [{ ...manga, latestChapter: null }],
})
assert.match(recentWithoutChapter, /Giờ đăng:<\/span> Chưa rõ/)
assert.doesNotMatch(recentWithoutChapter, /<time/)
const oneshot = renderToStaticMarkup(
  <MangaCard
    manga={{
      ...manga,
      latestChapter: { ...manga.latestChapter!, number: null },
    }}
  />
)
assert.match(oneshot, /Oneshot/)
const missing = renderToStaticMarkup(
  <MangaCard manga={{ ...manga, cover: null, latestChapter: null }} />
)
assert.match(missing, /chưa có ảnh/)
assert.match(missing, /Chưa có chương/)
assert.match(section({ kind: "latest", manga: [] }), /Chưa có truyện/)
const randomSection = section({ kind: "random", manga: [randomManga] })
assert.match(randomSection, /Truyện ngẫu nhiên/)
assert.match(randomSection, /cover\.256\.webp/)
assert.match(randomSection, /href="\/tag\/tag-id\/romance"/)
assert.match(randomSection, /Tình cảm/)
assert.doesNotMatch(randomSection, /Xem thêm|Giờ đăng:/)
assert.match(
  section({ kind: "random", manga: [], error: true }),
  /Không tải được truyện ngẫu nhiên[\s\S]*Thử lại/
)
assert.equal(
  (
    section({ kind: "random", manga: [], loading: true }).match(
      /data-slot="skeleton"/g
    ) ?? []
  ).length,
  12
)
assert.match(
  section({ kind: "latest", manga: [], error: true }),
  /Không tải được mới cập nhật[\s\S]*Thử lại/
)
const loading = section({ kind: "featured", manga: [], loading: true })
assert.match(loading, /aria-busy="true"/)
assert.equal((loading.match(/data-slot="skeleton"/g) ?? []).length, 12)

const queryClient = new QueryClient()
let rankingRequests = 0
try {
  globalThis.fetch = (async (input, init) => {
    rankingRequests++
    const url = new URL(String(input))
    assert.equal(url.origin, "https://api.example.test")
    assert.equal(url.pathname, "/v1/rankings/manga")
    assert.equal(url.searchParams.get("metric"), "views")
    assert.equal(url.searchParams.get("limit"), "10")
    assert.equal(init?.credentials, "omit")
    assert.equal(new Headers(init?.headers).has("X-Internal-API-Key"), false)
    assert.ok(init?.signal instanceof AbortSignal)
    return Response.json({
      ...topRanking,
      meta: { ...topRanking.meta, window: url.searchParams.get("window") },
    })
  }) as typeof fetch
  for (const window of ["day", "week", "month", "all-time"] as const) {
    const options = topViewOptions("https://api.example.test", window)
    assert.equal(options.staleTime, 90_000)
    assert.equal(options.retry, false)
    assert.equal(options.refetchOnWindowFocus, false)
    assert.equal((await queryClient.fetchQuery(options)).meta.window, window)
  }
  assert.equal(rankingRequests, 4)
  assert.equal(
    (
      await queryClient.fetchQuery(
        topViewOptions("https://api.example.test", "day")
      )
    ).meta.window,
    "day"
  )
  assert.equal(
    rankingRequests,
    4,
    "Returning to a fresh period uses its own cached ranking"
  )
  for (const response of [
    new Response("invalid-json"),
    Response.json({ data: {} }),
    Response.json(topRanking, { status: 503 }),
  ]) {
    queryClient.clear()
    globalThis.fetch = (async () => response) as typeof fetch
    await assert.rejects(
      queryClient.fetchQuery(topViewOptions("https://api.example.test", "day")),
      /Không thể tải bảng xếp hạng/
    )
  }
  queryClient.clear()
  const top = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <TopView
        apiBaseUrl="https://api.example.test"
        initialRanking={topRanking}
      />
    </QueryClientProvider>
  )
  assert.equal((top.match(/role="tab"/g) ?? []).length, 4)
  assert.match(top, /Ngày/)
  assert.match(top, /Tuần/)
  assert.match(top, /Tháng/)
  assert.match(top, /Tất cả/)
  assert.match(top, /role="tabpanel"/)
  assert.match(top, /href="\/manga\/featured-id\/tieu-diem"/)
  assert.match(top, /12\.345 views/)
  assert.doesNotMatch(top, /href="\/manga\/manga-id\/ten-truyen"/)
  const refetch = async () => {
    throw new Error("Not invoked during SSR")
  }
  assert.match(
    renderToStaticMarkup(
      <TopViewResult
        ranking={{ data: undefined, isPending: true, isError: false, refetch }}
      />
    ),
    /Đang tải Top view/
  )
  assert.match(
    renderToStaticMarkup(
      <TopViewResult
        ranking={{ data: undefined, isPending: false, isError: true, refetch }}
      />
    ),
    /Không thể tải bảng xếp hạng[\s\S]*Thử lại/
  )
  assert.match(
    renderToStaticMarkup(
      <TopViewResult
        ranking={{
          data: { ...topRanking, data: [] },
          isPending: false,
          isError: false,
          refetch,
        }}
      />
    ),
    /Chưa có dữ liệu/
  )
} finally {
  queryClient.clear()
  globalThis.fetch = originalFetch
}

try {
  let groupRequests = 0
  globalThis.fetch = (async (input, init) => {
    groupRequests++
    const url = new URL(String(input))
    assert.equal(url.origin, "https://api.example.test")
    assert.equal(url.pathname, "/v1/rankings/groups")
    assert.equal(url.searchParams.get("limit"), "5")
    assert.equal(init?.credentials, "omit")
    assert.equal(new Headers(init?.headers).has("X-Internal-API-Key"), false)
    assert.ok(init?.signal instanceof AbortSignal)
    return Response.json({
      ...groupRanking,
      meta: { ...groupRanking.meta, window: url.searchParams.get("window") },
    })
  }) as typeof fetch
  for (const window of ["day", "week", "month", "all-time"] as const) {
    const options = topGroupsOptions("https://api.example.test", window)
    assert.equal(options.staleTime, 90_000)
    assert.equal(options.retry, false)
    assert.equal(options.refetchOnWindowFocus, false)
    assert.equal((await queryClient.fetchQuery(options)).meta.window, window)
  }
  await queryClient.fetchQuery(
    topGroupsOptions("https://api.example.test", "day")
  )
  assert.equal(groupRequests, 4, "Each group period has its own cache")
  for (const response of [
    new Response("invalid-json"),
    Response.json({ data: {} }),
    Response.json(groupRanking, { status: 503 }),
  ]) {
    queryClient.clear()
    globalThis.fetch = (async () => response) as typeof fetch
    await assert.rejects(
      queryClient.fetchQuery(
        topGroupsOptions("https://api.example.test", "day")
      ),
      /Không thể tải bảng xếp hạng nhóm dịch/
    )
  }
  queryClient.clear()
  const groups = renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <TopGroups
        apiBaseUrl="https://api.example.test"
        initialRanking={groupRanking}
      />
    </QueryClientProvider>
  )
  assert.equal((groups.match(/role="tab"/g) ?? []).length, 4)
  assert.equal((groups.match(/<li /g) ?? []).length, 5)
  assert.match(groups, /href="\/group\/group-0\/nhom-0"/)
  assert.match(groups, /12\.345 views/)
  assert.match(
    groups,
    /0 views/,
    "Keep groups with zero views like Re:Dive"
  )
  const refetch = async () => {
    throw new Error("Not invoked during SSR")
  }
  for (const [state, expected] of [
    [
      { data: undefined, isPending: true, isError: false },
      /Đang tải Top 5 nhóm/,
    ],
    [
      { data: undefined, isPending: false, isError: true },
      /Không thể tải bảng xếp hạng nhóm dịch[\s\S]*Thử lại/,
    ],
    [
      { data: { ...groupRanking, data: [] }, isPending: false, isError: false },
      /Chưa có dữ liệu/,
    ],
  ] satisfies [
    Omit<Parameters<typeof TopGroupsResult>[0]["ranking"], "refetch">,
    RegExp,
  ][]) {
    assert.match(
      renderToStaticMarkup(<TopGroupsResult ranking={{ ...state, refetch }} />),
      expected
    )
  }
} finally {
  queryClient.clear()
  globalThis.fetch = originalFetch
}

function renderComments(props: Parameters<typeof RecentComments>[0]) {
  return renderToStaticMarkup(
    <AppRouterContext value={router}>
      <RecentComments {...props} />
    </AppRouterContext>
  )
}
try {
  setSystemTime(new Date("2026-10-14T00:01:00Z"))
  const html = renderComments({ comments })
  assert.equal((html.match(/<li /g) ?? []).length, 6)
  assert.match(html, /src="https:\/\/images.example.test\/avatar.webp"/)
  assert.equal((html.match(/src="\/brand\/mac_dinh.webp"/g) ?? []).length, 4)
  assert.match(
    html,
    /src="https:\/\/lh3.googleusercontent.com\/a-\/real-profile-photo=s96-c"/
  )
  assert.doesNotMatch(html, /default-initials/)
  assert.doesNotMatch(html, /frame\.webp|frame-preview\.webp/)
  assert.match(html, /href="\/profile\/user-0"/)
  assert.match(html, /href="\/chapter\/chapter-id"/)
  assert.match(html, /href="\/manga\/manga-id\/ten-truyen"/)
  assert.match(html, /1 phút trước/)
  assert.match(html, /Nội dung &lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(
    renderComments({ comments: [], error: true }),
    /Không thể tải bình luận mới[\s\S]*Thử lại/
  )
  assert.match(renderComments({ comments: [] }), /Chưa có bình luận nào/)
  const skeleton = renderComments({ comments: [], loading: true })
  assert.match(skeleton, /Đang tải bình luận mới/)
  assert.equal((skeleton.match(/data-slot="skeleton"/g) ?? []).length, 6)
} finally {
  setSystemTime()
}

console.log(
  "web-hvn home catalog, ranking periods/cache, fallback and UI checks passed"
)
