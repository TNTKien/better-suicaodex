import assert from "node:assert/strict"
// @ts-expect-error Bun supplies this module at test runtime.
import { mock } from "bun:test"
import { chapter, chapterId, mangaId } from "./fixtures/reader"
import {
  readerPageFromHash,
  saveReaderPage,
} from "@workspace/account/reader-position"

mock.module("server-only", () => ({}))
mock.module("../modules/reading/reader", () => ({ Reader: () => null }))
const originalFetch = globalThis.fetch
const originalApiUrl = process.env.API_URL
const originalKey = process.env.INTERNAL_API_KEY
process.env.API_URL = "https://catalog.example.test"
process.env.INTERNAL_API_KEY = "reader-server-only-key"
const { ChapterPageContent, generateMetadata } =
  await import("../modules/reading/chapter-page")
const requests: { url: URL; init?: RequestInit }[] = []
let missing: "chapter" | "manga" | null = null
let failed = false
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input))
  requests.push({ url, init })
  if (failed)
    return Response.json({ error: { code: "UNAVAILABLE" } }, { status: 503 })
  if (url.pathname.startsWith("/v1/chapters"))
    return missing === "chapter"
      ? Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
      : Response.json(chapter)
  assert.equal(url.pathname, `/v1/manga/${mangaId}`)
  return missing === "manga"
    ? Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 })
    : Response.json({
        statistics: { follows: 203, comments: 134, views: 1234 },
      })
}
const props = { params: Promise.resolve({ id: chapterId }) }
try {
  const page = await ChapterPageContent(props)
  assert.equal(
    page.key,
    chapterId,
    "A new chapter resets reader and lazy comment state"
  )
  assert.equal(page.props.chapter.id, chapterId)
  assert.equal(page.props.statistics.follows, 203)
  assert.deepEqual(
    requests.map(({ url }) => url.pathname),
    [`/v1/chapters/${chapterId}`, `/v1/manga/${mangaId}`]
  )
  for (const { url, init } of requests) {
    assert.equal(url.origin, "https://catalog.example.test")
    assert.equal(
      new Headers(init?.headers).get("x-internal-api-key"),
      "reader-server-only-key"
    )
    assert.equal(init?.redirect, "error")
  }
  assert.ok(
    requests.every(({ url }) => !url.pathname.includes("comments")),
    "Server rendering never fetches chapter comments"
  )
  const metadata = await generateMetadata(props)
  assert.match(String(metadata.title), /Truyện đọc.*10.*Chương hiện tại/)
  assert.deepEqual(metadata.alternates, { canonical: `/chapter/${chapterId}` })
  const beforeInvalidId = requests.length
  await assert.rejects(
    () => ChapterPageContent({ params: Promise.resolve({ id: "123" }) }),
    /NEXT_HTTP_ERROR_FALLBACK;404/
  )
  assert.equal(requests.length, beforeInvalidId)
  for (const target of ["chapter", "manga"] as const) {
    missing = target
    await assert.rejects(
      () =>
        ChapterPageContent({
          params: Promise.resolve({
            id: chapterId,
          }),
        }),
      /NEXT_HTTP_ERROR_FALLBACK;404/
    )
  }
  missing = "chapter"
  assert.equal((await generateMetadata(props)).title, "Không tìm thấy chương")
  failed = true
  await assert.rejects(() => ChapterPageContent(props), /503 UNAVAILABLE/)

  assert.equal(readerPageFromHash("", 3), 0)
  assert.equal(readerPageFromHash("#page-2", 3), 1)
  assert.equal(readerPageFromHash("#page-999", 3), 2)
  assert.equal(readerPageFromHash("#page-0", 3), 0)
  assert.equal(readerPageFromHash("#page--1", 3), 0)
  assert.equal(readerPageFromHash("#page-2", 0), 0)
  saveReaderPage(3, 1) // Server rendering must not require window.
} finally {
  globalThis.fetch = originalFetch
  if (originalApiUrl === undefined) delete process.env.API_URL
  else process.env.API_URL = originalApiUrl
  if (originalKey === undefined) delete process.env.INTERNAL_API_KEY
  else process.env.INTERNAL_API_KEY = originalKey
}
console.log(
  "HVN chapter routing, internal API access and reader position checks passed"
)
