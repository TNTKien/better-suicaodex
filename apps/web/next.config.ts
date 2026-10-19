import type { NextConfig } from "next"
import { getYear } from "date-fns"
import { tz } from "@date-fns/tz"
import { COVER_SERVICE_WORKER_HEADERS } from "@workspace/catalog/cover-cache-policy"

const nextConfig: NextConfig = {
  cacheComponents: true,
  compress: process.env.NODE_ENV !== "development",
  async rewrites() {
    return [{ source: "/sitemap-:id.xml", destination: "/sitemap/:id.xml" }]
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: COVER_SERVICE_WORKER_HEADERS,
      },
    ]
  },
  partialPrefetching: true,
  typescript: {
    tsconfigPath:
      process.env.NODE_ENV === "production"
        ? "tsconfig.build.json"
        : "tsconfig.json",
  },
  transpilePackages: [
    "@workspace/account",
    "@workspace/catalog",
    "@workspace/ui",
  ],
  env: {
    // ponytail: Build-time year keeps hydration stable; rebuild after New Year.
    NEXT_PUBLIC_COPYRIGHT_YEAR: String(
      getYear(new Date(), { in: tz("Asia/Ho_Chi_Minh") })
    ),
  },
}

export default nextConfig
