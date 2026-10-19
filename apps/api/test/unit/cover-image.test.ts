import { describe, expect, test } from "bun:test"
import sharp from "sharp"

import {
  CoverImageError,
  COVER_MAX_OUTPUT_BYTES,
  transformCover,
} from "../../src/features/groups/cover-image"

function bmp() {
  const image = Buffer.alloc(58)
  image.write("BM")
  image.writeUInt32LE(image.length, 2)
  image.writeUInt32LE(54, 10)
  image.writeUInt32LE(40, 14)
  image.writeInt32LE(1, 18)
  image.writeInt32LE(1, 22)
  image.writeUInt16LE(1, 26)
  image.writeUInt16LE(24, 28)
  image.writeUInt32LE(4, 34)
  return image
}

describe("manga cover processing", () => {
  test("normalizes supported images and rejects BMP", async () => {
    const source = await sharp({
      create: {
        width: 900,
        height: 1_350,
        channels: 3,
        background: "#8855cc",
      },
    })
      .png()
      .toBuffer()
    const result = await transformCover(source)

    expect(result.full.byteLength).toBeLessThanOrEqual(COVER_MAX_OUTPUT_BYTES)
    expect(await sharp(result.full).metadata()).toMatchObject({
      format: "webp",
      width: 900,
      height: 1_350,
    })
    expect(await sharp(result.medium).metadata()).toMatchObject({
      format: "webp",
      width: 512,
      height: 768,
    })
    expect(await sharp(result.small).metadata()).toMatchObject({
      format: "webp",
      width: 256,
      height: 384,
    })
    expect(transformCover(bmp())).rejects.toBeInstanceOf(CoverImageError)
  })
})
