import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin", "/manage", "/random"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
