import { personPath } from "@workspace/catalog/routing"

import { siteConfig } from "@/config/site"
import type { ChapterDetail, MangaDetail } from "@/lib/api"
import { chapterLabel, mangaDetailHref } from "@/lib/catalog"
import { getSiteUrl } from "@/lib/site-url"

type MangaData = Pick<
  MangaDetail,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "cover"
  | "alternativeTitles"
  | "authors"
  | "artists"
  | "tags"
>
type ChapterData = Pick<
  ChapterDetail,
  "id" | "manga" | "number" | "title" | "volume" | "language" | "publishedAt"
>

function absoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).href
}

function breadcrumb(url: string, items: { name: string; url: string }[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function getWebsiteStructuredData() {
  const url = absoluteUrl("/")
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${url}#organization`,
        name: siteConfig.name,
        url,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(siteConfig.wordmark.src),
          width: siteConfig.wordmark.width,
          height: siteConfig.wordmark.height,
        },
        sameAs: Object.values(siteConfig.links),
      },
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: siteConfig.name,
        url,
        description: siteConfig.description,
        inLanguage: "vi",
        publisher: { "@id": `${url}#organization` },
      },
    ],
  }
}

function person(
  value: MangaData["authors"][number],
  role: "artist" | "author"
) {
  return {
    "@type": "Person",
    name: value.name,
    url: absoluteUrl(personPath(role, value.id, value.slug)),
  }
}

export function getMangaStructuredData(manga: MangaData) {
  const url = absoluteUrl(mangaDetailHref(manga))
  const alternativeTitles = [
    ...new Set(Object.values(manga.alternativeTitles).flat()),
  ].filter((title) => title.trim() && title !== manga.title)
  const genres = manga.tags
    .filter((tag) => tag.group === "genre")
    .map((tag) => tag.name)
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: manga.title,
        inLanguage: "vi",
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
        mainEntity: { "@id": `${url}#manga` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "ComicSeries",
        "@id": `${url}#manga`,
        url,
        name: manga.title,
        alternateName: alternativeTitles.length ? alternativeTitles : undefined,
        description: manga.description?.trim() || undefined,
        image: manga.cover?.url ?? undefined,
        author: manga.authors.length
          ? manga.authors.map((value) => person(value, "author"))
          : undefined,
        contributor: manga.artists.length
          ? manga.artists.map((value) => person(value, "artist"))
          : undefined,
        genre: genres.length ? genres : undefined,
        mainEntityOfPage: { "@id": `${url}#webpage` },
      },
      breadcrumb(url, [
        { name: "Trang chủ", url: absoluteUrl("/") },
        { name: manga.title, url },
      ]),
    ],
  }
}

export function getChapterStructuredData(chapter: ChapterData) {
  const url = absoluteUrl(`/chapter/${chapter.id}`)
  const mangaUrl = absoluteUrl(mangaDetailHref(chapter.manga))
  const label = chapterLabel(chapter)
  const name = `${chapter.manga.title} - ${label}`
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name,
        inLanguage: "vi",
        isPartOf: { "@id": `${absoluteUrl("/")}#website` },
        mainEntity: { "@id": `${url}#chapter` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "Chapter",
        "@id": `${url}#chapter`,
        url,
        name,
        inLanguage: chapter.language,
        datePublished: chapter.publishedAt,
        isPartOf: {
          "@id": `${mangaUrl}#manga`,
          name: chapter.manga.title,
          url: mangaUrl,
        },
        mainEntityOfPage: { "@id": `${url}#webpage` },
      },
      breadcrumb(url, [
        { name: "Trang chủ", url: absoluteUrl("/") },
        { name: chapter.manga.title, url: mangaUrl },
        { name: label, url },
      ]),
    ],
  }
}
