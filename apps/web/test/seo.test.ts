import assert from "node:assert/strict"
// @ts-expect-error Bun is available at test runtime only.
import { mock } from "bun:test"

import robots from "../app/robots"
import { getSiteUrl } from "../lib/site-url"
import {
  parseSitemapId,
  sitemapResponse,
  staticSitemapPaths,
} from "../lib/sitemap"

const originalWebUrl = process.env.WEB_URL
const missing = new Error("not found")
let fail = false
let pageCalls = 0
mock.module("next/cache", () => ({ io: async () => {} }))
mock.module("@/lib/sitemap-data", () => ({
  getSitemapIndex: async () => {
    if (fail) throw new Error("API unavailable")
    return {
      data: [
        { resource: "manga", pages: 2 },
        { resource: "chapter", pages: 0 },
      ],
    }
  },
  getSitemapPage: async (_resource: string, page: number) => {
    pageCalls++
    if (fail) throw new Error("API unavailable")
    if (page === 9) throw missing
    return {
      data: [
        {
          path: "/manga/fixture/canonical-slug",
          lastModified: "2026-10-17T00:00:00Z",
        },
      ],
    }
  },
}))
mock.module("@workspace/catalog/server", () => ({
  isCatalogNotFound: (error: unknown) => error === missing,
}))
const { GET: index } = await import("../app/sitemap.xml/route")
const { GET: page } = await import("../app/sitemap/[id]/route")
const request = (id: string) =>
  page(new Request(`https://web.test/sitemap/${id}`), {
    params: Promise.resolve({ id }),
  })

try {
  process.env.WEB_URL = "https://web.test/"
  assert.equal(getSiteUrl(), "https://web.test")
  assert.equal(robots().sitemap, "https://web.test/sitemap.xml")
  assert.deepEqual(parseSitemapId("manga-0.xml"), {
    resource: "manga",
    page: 0,
  })
  for (const id of [
    "manga--1.xml",
    "manga-01.xml",
    "chapter-1.5.xml",
    "manga-100000.xml",
    "user-0.xml",
    "manga-1.xml/extra",
  ]) {
    assert.equal(parseSitemapId(id), null)
    assert.equal((await request(id)).status, 404)
  }
  assert.equal(pageCalls, 0)
  const root = await index()
  assert.equal(
    root.headers.get("content-type"),
    "application/xml; charset=utf-8"
  )
  assert.match(root.headers.get("cache-control")!, /s-maxage=60/)
  const indexXml = await root.text()
  assert.match(indexXml, /<sitemapindex xmlns=/)
  assert.deepEqual(
    [...indexXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
    [
      "https://web.test/sitemap-static.xml",
      "https://web.test/sitemap-manga-0.xml",
      "https://web.test/sitemap-manga-1.xml",
    ]
  )
  const fixed = await request("static.xml")
  assert.equal(fixed.status, 200)
  assert.equal(pageCalls, 0)
  const staticXml = await fixed.text()
  assert.equal(
    (staticXml.match(/<url>/g) ?? []).length,
    staticSitemapPaths.length
  )
  assert.doesNotMatch(staticXml, /<lastmod>|<priority>|<changefreq>/)
  assert.ok(
    !staticSitemapPaths.some((path: string) =>
      /login|account|history|library|admin|manage|random|advanced-search/.test(
        path
      )
    )
  )
  const manga = await request("manga-0.xml")
  const xml = await manga.text()
  assert.match(xml, /https:\/\/web.test\/manga\/fixture\/canonical-slug/)
  assert.match(xml, /<lastmod>2026-10-17T00:00:00Z<\/lastmod>/)
  assert.doesNotMatch(xml, /<priority>|<changefreq>/)
  assert.equal((await request("manga-9.xml")).status, 404)
  const escaped = await sitemapResponse([
    { path: "/tag/a&b/slug", lastModified: '"<&' },
  ])
  const escapedXml = await escaped.text()
  assert.match(escapedXml, /<loc>https:\/\/web.test\/tag\/a&amp;b\/slug<\/loc>/)
  assert.match(escapedXml, /<lastmod>&quot;&lt;&amp;<\/lastmod>/)
  for (const path of [
    "https://evil.test/manga/id",
    "//evil.test/manga/id",
    "https://web.test/manga/id",
    "manga/id",
    "/manga/id?tab=comments",
    "/manga/id#comments",
  ]) {
    assert.throws(() => sitemapResponse([{ path }]))
  }
  fail = true
  await assert.rejects(index(), /API unavailable/)
  await assert.rejects(request("manga-0.xml"), /API unavailable/)
  delete process.env.WEB_URL
  assert.equal(getSiteUrl(), "http://localhost:3000")
  process.env.WEB_URL = "ftp://web.test"
  assert.throws(getSiteUrl)
} finally {
  if (originalWebUrl === undefined) delete process.env.WEB_URL
  else process.env.WEB_URL = originalWebUrl
}
console.log("Sitemap and robots checks passed")
