import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import sharp from "sharp"
import type { Metadata } from "sharp"
import { withImageTransformSlot } from "./image-transform.js"

export const frameLimits = {
  sourceBytes: 10 * 1024 * 1024,
  sourcePixels: 40_000_000,
  outputBytes: 2_000_000,
  animatedOutputBytes: 5 * 1024 * 1024,
  outputSide: 512,
  referenceSide: 318,
  frames: 120,
} as const

export const qualitySteps = [82, 72, 62, 52, 42] // Existing media ladder; visual approval remains required.
export const animatedQualitySteps = [95, 90] // No deep compression just to fit the animated cap.
const inputOptions = {
  animated: true,
  failOn: "warning" as const,
  limitInputPixels: frameLimits.sourcePixels,
}
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex")

export function validateFrameMetadata(meta: Metadata, bytes: number) {
  assert(bytes > 0 && bytes <= frameLimits.sourceBytes, "Source exceeds 10 MiB")
  assert(meta.format === "png" || meta.format === "webp", "Only PNG/WebP input")
  const width = meta.width ?? 0
  const height = meta.pageHeight ?? meta.height ?? 0
  const frames = meta.pages ?? 1
  assert(
    width > 0 && height > 0 && Number.isInteger(frames),
    "Invalid canvas/frames"
  )
  assert(
    frames >= 1 && frames <= frameLimits.frames,
    "Source exceeds 120 frames"
  )
  assert(
    width * height * frames <= frameLimits.sourcePixels,
    "Source exceeds total pixel budget"
  )
  assert(meta.format !== "png" || frames === 1, "Animated PNG is not supported")
  return { width, height, frames }
}

function rejectAnimatedPng(input: Buffer) {
  if (
    !input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return
  for (let offset = 8; offset + 12 <= input.length;) {
    const length = input.readUInt32BE(offset)
    assert(offset + length + 12 <= input.length, "Invalid PNG chunk")
    const type = input.toString("ascii", offset + 4, offset + 8)
    assert(type !== "acTL", "Animated PNG is not supported")
    if (type === "IEND") return // Source files may have harmless bytes after IEND.
    offset += length + 12
  }
}

function alphaHash(rgba: Buffer) {
  const alpha = Buffer.alloc(rgba.length / 4)
  for (let index = 0; index < alpha.length; index++)
    alpha[index] = rgba[index * 4 + 3]!
  return hash(alpha)
}

function summary(bytes: Buffer, meta: Metadata) {
  return {
    bytes: bytes.length,
    sha256: hash(bytes),
    format: meta.format,
    width: meta.width,
    height: meta.pageHeight ?? meta.height,
    frames: meta.pages ?? 1,
    loop: meta.loop ?? null,
    delay: meta.delay ?? [],
    hasAlpha: meta.hasAlpha,
  }
}

export async function normalizeFrame(input: Buffer) {
  assert(
    input.length > 0 && input.length <= frameLimits.sourceBytes,
    "Source exceeds 10 MiB"
  )
  rejectAnimatedPng(input)
  return withImageTransformSlot(async () => {
    const before = await sharp(input, inputOptions).metadata()
    const source = validateFrameMetadata(before, input.length)
    const animated = source.frames > 1
    const outputBytes = animated
      ? frameLimits.animatedOutputBytes
      : frameLimits.outputBytes
    const timing = animated
      ? { loop: before.loop ?? 0, delay: before.delay }
      : {}
    const pipeline = () =>
      sharp(input, inputOptions)
        .resize({
          width: frameLimits.referenceSide,
          height: frameLimits.referenceSide,
          fit: "inside",
          withoutEnlargement: true,
        })
        .timeout({ seconds: 30 })

    // Decode all source frames; expected alpha is measured after the intended resize.
    const expected = await pipeline()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const expectedWidth = expected.info.width
    const expectedHeight = expected.info.height / source.frames
    assert(Number.isInteger(expectedHeight), "Invalid decoded frame layout")
    const expectedAlpha = alphaHash(expected.data)
    let asset: Buffer | undefined
    let quality: number | null = null
    let mode = "passthrough"
    if (
      before.format === "webp" &&
      input.length <= outputBytes &&
      source.width <= frameLimits.referenceSide &&
      source.height <= frameLimits.referenceSide
    ) {
      asset = input
    } else {
      const lossless = await pipeline()
        .webp({ lossless: true, exact: true, effort: 4, ...timing })
        .toBuffer()
      if (lossless.length <= outputBytes) {
        asset = lossless
        mode = "lossless"
      }
    }
    if (!asset) {
      for (const step of animated ? animatedQualitySteps : qualitySteps) {
        const encoded = await pipeline()
          .webp({
            quality: step,
            alphaQuality: 100,
            effort: 4,
            ...timing,
          })
          .toBuffer()
        if (encoded.length <= outputBytes) {
          asset = encoded
          quality = step
          mode = "lossy"
          break
        }
      }
    }
    assert(
      asset,
      "Cannot meet output size limit without deeper compression or dropping frames/alpha; keep source for review"
    )
    const after = await sharp(asset, inputOptions).metadata()
    const output = validateFrameMetadata(after, asset.length)
    assert(after.format === "webp", "Output is not WebP")
    assert(asset.length <= outputBytes, "Output exceeds size limit")
    assert(
      output.width <= frameLimits.outputSide &&
        output.height <= frameLimits.outputSide,
      "Output exceeds 512x512"
    )
    assert.equal(
      output.width,
      expectedWidth,
      "Output width changed unexpectedly"
    )
    assert.equal(
      output.height,
      expectedHeight,
      "Output height changed unexpectedly"
    )
    assert.equal(output.frames, source.frames, "Frame count changed")
    if (source.frames > 1) {
      assert.equal(after.loop, before.loop, "Loop changed")
      assert.deepEqual(after.delay, before.delay, "Frame timing changed")
    }
    const decoded = await sharp(asset, inputOptions)
      .ensureAlpha()
      .raw()
      .toBuffer()
    assert.equal(
      decoded.length,
      expected.data.length,
      "Decoded frame layout changed"
    )
    assert.equal(
      alphaHash(decoded),
      expectedAlpha,
      "Alpha changed across frames"
    )
    const preview = await sharp(asset, {
      ...inputOptions,
      animated: false,
      pages: 1,
    })
      .webp({ lossless: true, exact: true })
      .timeout({ seconds: 30 })
      .toBuffer()
    const previewMeta = await sharp(preview, inputOptions).metadata()
    assert(preview.length <= frameLimits.outputBytes, "Preview exceeds 2 MB")
    assert.equal(previewMeta.pages ?? 1, 1, "Preview is not static")
    const previewPixels = await sharp(preview).ensureAlpha().raw().toBuffer()
    assert(
      previewPixels.equals(
        decoded.subarray(0, output.width * output.height * 4)
      ),
      "Preview differs from first frame"
    )
    return {
      asset,
      preview,
      mode,
      quality,
      source: summary(input, before),
      output: { ...summary(asset, after), alphaSha256: expectedAlpha },
      thumbnail: summary(preview, previewMeta),
      checks: {
        fullDecode: true,
        alphaExact: true,
        frameCount: true,
        timing: true,
        loop: true,
        preview: true,
      },
    }
  })
}
