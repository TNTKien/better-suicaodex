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
let visible = true
mock.module("server-only", () => ({}))
mock.module("@/lib/api", () => ({
  getTag: async () => (visible ? tag : null),
  getPerson: async () => (visible ? person : null),
  getGroup: async () => (visible ? group : null),
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
} finally {
  if (originalOgUrl === undefined) delete process.env.OG_IMAGE_URL
  else process.env.OG_IMAGE_URL = originalOgUrl
}
console.log("Catalog canonical, robots and group metadata checks passed")
