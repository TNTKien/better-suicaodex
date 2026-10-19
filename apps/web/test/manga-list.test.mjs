import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mock } from "bun:test"
import { QueryClient } from "@tanstack/react-query"
import { renderToStaticMarkup } from "react-dom/server"

mock.module("server-only", () => ({}))
mock.module("next/cache", () => ({
  cacheLife: (profile) => {
    if (typeof profile === "object") assert.deepEqual(profile, { stale: 30 })
    else assert.ok(["seconds", "hours"].includes(profile))
  },
}))

const internalApiKey = "internal-web-test-key-".padEnd(32, "x")
const originalInternalApiKey = globalThis.Bun.env.INTERNAL_API_KEY
globalThis.Bun.env.INTERNAL_API_KEY = internalApiKey
const {
  getGroupRanking,
  getRecentComments,
  getRandomManga,
  getManga,
  getMangaChapters,
  getMangaList,
  getMangaRanking,
  getPerson,
  getTag,
} = await import("../lib/api.ts")
const { groupRankingOptions } = await import("../modules/groups/ranking.ts")
const { mangaRankingOptions } = await import("../modules/manga/ranking.ts")
const originalFetch = globalThis.fetch
const queryClient = new QueryClient()
const requests = []
const response = {
  data: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
}
const apiSource = readFileSync(
  new URL("../lib/api.ts", import.meta.url),
  "utf8"
)

function functionSource(name) {
  const start = apiSource.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `${name} must exist`)
  const next = apiSource.indexOf("\nexport async function ", start + 1)
  return apiSource.slice(start, next === -1 ? undefined : next)
}

try {
  for (const name of [
    "getPerson",
    "getMangaList",
    "getMangaRanking",
    "getGroupRanking",
    "getRecentComments",
    "getRandomManga",
    "getManga",
    "getMangaRecommendations",
    "getMangaChapters",
    "getChapter",
    "getTags",
    "getTag",
  ]) {
    assert.doesNotMatch(functionSource(name), /["']use cache["']/)
  }

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    assert.equal(
      new Headers(init?.headers).get("x-internal-api-key"),
      internalApiKey
    )
    assert.equal(init?.redirect, "error")
    return Response.json(response)
  }

  const results = await Promise.all([
    getMangaList(),
    getMangaList({ sort: "publishedAt", direction: "desc", limit: 10 }),
    getMangaList({ limit: 36, page: 2 }),
  ])
  assert.deepEqual(requests, [
    "/v1/manga?sort=latestChapter&direction=desc&limit=20",
    "/v1/manga?sort=publishedAt&direction=desc&limit=10",
    "/v1/manga?sort=latestChapter&direction=desc&limit=36&page=2",
  ])
  assert.deepEqual(results, [response, response, response])

  requests.length = 0
  await getMangaChapters("manga-id")
  await getMangaChapters("manga-id", 2, "asc")
  assert.deepEqual(requests, [
    "/v1/manga/manga-id/chapters?sort=volume&direction=desc&limit=20&page=1",
    "/v1/manga/manga-id/chapters?sort=volume&direction=asc&limit=20&page=2",
  ])

  requests.length = 0
  assert.deepEqual(
    await getMangaList({ includeTag: ["tag-id"], limit: 36, page: 2 }),
    response
  )
  assert.deepEqual(requests, [
    "/v1/manga?sort=latestChapter&direction=desc&limit=36&page=2&includeTag=tag-id",
  ])

  requests.length = 0
  const tag = {
    id: "tag-id",
    slug: "romance",
    group: "genre",
    name: "Lãng mạn",
  }
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    return Response.json(tag)
  }
  assert.deepEqual(await getTag("tag-id"), tag)
  assert.deepEqual(requests, ["/v1/tags/tag-id"])

  requests.length = 0
  const person = {
    id: "person-id",
    slug: "creator",
    name: "Creator",
    description: null,
    links: [],
    roles: ["author", "artist"],
  }
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    return Response.json(person)
  }
  assert.deepEqual(await getPerson("person-id"), person)
  assert.deepEqual(requests, ["/v1/people/person-id"])

  requests.length = 0
  let visible = true
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    return visible
      ? Response.json({ id: "manga-id", title: "Visible manga" })
      : Response.json(
          { error: { code: "NOT_FOUND", message: "Manga not found" } },
          { status: 404 }
        )
  }
  assert.deepEqual(await getManga("manga-id"), {
    id: "manga-id",
    title: "Visible manga",
  })
  visible = false
  assert.equal(await getManga("manga-id"), null)
  assert.deepEqual(requests, ["/v1/manga/manga-id", "/v1/manga/manga-id"])

  requests.length = 0
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    return Response.json(response)
  }
  await getMangaList({ author: ["author-id"], limit: 36 })
  await getMangaList({ artist: ["artist-id"], limit: 36 })
  assert.deepEqual(requests, [
    "/v1/manga?sort=latestChapter&direction=desc&limit=36&author=author-id",
    "/v1/manga?sort=latestChapter&direction=desc&limit=36&artist=artist-id",
  ])

  requests.length = 0
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    return Response.json(response)
  }
  assert.deepEqual(await getMangaRanking(), response)
  assert.deepEqual(requests, [
    "/v1/rankings/manga?metric=score&window=day&limit=5",
  ])

  requests.length = 0
  assert.deepEqual(await getGroupRanking(), response)
  assert.deepEqual(requests, ["/v1/rankings/groups?window=day&limit=10"])

  requests.length = 0
  assert.deepEqual(await getRecentComments(), response)
  assert.deepEqual(requests, ["/v1/comments/recent?limit=10"])

  requests.length = 0
  assert.deepEqual(await getRandomManga(), response)
  assert.deepEqual(requests, ["/v1/manga/random?limit=1"])

  requests.length = 0
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    assert.equal(init?.credentials, "omit")
    return Response.json(response)
  }
  assert.deepEqual(
    await queryClient.fetchQuery(
      mangaRankingOptions("https://api.example.test", "follows", "week")
    ),
    response
  )
  assert.deepEqual(requests, [
    "/v1/rankings/manga?metric=follows&window=week&limit=10",
  ])

  requests.length = 0
  assert.deepEqual(
    await queryClient.fetchQuery(
      groupRankingOptions("https://api.example.test", "month")
    ),
    response
  )
  assert.deepEqual(requests, ["/v1/rankings/groups?window=month&limit=10"])

  const tags = [
    { id: "01a0604f-02ad-7ed1-b865-614e4eaeedb5", slug: "oneshot" },
    { id: "01a0604f-02ae-7288-80f4-051c5736b083", slug: "romance" },
    { id: "01a0604f-02ae-7928-b8b5-324afb3d530a", slug: "comedy" },
    { id: "01a0604f-02ad-7178-9e4a-b9d8aae78594", slug: "slice-of-life" },
  ]
  globalThis.fetch = async (input) => {
    const url = new URL(String(input))
    requests.push(url.pathname + url.search)
    return Response.json(
      url.pathname === "/v1/tags" ? { data: tags } : response
    )
  }
  for (const tagSlugs of [
    ["oneshot"],
    ["romance", "comedy"],
    ["slice-of-life"],
  ]) {
    requests.length = 0
    assert.deepEqual(await getMangaList({ tagSlugs, limit: 5 }), response)
    assert.equal(requests[0], "/v1/tags")
    assert.equal(requests.length, 2)
    const url = new URL(requests[1], "http://localhost")
    assert.equal(url.pathname, "/v1/manga")
    assert.equal(url.searchParams.get("limit"), "5")
    assert.equal(url.searchParams.get("sort"), "latestChapter")
    assert.deepEqual(
      url.searchParams.getAll("includeTag"),
      tagSlugs.map((slug) => tags.find((tag) => tag.slug === slug).id)
    )
  }

  requests.length = 0
  assert.deepEqual(
    await getMangaList({ tagSlugs: ["romance", "missing"], limit: 5 }),
    { data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 0 } }
  )
  assert.deepEqual(requests, ["/v1/tags"])

  globalThis.fetch = async () =>
    Response.json({ error: { code: "UPSTREAM_ERROR" } }, { status: 503 })
  await assert.rejects(
    getMangaList({ sort: "publishedAt" }),
    /503 UPSTREAM_ERROR/
  )
  await assert.rejects(
    getMangaList({ tagSlugs: ["oneshot"], limit: 5 }),
    /503 UPSTREAM_ERROR/
  )

  globalThis.fetch = async () =>
    Response.json({
      data: [
        {
          id: "content-id",
          slug: "suggestive",
          group: "content",
          name: "Gợi cảm",
        },
        { id: "format-id", slug: "oneshot", group: "format", name: "Oneshot" },
        { id: "genre-id", slug: "romance", group: "genre", name: "Lãng mạn" },
        {
          id: "theme-id",
          slug: "school-life",
          group: "theme",
          name: "Học đường",
        },
      ],
    })
  const { TagList } = await import("../app/(site)/tags/page.tsx")
  const tagList = renderToStaticMarkup(await TagList())
  for (const heading of ["Nội dung", "Định dạng", "Thể loại", "Chủ đề"]) {
    assert.match(tagList, new RegExp(`<h2[^>]*>${heading}</h2>`))
  }
  assert.equal([...tagList.matchAll(/href="\/tag\//g)].length, 4)
} finally {
  if (originalInternalApiKey === undefined)
    delete globalThis.Bun.env.INTERNAL_API_KEY
  else globalThis.Bun.env.INTERNAL_API_KEY = originalInternalApiKey
  queryClient.clear()
  globalThis.fetch = originalFetch
}

console.log("Manga list query checks passed")
