import assert from "node:assert/strict"
import { getGroupOgImageUrl, getMangaOgImageUrl } from "../lib/og-image"

const original = process.env.OG_IMAGE_URL
const id = "01a12efd-abfe-73d5-b5d6-a3e08b3831b7"
try {
  delete process.env.OG_IMAGE_URL
  assert.equal(
    getMangaOgImageUrl(id),
    `http://localhost:3003/og-image/manga/${id}.png`
  )
  assert.equal(
    getGroupOgImageUrl(id),
    `http://localhost:3003/og-image/group/${id}.png`
  )
  process.env.OG_IMAGE_URL = "http://localhost:3003/"
  assert.equal(
    getMangaOgImageUrl(id),
    `http://localhost:3003/og-image/manga/${id}.png`
  )
  assert.equal(
    getGroupOgImageUrl(id),
    `http://localhost:3003/og-image/group/${id}.png`
  )
  for (const value of [
    "file:///etc/passwd",
    "https://name:password@og.test",
    "https://og.test/path",
    "https://og.test/?token=secret",
    "https://og.test/#fragment",
  ]) {
    process.env.OG_IMAGE_URL = value
    assert.throws(() => getMangaOgImageUrl(id), /OG_IMAGE_URL/)
    assert.throws(() => getGroupOgImageUrl(id), /OG_IMAGE_URL/)
  }
} finally {
  if (original === undefined) delete process.env.OG_IMAGE_URL
  else process.env.OG_IMAGE_URL = original
}
console.log("External OG image URL checks passed")
