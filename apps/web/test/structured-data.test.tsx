import assert from "node:assert/strict"
import { renderToStaticMarkup } from "react-dom/server"

import { JsonLd } from "../components/json-ld"
import { siteConfig } from "../config/site"
import {
  getChapterStructuredData,
  getMangaStructuredData,
  getWebsiteStructuredData,
} from "../lib/structured-data"

function node(data: { "@graph": { "@type": string }[] }, type: string) {
  const found = data["@graph"].find((item) => item["@type"] === type)
  assert.ok(found, `Missing ${type} node`)
  return found as Record<string, unknown>
}

const originalWebUrl = process.env.WEB_URL
const manga = {
  id: "01a12efd-abfe-73d5-b5d6-a3e08b3831b7",
  slug: "truyen-tieng-viet",
  title: "Truyện tiếng Việt",
  description: "Nội dung truyện công khai.",
  cover: {
    url: "http://localhost:9000/covers/fixture.512.webp",
    width: 512,
    height: 720,
  },
  alternativeTitles: {
    en: ["Alternate title", "Alternate title"],
    ja: ["別名", "Truyện tiếng Việt", ""],
  },
  authors: [{ id: "author-id", slug: "tac-gia", name: "Tác giả" }],
  artists: [{ id: "artist-id", slug: "hoa-si", name: "Họa sĩ" }],
  tags: [
    { id: "genre-id", slug: "comedy", name: "Comedy", group: "genre" },
    {
      id: "theme-id",
      slug: "school-life",
      name: "School Life",
      group: "theme",
    },
  ],
}
const chapter = {
  id: "01a12efd-abfe-73d5-b5d6-a3e08b3831b8",
  title: "Khởi đầu",
  number: "1.5",
  volume: "2",
  language: "en",
  publishedAt: "2026-10-17T10:00:00Z",
  manga: {
    id: manga.id,
    slug: manga.slug,
    title: manga.title,
    cover: manga.cover,
    isLongStrip: false,
  },
}

try {
  delete process.env.WEB_URL
  assert.equal(
    node(getWebsiteStructuredData(), "WebSite").url,
    "http://localhost:3000/"
  )
  process.env.WEB_URL = "https://web.test/"
  const website = getWebsiteStructuredData()
  assert.equal(website["@context"], "https://schema.org")
  assert.deepEqual(node(website, "WebSite"), {
    "@type": "WebSite",
    "@id": "https://web.test/#website",
    url: "https://web.test/",
    name: siteConfig.name,
    description: siteConfig.description,
    inLanguage: "vi",
    publisher: { "@id": "https://web.test/#organization" },
  })
  const organization = node(website, "Organization")
  assert.deepEqual(organization.logo, {
    "@type": "ImageObject",
    url: `https://web.test${siteConfig.wordmark.src}`,
    width: siteConfig.wordmark.width,
    height: siteConfig.wordmark.height,
  })
  assert.deepEqual(organization.sameAs, Object.values(siteConfig.links))

  const mangaUrl = `https://web.test/manga/${manga.id}/${manga.slug}`
  const mangaData = getMangaStructuredData(manga)
  const comic = node(mangaData, "ComicSeries")
  assert.equal(comic.url, mangaUrl)
  assert.equal(comic.image, manga.cover.url)
  assert.deepEqual(comic.alternateName, ["Alternate title", "別名"])
  assert.deepEqual(comic.genre, ["Comedy"])
  assert.deepEqual(comic.author, [
    {
      "@type": "Person",
      name: "Tác giả",
      url: "https://web.test/author/author-id/tac-gia",
    },
  ])
  assert.deepEqual(comic.contributor, [
    {
      "@type": "Person",
      name: "Họa sĩ",
      url: "https://web.test/artist/artist-id/hoa-si",
    },
  ])
  assert.deepEqual(node(mangaData, "WebPage").mainEntity, {
    "@id": `${mangaUrl}#manga`,
  })
  assert.deepEqual(node(mangaData, "BreadcrumbList").itemListElement, [
    {
      "@type": "ListItem",
      position: 1,
      name: "Trang chủ",
      item: "https://web.test/",
    },
    { "@type": "ListItem", position: 2, name: manga.title, item: mangaUrl },
  ])
  assert.doesNotMatch(
    JSON.stringify(mangaData),
    /aggregateRating|ratingValue|ratingCount|datePublished|publisher|copyrightHolder/
  )

  const empty = getMangaStructuredData({
    ...manga,
    description: null,
    cover: null,
    alternativeTitles: {},
    authors: [],
    artists: [],
    tags: [],
  })
  assert.doesNotMatch(
    JSON.stringify(empty),
    /"image"|"author"|"contributor"|"genre"|"alternateName"|"description"/
  )

  const chapterUrl = `https://web.test/chapter/${chapter.id}`
  const chapterData = getChapterStructuredData(chapter)
  const chapterNode = node(chapterData, "Chapter")
  assert.equal(
    chapterNode.name,
    `${manga.title} - Tập 2 · Chương 1.5 - Khởi đầu`
  )
  assert.equal(chapterNode.url, chapterUrl)
  assert.equal(chapterNode.inLanguage, "en")
  assert.equal(chapterNode.datePublished, chapter.publishedAt)
  assert.deepEqual(chapterNode.isPartOf, {
    "@id": `${mangaUrl}#manga`,
    name: manga.title,
    url: mangaUrl,
  })
  assert.deepEqual(node(chapterData, "BreadcrumbList").itemListElement, [
    {
      "@type": "ListItem",
      position: 1,
      name: "Trang chủ",
      item: "https://web.test/",
    },
    { "@type": "ListItem", position: 2, name: manga.title, item: mangaUrl },
    {
      "@type": "ListItem",
      position: 3,
      name: "Tập 2 · Chương 1.5 - Khởi đầu",
      item: chapterUrl,
    },
  ])
  assert.equal(
    node(
      getChapterStructuredData({
        ...chapter,
        number: null,
        title: null,
        volume: null,
      }),
      "Chapter"
    ).name,
    `${manga.title} - Oneshot`
  )

  const attack =
    '</script><script>alert("xss")</script><!--<img src=x onerror=alert(1)>\u2028\u2029'
  const unsafe = getMangaStructuredData({
    ...manga,
    title: attack,
    description: attack,
  })
  const html = renderToStaticMarkup(<JsonLd data={unsafe} />)
  assert.equal((html.match(/<script/g) ?? []).length, 1)
  assert.equal((html.match(/<\/script>/g) ?? []).length, 1)
  assert.match(html, /type="application\/ld\+json"/)
  assert.doesNotMatch(html, /<img|<!--|<script>alert/)
  assert.match(html, /\\u003c\/script>/)
  const payload = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)![1]!
  const parsed = JSON.parse(payload) as ReturnType<
    typeof getMangaStructuredData
  >
  assert.equal(node(parsed, "ComicSeries").name, attack)
  assert.equal(node(parsed, "ComicSeries").description, attack.trim())
} finally {
  if (originalWebUrl === undefined) delete process.env.WEB_URL
  else process.env.WEB_URL = originalWebUrl
}
console.log("JSON-LD checks passed")
