import "server-only"

import { cacheLife } from "next/cache"
import { catalogRequest } from "@workspace/catalog/server"

import type { components } from "@/src/lib/generated/api"

export async function getSitemapIndex() {
  "use cache"
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })
  return catalogRequest<components["schemas"]["SitemapIndex"]>("/v1/sitemap")
}

export async function getSitemapPage(resource: string, page: number) {
  "use cache"
  cacheLife({ stale: 60, revalidate: 60, expire: 300 })
  return catalogRequest<components["schemas"]["SitemapPage"]>(
    `/v1/sitemap/${resource}/${page}`
  )
}
