import { getServerSideSitemap } from "next-sitemap"

import { getSiteUrl } from "./site-url"

export const sitemapHeaders = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=60",
}

export const staticSitemapPaths = [
  "/",
  "/latest",
  "/recent",
  "/tags",
  "/groups",
  "/system-notice",
  "/privacy-policy",
  "/terms-of-service",
  "/copyright",
] as const

export function parseSitemapId(id: string) {
  const match =
    /^(manga|chapter|tag|group|author|artist)-(0|[1-9]\d{0,4})\.xml$/.exec(id)
  return match ? { resource: match[1]!, page: Number(match[2]) } : null
}

// next-sitemap's server helpers interpolate loc/lastmod without XML escaping.
const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")

export function sitemapResponse(
  entries: { path: string; lastModified?: string | null }[]
) {
  const base = getSiteUrl()
  return getServerSideSitemap(
    entries.map(({ path, lastModified }) => {
      const url = new URL(path, base)
      if (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        url.origin !== base ||
        url.search ||
        url.hash
      ) {
        throw new Error("Sitemap entries must be canonical paths on WEB_URL")
      }
      return {
        loc: escapeXml(url.href),
        ...(lastModified ? { lastmod: escapeXml(lastModified) } : {}),
      }
    }),
    sitemapHeaders
  )
}
