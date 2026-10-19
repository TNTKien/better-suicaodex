import type { NextConfig } from "next"
import { COVER_SERVICE_WORKER_HEADERS } from "@workspace/catalog/cover-cache-policy"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  headers() {
    return [{ source: "/sw.js", headers: COVER_SERVICE_WORKER_HEADERS }]
  },
  transpilePackages: [
    "@workspace/account",
    "@workspace/catalog",
    "@workspace/ui",
  ],
  redirects() {
    return [
      {
        source: "/contact",
        destination: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
