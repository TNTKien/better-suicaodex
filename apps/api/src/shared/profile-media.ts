import { randomUUID } from "node:crypto"

import sharp from "sharp"

import { resolveAssetUrl } from "../features/catalog/routes.js"
import {
  ImageTransformBusyError,
  withImageTransformSlot,
} from "./image-transform.js"
import type { MediaStorage } from "./storage.js"

export const PROFILE_MEDIA_MAX_INPUT_BYTES = 5 * 1024 * 1024
export const PROFILE_MEDIA_MULTIPART_MAX_BYTES =
  PROFILE_MEDIA_MAX_INPUT_BYTES + 64 * 1024
const maxOutputBytes = 1024 * 1024
const maxPixels = 40_000_000
const acceptedFormats = new Set(["jpeg", "png", "webp"])
const qualitySteps = [82, 72, 62, 52, 42]
const immutableCacheControl = "public, max-age=31536000, immutable"

export type ProfileMediaKind = "user-avatar" | "group-avatar" | "group-banner"

export class ProfileMediaError extends Error {}
export { ImageTransformBusyError as ProfileMediaBusyError }

function dimensions(kind: ProfileMediaKind) {
  return kind === "group-banner"
    ? { width: 1500, height: 500 }
    : { width: 512, height: 512 }
}

export async function transformProfileMedia(
  input: Uint8Array,
  kind: ProfileMediaKind
) {
  if (
    input.byteLength === 0 ||
    input.byteLength > PROFILE_MEDIA_MAX_INPUT_BYTES
  )
    throw new ProfileMediaError("Image size must be between 1 byte and 5 MiB")

  return withImageTransformSlot(async () => {
    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>
    try {
      metadata = await sharp(input, {
        failOn: "warning",
        limitInputPixels: maxPixels,
      }).metadata()
    } catch {
      throw new ProfileMediaError("Image could not be decoded")
    }
    if (!metadata.format || !acceptedFormats.has(metadata.format))
      throw new ProfileMediaError("Image must be JPEG, PNG, or WebP")
    if ((metadata.pages ?? 1) !== 1)
      throw new ProfileMediaError(
        "Animated or multi-page images are not supported"
      )

    const size = dimensions(kind)
    try {
      for (const quality of qualitySteps) {
        const output = await sharp(input, {
          failOn: "warning",
          limitInputPixels: maxPixels,
          sequentialRead: true,
        })
          .rotate()
          .resize({ ...size, fit: "cover", position: "centre" })
          .webp({ quality, effort: 6, smartSubsample: true })
          .toBuffer()
        if (output.byteLength <= maxOutputBytes) return new Uint8Array(output)
      }
      throw new ProfileMediaError(
        `Normalized image exceeds ${maxOutputBytes} bytes`
      )
    } catch (error) {
      if (error instanceof ProfileMediaError) throw error
      throw new ProfileMediaError("Image could not be decoded")
    }
  })
}

export async function putProfileMedia(
  storage: MediaStorage,
  key: string,
  data: Uint8Array
) {
  await storage.put(key, data)
  const stored = await storage.head(key)
  if (
    stored.contentLength !== data.byteLength ||
    stored.contentType !== "image/webp" ||
    stored.cacheControl !== immutableCacheControl
  )
    throw new Error(`Stored profile media verification failed for ${key}`)
}

export function profileMediaKey(
  kind: ProfileMediaKind,
  ownerId: string,
  assetId = randomUUID()
) {
  if (kind === "user-avatar") return `users/${ownerId}/avatars/${assetId}.webp`
  const directory = kind === "group-avatar" ? "avatars" : "banners"
  return `groups/${ownerId}/${directory}/${assetId}.webp`
}

export function profileMediaUrl(assetBaseUrl: string, key: string) {
  return resolveAssetUrl(assetBaseUrl, key)
}

export function ownedProfileMediaKey(
  value: string | null,
  assetBaseUrl: string,
  prefix: string
) {
  if (!value) return null
  try {
    const base = new URL(`${assetBaseUrl.replace(/\/+$/, "")}/`)
    const url = new URL(value)
    if (url.origin !== base.origin || url.search || url.hash) return null
    if (!url.pathname.startsWith(base.pathname)) return null
    const key = decodeURIComponent(url.pathname.slice(base.pathname.length))
    const assetId = key.startsWith(prefix) ? key.slice(prefix.length) : ""
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(
      assetId
    )
      ? key
      : null
  } catch {
    return null
  }
}
