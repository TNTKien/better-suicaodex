import assert from "node:assert/strict"
import { publicOrigin } from "@workspace/catalog/origins"

assert.equal(
  publicOrigin("https://assets.example.test:8443/", "assets"),
  "https://assets.example.test:8443"
)
for (const origin of [
  "ftp://assets.example.test",
  "https://u:p@assets.example.test",
  "https://assets.example.test/path",
  "https://*.example.test",
  "https://assets.example.test?q=1",
  "https://assets.example.test/#a",
])
  assert.throws(() => publicOrigin(origin, "assets"))

import {
  COVER_CACHE_MAX_AGE_SECONDS,
  COVER_CACHE_MAX_ENTRIES,
  createCoverCorsRequest,
  isCacheableCoverRequest,
  isCacheableCoverResponse,
} from "../lib/cover-cache-policy"

const imageRequest = {
  cache: "default",
  destination: "image",
} as const

for (const size of ["256", "512"]) {
  assert.equal(
    isCacheableCoverRequest(
      imageRequest,
      new URL(`http://localhost:9000/covers/manga/cover.${size}.webp`)
    ),
    true
  )
}

for (const url of [
  "https://localhost:9000/covers/manga/cover.512.webp",
  "https://other.test/covers/manga/cover.512.webp",
  "http://localhost:9000/chapters/chapter/page.512.webp",
  "http://localhost:9000/covers/manga/cover.webp",
]) {
  assert.equal(isCacheableCoverRequest(imageRequest, new URL(url)), false, url)
}

assert.equal(
  isCacheableCoverRequest(
    { cache: "default", destination: "document" },
    new URL("http://localhost:9000/covers/manga/cover.512.webp")
  ),
  false
)
for (const cache of ["no-store", "reload"] as const) {
  assert.equal(
    isCacheableCoverRequest(
      { cache, destination: "image" },
      new URL("http://localhost:9000/covers/manga/cover.512.webp")
    ),
    false
  )
}

const corsRequest = createCoverCorsRequest(
  new Request(
    "http://localhost:9000/covers/manga/cover.512.webp?revision=123",
    { mode: "no-cors" }
  )
)
assert.equal(corsRequest.mode, "cors")
assert.equal(corsRequest.redirect, "follow")
assert.equal(
  corsRequest.url,
  "http://localhost:9000/covers/manga/cover.512.webp?revision=123"
)

assert.equal(
  isCacheableCoverResponse(
    new Response("image", {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/webp",
      },
      status: 200,
    })
  ),
  true
)
for (const response of [
  new Response("missing", {
    headers: { "Content-Type": "image/webp" },
    status: 404,
  }),
  new Response("html", {
    headers: { "Content-Type": "text/html" },
    status: 200,
  }),
  new Response("private", {
    headers: {
      "Cache-Control": "private, max-age=60",
      "Content-Type": "image/webp",
    },
    status: 200,
  }),
  new Response("no-store", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "image/webp",
    },
    status: 200,
  }),
]) {
  assert.equal(isCacheableCoverResponse(response), false)
}

assert.equal(COVER_CACHE_MAX_ENTRIES, 200)
assert.equal(COVER_CACHE_MAX_AGE_SECONDS, 7 * 24 * 60 * 60)
