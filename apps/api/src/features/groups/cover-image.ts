import sharp from "sharp"

import {
  ImageTransformBusyError,
  withImageTransformSlot,
} from "../../shared/image-transform.js"

export const COVER_MAX_INPUT_BYTES = 5 * 1024 * 1024
export const COVER_MAX_OUTPUT_BYTES = 1024 * 1024
export const COVER_MAX_PIXELS = 40_000_000
export const COVER_MULTIPART_MAX_BYTES = COVER_MAX_INPUT_BYTES + 64 * 1024

const acceptedFormats = new Set(["jpeg", "png", "webp"])
const qualitySteps = [82, 72, 62, 52, 42]
export class CoverImageError extends Error {}
export { ImageTransformBusyError as CoverImageBusyError }
export { withImageTransformSlot as withTransformSlot }

function pipeline(input: Uint8Array) {
  return sharp(input, {
    failOn: "warning",
    limitInputPixels: COVER_MAX_PIXELS,
    sequentialRead: true,
  }).rotate()
}

async function encodeFull(input: Uint8Array) {
  for (const quality of qualitySteps) {
    const output = await pipeline(input)
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer({ resolveWithObject: true })
    if (output.data.byteLength <= COVER_MAX_OUTPUT_BYTES) return output
  }
  throw new CoverImageError(
    `The normalized cover exceeds ${COVER_MAX_OUTPUT_BYTES} bytes`
  )
}

async function encodeVariant(input: Uint8Array, width: number) {
  return pipeline(input)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true })
}

export async function transformCover(input: Uint8Array) {
  if (input.byteLength === 0 || input.byteLength > COVER_MAX_INPUT_BYTES)
    throw new CoverImageError("Cover size must be between 1 byte and 5 MiB")

  return withImageTransformSlot(async () => {
    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>
    try {
      metadata = await sharp(input, {
        failOn: "warning",
        limitInputPixels: COVER_MAX_PIXELS,
      }).metadata()
    } catch {
      throw new CoverImageError("Cover could not be decoded")
    }
    if (!metadata.format || !acceptedFormats.has(metadata.format))
      throw new CoverImageError("Cover must be JPEG, PNG, or WebP")
    if ((metadata.pages ?? 1) !== 1)
      throw new CoverImageError(
        "Animated or multi-page covers are not supported"
      )

    try {
      const full = await encodeFull(input)
      const medium = await encodeVariant(input, 512)
      const small = await encodeVariant(input, 256)
      return {
        full: full.data,
        medium: medium.data,
        small: small.data,
        width: full.info.width,
        height: full.info.height,
      }
    } catch (error) {
      if (error instanceof CoverImageError) throw error
      throw new CoverImageError("Cover could not be decoded")
    }
  })
}
