import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import type { MangaDetail } from "../lib/api"

mock.module("server-only", () => ({}))
let resumeNavigation: () => void = () => {}
mock.module("next/cache", () => ({
  navigation: () =>
    new Promise<void>((resolve) => {
      resumeNavigation = resolve
    }),
}))
const manga: MangaDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "manga-slug",
  title: "Truyện công khai",
  description: "Mô tả",
  alternativeTitles: {},
  authors: [],
  artists: [],
  groups: [],
  tags: [],
  cover: null,
  contentRating: "safe",
  originalLanguage: "ja",
  status: "ongoing",
  year: null,
  statistics: { views: 0, follows: 0, comments: 0 },
  latestChapter: null,
  latestChapterPublishedAt: null,
  firstChapter: null,
  readingEntries: [],
  chapterCounts: { slots: 0, releases: 0 },
  numberingMode: "global",
  availableLanguages: [],
  lastChapter: null,
  lastVolume: null,
  links: [],
  publicationDemographic: null,
  createdAt: "2026-10-18T00:00:00Z",
  publishedAt: "2026-10-18T00:00:00Z",
  updatedAt: "2026-10-18T00:00:00Z",
}
let missing = false
let missingChapters = false
let chaptersFailed = false
const calls: string[] = []
mock.module("@/lib/api", () => ({
  getManga: async () => {
    calls.push("manga")
    return missing ? null : manga
  },
  getMangaChapters: async (_id: string, page: number, direction: string) => {
    calls.push(`chapters:${page}:${direction}`)
    if (chaptersFailed) throw new Error("API unavailable")
    if (missingChapters) return null
    return { data: [], slots: [], meta: { page, totalPages: 2 } }
  },
  getMangaRecommendations: async () => {
    calls.push("recommendations")
    return { byAuthor: [], similar: [] }
  },
}))
const { default: Page, generateMetadata } =
  await import("../app/(site)/manga/[id]/[slug]/page")
const props = (slug = manga.slug, id = manga.id, query = {}) => ({
  params: Promise.resolve({ id, slug }),
  searchParams: Promise.resolve(query),
})
async function content(options = props()) {
  const child = Page(options).props.children
  return child.type(child.props)
}
const is404 = (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"
const redirectTo = (href: string) => (error: unknown) =>
  error instanceof Error &&
  "digest" in error &&
  error.digest === `NEXT_REDIRECT;replace;${href};308;`
const canonical = `/manga/${manga.id}/${manga.slug}`

const result = await content(
  props(manga.slug, manga.id, { page: "2", direction: "asc" })
)
assert.deepEqual(calls, ["manga"])
const view = result.props.children[1]
assert.equal(view.props.manga.title, manga.title)
const chapters = view.props.chapters.props.children
const pending = chapters.type(chapters.props)
assert.deepEqual(calls, ["manga"])
resumeNavigation()
await pending
assert.deepEqual(calls, ["manga", "chapters:2:asc"])
const recommendations = view.props.recommendations.props.children
const pendingRecommendations = recommendations.type(recommendations.props)
assert.equal(calls.includes("recommendations"), false)
resumeNavigation()
await pendingRecommendations
assert.equal(calls.at(-1), "recommendations")

async function chapterContent(query = {}) {
  const page = await content(props(manga.slug, manga.id, query))
  const child = page.props.children[1].props.chapters.props.children
  const pending = child.type(child.props)
  resumeNavigation()
  return pending
}
await assert.rejects(chapterContent({ page: "3" }), is404)
missingChapters = true
await assert.rejects(chapterContent(), is404)
missingChapters = false
chaptersFailed = true
await assert.rejects(chapterContent(), /API unavailable/)
await content() // A chapter failure cannot block the manga header.
await assert.rejects(
  content(props("old", manga.id, { page: "2" })),
  redirectTo(`${canonical}?page=2`)
)
await assert.rejects(content(props("old", "invalid-id")), is404)
missing = true
await assert.rejects(content(), is404)
assert.deepEqual(await generateMetadata(props()), {
  title: "Không tìm thấy truyện",
})
console.log(
  "Manga header, deferred chapter/recommendation data, redirects and 404 checks passed"
)
