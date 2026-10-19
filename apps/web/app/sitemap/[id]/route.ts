import { isCatalogNotFound } from "@workspace/catalog/server"

import { getSitemapPage } from "@/lib/sitemap-data"
import {
  parseSitemapId,
  sitemapResponse,
  staticSitemapPaths,
} from "@/lib/sitemap"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (id === "static.xml") {
    return sitemapResponse(staticSitemapPaths.map((path) => ({ path })))
  }
  const page = parseSitemapId(id)
  if (!page) return new Response("Not found", { status: 404 })
  try {
    const { data } = await getSitemapPage(page.resource, page.page)
    return sitemapResponse(data)
  } catch (error) {
    if (isCatalogNotFound(error))
      return new Response("Not found", { status: 404 })
    throw error
  }
}
