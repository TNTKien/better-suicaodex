import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import {
  personPath,
  personRoleLabels,
  type PersonRole,
} from "@workspace/catalog/routing"
import type { components } from "../src/lib/generated/api"

mock.module("server-only", () => ({}))
mock.module("next/cache", () => ({ io: async () => {} }))
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
const originalKey = process.env.INTERNAL_API_KEY
process.env.API_URL = "https://catalog.example.test"
process.env.INTERNAL_API_KEY = "person-server-only-key"
const { PersonPageContent, PersonRedirect, getPersonMetadata } =
  await import("../modules/manga/person-page")
const { CatalogResults } = await import("../modules/manga/catalog")
const id = "00000000-0000-4000-8000-000000000001"
const person: components["schemas"]["PersonDetail"] = {
  id,
  slug: "ten-nguoi",
  name: "Tên <script>",
  description: "Giới thiệu",
  links: [],
  roles: ["author", "artist"],
}
const manga: components["schemas"]["MangaListItem"] = {
  id: "manga",
  slug: "truyen",
  title: "Truyện <b>",
  alternativeTitles: { en: ["Tên khác", "Tên hai", "Tên ba"] },
  statistics: { follows: 42, comments: 0, views: 1234 },
  authors: [{ id, name: person.name, slug: person.slug }],
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
let expectedRole: PersonRole = "author"
let roles = person.roles
let missing = false
let unavailable = false
let empty = false
const requests: URL[] = []
function props(
  role: PersonRole,
  slug = person.slug,
  page?: string | string[],
  requestedId = id
) {
  return {
    role,
    params: Promise.resolve({ id: requestedId, slug }),
    searchParams: Promise.resolve({ page }),
  }
}
const is404 = (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
const redirectTo = (path: string) => (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === `NEXT_REDIRECT;replace;${path};308;`
try {
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    requests.push(url)
    assert.equal(url.origin, "https://catalog.example.test")
    assert.equal(
      new Headers(init?.headers).get("X-Internal-API-Key"),
      "person-server-only-key"
    )
    assert.equal(init?.redirect, "error")
    if (unavailable)
      return Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 })
    if (missing)
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
    if (url.pathname === `/v1/people/${id}`)
      return Response.json({ ...person, roles })
    assert.equal(url.pathname, "/v1/manga")
    assert.deepEqual(url.searchParams.getAll(expectedRole), [id])
    assert.deepEqual(
      url.searchParams.getAll(expectedRole === "author" ? "artist" : "author"),
      []
    )
    assert.deepEqual(url.searchParams.getAll("includeTag"), [])
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
  }
  for (const role of ["author", "artist"] as const) {
    expectedRole = role
    const path = personPath(role, id, person.slug)
    const page = await PersonPageContent(props(role))
    const shell = renderToStaticMarkup(page)
    assert.match(shell, /Trang chủ/)
    assert.ok(shell.includes(personRoleLabels[role]))
    assert.match(shell, /aria-current="page">Tên &lt;script&gt;/)
    assert.match(shell, /Danh sách truyện: Tên &lt;script&gt;/)
    assert.doesNotMatch(
      shell,
      /Các truyện thuộc thể loại|the-loai-mac-dinh|Giới thiệu/
    )
    assert.deepEqual(page.props.person, { id, name: person.name, role })
    assert.deepEqual(await getPersonMetadata(role, props(role).params), {
      title: `${personRoleLabels[role]}: ${person.name}`,
      description: person.description,
      alternates: { canonical: path },
    })
    await assert.rejects(
      PersonPageContent(props(role, "sai-slug", "2")),
      redirectTo(`${path}?page=2`)
    )
    await assert.rejects(
      PersonPageContent(props(role, "sai-slug", ["02", "3"])),
      redirectTo(`${path}?page=2`)
    )
    await assert.rejects(
      PersonPageContent(props(role, "cu", "2", "123")),
      /NEXT_HTTP_ERROR_FALLBACK;404/
    )
    const redirect = PersonRedirect(props(role, "", "2", "123")).props.children
    await assert.rejects(
      redirect.type(redirect.props),
      /NEXT_HTTP_ERROR_FALLBACK;404/
    )
    const html = renderToStaticMarkup(
      await CatalogResults({
        ...page.props,
        searchParams: Promise.resolve({ page: "2" }),
      })
    )
    assert.match(html, /Truyện &lt;b&gt;/)
    assert.match(html, /Tên khác; Tên hai/)
    assert.doesNotMatch(html, /Tên ba|manga-grid-all/)
    assert.match(html, /cover\.256\.webp/)
    assert.match(html, /Theo dõi: <\/span>42/)
    assert.match(html, /Lượt xem: <\/span>1\.234/)
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
    await assert.rejects(
      CatalogResults({
        ...page.props,
        searchParams: Promise.resolve({ page: "2" }),
      }),
      is404
    )
    empty = false
    roles = [role === "author" ? "artist" : "author"]
    await assert.rejects(PersonPageContent(props(role)), is404)
    assert.deepEqual(await getPersonMetadata(role, props(role).params), {
      title: `Không tìm thấy ${personRoleLabels[role]}`,
    })
    roles = person.roles
    missing = true
    await assert.rejects(PersonPageContent(props(role)), is404)
    await assert.rejects(
      PersonPageContent(props(role, "", undefined, "123")),
      /NEXT_HTTP_ERROR_FALLBACK;404/
    )
    missing = false
    unavailable = true
    await assert.rejects(PersonPageContent(props(role)), /503 UNAVAILABLE/)
    unavailable = false
    const beforeMetadata = requests.length
    assert.deepEqual(
      await getPersonMetadata(role, props(role, "", undefined, "123").params),
      { title: `Không tìm thấy ${personRoleLabels[role]}` }
    )
    assert.equal(
      requests.length,
      beforeMetadata,
      "Metadata must not fetch an invalid person ID"
    )
  }
  assert.equal(
    personPath("author", "id/1", "Tên / #"),
    "/author/id%2F1/T%C3%AAn%20%2F%20%23"
  )
  assert.ok(requests.some(({ pathname }) => pathname === `/v1/people/${id}`))
  assert.ok(
    requests.every(
      ({ pathname }) =>
        pathname === `/v1/people/${id}` || pathname === "/v1/manga"
    )
  )
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  if (originalKey === undefined) delete process.env.INTERNAL_API_KEY
  else process.env.INTERNAL_API_KEY = originalKey
}
console.log(
  "HVN author/artist filtering, breadcrumbs, horizontal cards, pagination, canonical routes and errors passed"
)
