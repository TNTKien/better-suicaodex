import assert from "node:assert/strict"
import type { Metadata } from "next"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"

const id = "01a12efd-abfe-73d5-b5d6-a3e08b3831b7"
const group = {
  id,
  slug: "nhom-dich",
  name: "Nhóm dịch",
  description: "Giới thiệu nhóm dịch.",
}
const person = {
  id,
  slug: "tac-gia",
  name: "Tác giả",
  roles: ["author", "artist"],
  description: null,
}
const tag = { id, slug: "comedy", name: "Comedy" }
const chapter = {
  id,
  volume: "2",
  number: "1.5",
  title: "Khởi đầu",
  manga: { title: "Truyện tiếng Việt" },
}
let visible = true
let chapterCalls = 0
mock.module("server-only", () => ({}))
mock.module("../app/(reader)/chapter/[id]/reader-client", () => ({
  ReaderClient: () => null,
}))
mock.module("@/lib/api", () => ({
  getTag: async () => (visible ? tag : null),
  getPerson: async () => (visible ? person : null),
  getGroup: async () => (visible ? group : null),
  getChapter: async () => {
    chapterCalls++
    return visible ? chapter : null
  },
  getMangaList: async () => {
    throw new Error("Unexpected catalog fetch")
  },
  getGroups: async () => {
    throw new Error("Unexpected group listing fetch")
  },
  getBrowserApiBaseUrl: () => "https://api.test",
  getTags: async () => {
    throw new Error("Unexpected tags fetch")
  },
}))

const { generateMetadata: latest } = await import("../app/(site)/latest/page")
const { generateMetadata: recent } = await import("../app/(site)/recent/page")
const { generateMetadata: groups } = await import("../app/(site)/groups/page")
const { generateMetadata: tagMetadata } =
  await import("../app/(site)/tag/[id]/[slug]/page")
const { generateMetadata: author } =
  await import("../app/(site)/author/[id]/[slug]/page")
const { generateMetadata: artist } =
  await import("../app/(site)/artist/[id]/[slug]/page")
const { generateMetadata: groupMetadata } =
  await import("../app/(site)/group/[id]/[[...slug]]/page")
const { metadata: search } = await import("../app/(site)/advanced-search/page")
const { generateMetadata: chapterMetadata } =
  await import("../app/(reader)/chapter/[id]/page")
const params = Promise.resolve({ id, slug: "stale-slug" })
const groupParams = Promise.resolve({ id, slug: ["stale-slug"] })

function canonical(metadata: Metadata, expected: string) {
  assert.equal(metadata.alternates?.canonical, expected)
  assert.ok(metadata.description?.trim())
  assert.equal(metadata.robots, undefined)
}

for (const page of [
  undefined,
  "1",
  "2",
  "invalid",
  "02",
  "1e2",
  "1.5",
  "9007199254740992",
  ["2", "3"],
]) {
  const searchParams = Promise.resolve({ page })
  const suffix = page === "2" ? "?page=2" : ""
  canonical(await latest({ searchParams }), `/latest${suffix}`)
  canonical(await recent({ searchParams }), `/recent${suffix}`)
  canonical(
    await tagMetadata({ params, searchParams }),
    `/tag/${id}/comedy${suffix}`
  )
  canonical(
    await author({ params, searchParams }),
    `/author/${id}/tac-gia${suffix}`
  )
  canonical(
    await artist({ params, searchParams }),
    `/artist/${id}/tac-gia${suffix}`
  )
  canonical(
    await groupMetadata({ params: groupParams, searchParams }),
    `/group/${id}/nhom-dich${suffix}`
  )
}
canonical(
  await groups({ searchParams: Promise.resolve({ page: "2" }) }),
  "/groups?page=2"
)
canonical(
  await groups({ searchParams: Promise.resolve({ q: "  " }) }),
  "/groups"
)
const filtered = await groups({
  searchParams: Promise.resolve({ q: " Nhóm dịch ", page: "2" }),
})
assert.deepEqual(filtered.robots, { index: false, follow: true })
assert.equal(
  new URL(
    String(filtered.alternates?.canonical),
    "https://web.test"
  ).searchParams.get("q"),
  "Nhóm dịch"
)
assert.deepEqual(search.robots, { index: false, follow: true })

const originalOgUrl = process.env.OG_IMAGE_URL
try {
  process.env.OG_IMAGE_URL = "https://og.test"
  const chapterData = await chapterMetadata({ params: Promise.resolve({ id }) })
  const chapterTitle = "Truyện tiếng Việt - Tập 2 · Chương 1.5 - Khởi đầu"
  const chapterImage = {
    url: `https://og.test/og-image/chapter/${id}.png`,
    width: 1200,
    height: 630,
    alt: chapterTitle,
  }
  canonical(chapterData, `/chapter/${id}`)
  assert.equal(chapterData.title, chapterTitle)
  assert.equal(chapterData.openGraph?.url, `/chapter/${id}`)
  assert.equal(chapterData.openGraph?.title, chapterTitle)
  assert.deepEqual(chapterData.openGraph?.images, [chapterImage])
  assert.equal(chapterData.twitter?.card, "summary_large_image")
  assert.deepEqual(chapterData.twitter?.images, [chapterImage])
  assert.equal(chapterCalls, 1)
  const invalidChapter = await chapterMetadata({
    params: Promise.resolve({ id: "not-a-uuid" }),
  })
  assert.equal(invalidChapter.openGraph, undefined)
  assert.equal(chapterCalls, 1)
  const metadata = await groupMetadata({
    params: groupParams,
    searchParams: Promise.resolve({ page: "2" }),
  })
  const image = {
    url: `https://og.test/og-image/group/${id}.png`,
    width: 1200,
    height: 630,
    alt: "Nhóm dịch Nhóm dịch trên SuicaoDex",
  }
  assert.equal(metadata.description, group.description)
  assert.deepEqual(metadata.openGraph?.images, [image])
  assert.equal(metadata.openGraph?.url, `/group/${id}/nhom-dich?page=2`)
  assert.deepEqual(metadata.twitter?.images, [image])
  group.description = ""
  assert.match(
    (
      await groupMetadata({
        params: groupParams,
        searchParams: Promise.resolve({}),
      })
    ).description!,
    /Thông tin nhóm dịch/
  )
  visible = false
  const missing = await groupMetadata({
    params: groupParams,
    searchParams: Promise.resolve({}),
  })
  assert.equal(missing.alternates, undefined)
  assert.equal(missing.openGraph, undefined)
  const missingChapter = await chapterMetadata({
    params: Promise.resolve({ id }),
  })
  assert.equal(missingChapter.alternates, undefined)
  assert.equal(missingChapter.openGraph, undefined)
  assert.equal(missingChapter.twitter, undefined)
} finally {
  if (originalOgUrl === undefined) delete process.env.OG_IMAGE_URL
  else process.env.OG_IMAGE_URL = originalOgUrl
}
console.log(
  "Catalog canonical, robots, group and chapter metadata checks passed"
)
