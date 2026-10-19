import sharp from "sharp"

import {
  CoverImageBusyError as ChapterImageBusyError,
  withTransformSlot,
} from "./cover-image.js"

export { ChapterImageBusyError }

export const CHAPTER_PAGE_MAX_INPUT_BYTES = 12 * 1024 * 1024
export const CHAPTER_PAGE_MULTIPART_MAX_BYTES =
  CHAPTER_PAGE_MAX_INPUT_BYTES + 64 * 1024
export const CHAPTER_PAGE_MAX_PIXELS = 40_000_000
export const CHAPTER_MAX_PAGES = 220
export const CHAPTER_SESSION_MAX_SOURCE_BYTES = 512 * 1024 * 1024
export const CHAPTER_ACTOR_MAX_ACTIVE_SESSIONS = 5

const NORMAL_PAGE_MAX_HEIGHT = 1800
const LONG_STRIP_MAX_WIDTH = 1000
const LONG_STRIP_MIN_RATIO = 3

export class ChapterImageError extends Error {}

function detectedFormat(input: Uint8Array) {
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return "jpeg"
  if (
    input[0] === 0x89 &&
    input[1] === 0x50 &&
    input[2] === 0x4e &&
    input[3] === 0x47 &&
    input[4] === 0x0d &&
    input[5] === 0x0a &&
    input[6] === 0x1a &&
    input[7] === 0x0a
  )
    return "png"
  if (
    String.fromCharCode(...input.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...input.slice(8, 12)) === "WEBP"
  )
    return "webp"
  if (
    String.fromCharCode(...input.slice(4, 8)) === "ftyp" &&
    /avif|avis/.test(String.fromCharCode(...input.slice(8, 32)))
  )
    return "avif"
  return undefined
}

export async function transformChapterPage(input: Uint8Array) {
  if (input.byteLength === 0 || input.byteLength > CHAPTER_PAGE_MAX_INPUT_BYTES)
    throw new ChapterImageError("Page size must be between 1 byte and 12 MiB")
  const format = detectedFormat(input)
  if (!format)
    throw new ChapterImageError("Page must be JPEG, PNG, WebP, or AVIF")

  return withTransformSlot(async () => {
    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>
    try {
      metadata = await sharp(input, {
        failOn: "warning",
        limitInputPixels: CHAPTER_PAGE_MAX_PIXELS,
      }).metadata()
    } catch {
      throw new ChapterImageError("Page could not be decoded")
    }
    if (
      (format === "avif" && metadata.format !== "heif") ||
      (format !== "avif" && metadata.format !== format) ||
      !metadata.width ||
      !metadata.height ||
      (metadata.pages ?? 1) !== 1
    )
      throw new ChapterImageError("Page could not be decoded")

    const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1)
    const width = rotated ? metadata.height : metadata.width
    const height = rotated ? metadata.width : metadata.height
    const longStrip = height / width >= LONG_STRIP_MIN_RATIO

    try {
      const output = await sharp(input, {
        failOn: "warning",
        limitInputPixels: CHAPTER_PAGE_MAX_PIXELS,
        sequentialRead: true,
      })
        .rotate()
        .resize(
          longStrip
            ? { width: LONG_STRIP_MAX_WIDTH, withoutEnlargement: true }
            : { height: NORMAL_PAGE_MAX_HEIGHT, withoutEnlargement: true }
        )
        .webp({
          quality: 77,
          effort: 6,
          preset: "drawing",
          smartSubsample: true,
        })
        .toBuffer({ resolveWithObject: true })
      return {
        data: output.data,
        width: output.info.width,
        height: output.info.height,
      }
    } catch {
      throw new ChapterImageError("Page could not be decoded")
    }
  })
}
