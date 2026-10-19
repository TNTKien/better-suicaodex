import { getServerSideSitemapIndex } from "next-sitemap"
import { io } from "next/cache"

import { getSiteUrl } from "@/lib/site-url"
import { getSitemapIndex } from "@/lib/sitemap-data"
import { sitemapHeaders } from "@/lib/sitemap"

export async function GET() {
  await io()
  const { data } = await getSitemapIndex()
  const ids = [
    "static",
    ...data.flatMap(({ resource, pages }) =>
      Array.from({ length: pages }, (_, page) => `${resource}-${page}`)
    ),
  ]
  const base = getSiteUrl()
  return getServerSideSitemapIndex(
    ids.map((id) => `${base}/sitemap-${id}.xml`),
    sitemapHeaders
  )
}
