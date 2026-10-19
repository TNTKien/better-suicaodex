import { assetOrigin } from "./origins"
export const COVER_CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
export const COVER_CACHE_MAX_ENTRIES = 200
export const COVER_CACHE_NAME = "redive-cover-images"

export const COVER_SERVICE_WORKER_HEADERS = [
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  {
    key: "Content-Security-Policy",
    value:
      `default-src 'self'; script-src 'self'; connect-src 'self' ${assetOrigin}`,
  },
  { key: "Content-Type", value: "application/javascript; charset=utf-8" },
  { key: "Service-Worker-Allowed", value: "/" },
  { key: "X-Content-Type-Options", value: "nosniff" },
]

export function isSuicaoDexCoverUrl(url: URL) {
  return (
    url.origin === assetOrigin && !url.username && !url.password &&
    url.pathname.startsWith("/covers/") &&
    (url.pathname.endsWith(".256.webp") || url.pathname.endsWith(".512.webp"))
  )
}

export function isCacheableCoverRequest(
  request: Pick<Request, "cache" | "destination">,
  url: URL
) {
  return (
    request.destination === "image" &&
    request.cache !== "no-store" &&
    request.cache !== "reload" &&
    isSuicaoDexCoverUrl(url)
  )
}

export function createCoverCorsRequest(request: Request) {
  return new Request(request.url, {
    credentials: "omit",
    mode: "cors",
    redirect: "follow",
  })
}

export function isCacheableCoverResponse(
  response: Pick<Response, "headers" | "status">
) {
  return (
    response.status === 200 &&
    response.headers.get("Content-Type")?.toLowerCase().startsWith("image/") ===
      true &&
    !/no-store|private/i.test(response.headers.get("Cache-Control") ?? "")
  )
}
