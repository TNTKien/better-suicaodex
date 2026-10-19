import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { groupPath } from "@workspace/catalog/routing"
import type { components } from "../src/lib/generated/api"

mock.module("server-only", () => ({}))
const cacheProfiles: string[] = []
mock.module("next/cache", () => ({
  io: async () => {},
  cacheLife: (profile: string) => cacheProfiles.push(profile),
}))
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
const originalKey = process.env.INTERNAL_API_KEY
process.env.API_URL = "https://catalog.example.test"
process.env.INTERNAL_API_KEY = "group-server-only-key"
const { GroupPageContent, groupMetadata } =
  await import("../modules/groups/group-page")
const { GroupInfo } = await import("../modules/groups/group-info")
const { GroupSkeleton } = await import("../modules/groups/group-skeleton")
const { CatalogResults } = await import("../modules/manga/catalog")
const id = "00000000-0000-4000-8000-000000000001"
const group: components["schemas"]["TranslationGroupDetail"] = {
  id,
  slug: "nhom-dich",
  name: "Nhóm <script>",
  avatarUrl: "https://images.test/group.webp",
  bannerUrl: null,
  createdAt: "2026-10-01T00:00:00Z",
  description: "Dòng một\nDòng hai <b>",
  leader: "Trưởng nhóm <b>",
  inactive: false,
  links: [
    { key: "facebook", label: "Facebook", url: "https://facebook.com/nhom" },
    { key: "discord", label: "Discord", url: "https://discord.gg/nhom" },
  ],
  statistics: {
    mangaCount: 12,
    chapterCount: 308,
    releaseCount: 999,
    views: 420681,
  },
}
const manga: components["schemas"]["MangaListItem"] = {
  id: "manga",
  slug: "truyen",
  title: "Truyện chưa có chương",
  alternativeTitles: { en: ["Tên khác", "Tên hai", "Tên ba"] },
  statistics: { follows: 42, comments: 0, views: 1234 },
  authors: [],
  tags: [],
  cover: {
    url: "https://images.test/cover.512.webp",
    width: 700,
    height: 1000,
  },
  status: "ongoing",
  description: null,
  contentRating: "safe",
  originalLanguage: "ja",
  latestChapter: null,
  latestChapterPublishedAt: null,
  year: 2026,
}
const path = groupPath(id, group.slug)
const requests: URL[] = []
let missing = false
let unavailable = false
let empty = false
function props(
  slug: string[] | undefined = [group.slug],
  page?: string | string[],
  requestedId = id
) {
  return {
    params: Promise.resolve({ id: requestedId, slug }),
    searchParams: Promise.resolve({ page }),
  }
}
const is404 = (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
const redirectTo = (url: string) => (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === `NEXT_REDIRECT;replace;${url};308;`
try {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    requests.push(url)
    assert.equal(url.origin, "https://catalog.example.test")
    assert.equal(
      new Headers(init?.headers).get("X-Internal-API-Key"),
      "group-server-only-key"
    )
    assert.equal(init?.redirect, "error")
    if (unavailable)
      return Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 })
    if (missing)
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
    if (url.pathname === `/v1/groups/${id}`) return Response.json(group)
    assert.equal(url.pathname, "/v1/manga")
    assert.deepEqual(url.searchParams.getAll("group"), [id])
    assert.equal(
      url.searchParams.get("hasChapter"),
      "all",
      "Match ReDive: include manga without chapters"
    )
    assert.equal(url.searchParams.get("sort"), "latestChapter")
    assert.equal(url.searchParams.get("direction"), "desc")
    assert.equal(url.searchParams.get("limit"), "36")
    for (const filter of ["author", "artist", "includeTag"])
      assert.deepEqual(url.searchParams.getAll(filter), [])
    return Response.json({
      data: empty ? [] : [manga],
      meta: {
        page: Number(url.searchParams.get("page") ?? 1),
        limit: 36,
        total: empty ? 0 : 72,
        totalPages: empty ? 0 : 2,
      },
    })
  }
  const page = await GroupPageContent(props())
  const shell = renderToStaticMarkup(page)
  assert.match(shell, /Trang chủ/)
  assert.match(shell, /<li>Nhóm dịch<\/li>/)
  assert.match(shell, /aria-current="page">Nhóm &lt;script&gt;/)
  assert.match(shell, /Danh sách truyện: Nhóm &lt;script&gt;/)
  assert.ok(
    shell.indexOf("group-info-heading") < shell.indexOf("Danh sách truyện:")
  )
  assert.match(shell, /group\.webp/)
  assert.match(shell, /rounded-full/)
  assert.match(shell, /Trưởng nhóm: <\/span>Trưởng nhóm &lt;b&gt;/)
  assert.match(shell, /Dòng một\nDòng hai &lt;b&gt;/)
  assert.match(shell, /Lượt xem: <\/span>420\.681/)
  assert.match(shell, /Số truyện: <\/span>12/)
  assert.match(shell, /Số chương: <\/span>308/)
  assert.doesNotMatch(
    shell,
    /Phó nhóm|Ngân sách|Top tuần|Lượt thích|Danh sách thành viên|999|<script>/
  )
  for (const link of group.links) {
    const anchor = shell.match(
      new RegExp(`<a[^>]*href="${link.url}"[^>]*>`)
    )?.[0]
    assert.ok(anchor)
    assert.match(anchor, /target="_blank"/)
    assert.match(anchor, /rel="noopener noreferrer"/)
  }
  assert.deepEqual(await groupMetadata(props()), {
    title: group.name,
    alternates: { canonical: path },
  })
  for (const slug of [["cu"], [], [group.slug, "thua"]]) {
    await assert.rejects(
      GroupPageContent(props(slug, "2")),
      redirectTo(`${path}?page=2`)
    )
  }
  await assert.rejects(
    GroupPageContent(props([], ["02", "3"])),
    redirectTo(`${path}?page=2`)
  )
  const bare = {
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  }
  await assert.rejects(GroupPageContent(bare), redirectTo(path))
  const beforeInvalid = requests.length
  await assert.rejects(
    GroupPageContent(props([group.slug], undefined, "123")),
    is404
  )
  assert.deepEqual(await groupMetadata(props([group.slug], undefined, "123")), {
    title: "Không tìm thấy nhóm dịch",
  })
  assert.equal(
    requests.length,
    beforeInvalid,
    "Invalid ids must never request the group API"
  )
  const html = renderToStaticMarkup(
    await CatalogResults({
      ...page.props,
      searchParams: Promise.resolve({ page: "2" }),
    })
  )
  assert.match(html, /Truyện chưa có chương/)
  assert.match(html, /Tên khác; Tên hai/)
  assert.doesNotMatch(html, /Tên ba|manga-grid-all/)
  assert.match(html, /cover\.256\.webp/)
  assert.match(html, /hvn-pagination/)
  assert.ok(html.includes(`href="${path}"`))
  assert.ok(html.includes(`href="${path}?page=2"`))
  await assert.rejects(
    CatalogResults({
      ...page.props,
      searchParams: Promise.resolve({ page: "3" }),
    }),
    is404
  )
  empty = true
  const noData = renderToStaticMarkup(await CatalogResults(page.props))
  assert.match(noData, /Không có truyện nào/)
  assert.doesNotMatch(noData, /hvn-pagination/)
  empty = false
  const noInfo = renderToStaticMarkup(
    <GroupInfo
      group={{
        ...group,
        avatarUrl: null,
        description: null,
        leader: null,
        links: [],
        statistics: {
          mangaCount: 0,
          chapterCount: 0,
          releaseCount: 0,
          views: 0,
        },
      }}
    />
  )
  assert.match(noInfo, /mac_dinh\.webp/)
  assert.match(noInfo, /Chưa xác định/)
  assert.match(noInfo, /Số truyện: <\/span>0/)
  assert.match(noInfo, /Số chương: <\/span>0/)
  assert.doesNotMatch(noInfo, /<a\b|Dòng một/)
  const loading = renderToStaticMarkup(<GroupSkeleton />)
  assert.match(loading, /aria-label="Đang tải nhóm dịch"/)
  assert.match(loading, /data-slot="skeleton"/)
  missing = true
  await assert.rejects(GroupPageContent(props()), is404)
  assert.deepEqual(await groupMetadata(props()), {
    title: "Không tìm thấy nhóm dịch",
  })
  missing = false
  unavailable = true
  await assert.rejects(GroupPageContent(props()), /503 UNAVAILABLE/)
  assert.ok(
    cacheProfiles.length > 0 &&
      cacheProfiles.every((profile) => profile === "seconds")
  )
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  if (originalKey === undefined) delete process.env.INTERNAL_API_KEY
  else process.env.INTERNAL_API_KEY = originalKey
}
console.log(
  "HVN group info, shared API/cache, horizontal list, pagination, canonical routes and errors passed"
)
