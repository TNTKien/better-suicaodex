import { describe, expect, test } from "bun:test"
import sharp from "sharp"

import {
  ChapterImageError,
  CHAPTER_PAGE_MAX_INPUT_BYTES,
  transformChapterPage,
} from "../../src/features/groups/chapter-image"

const source = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 245, g: 245, b: 245 },
    },
  })
    .jpeg()
    .toBuffer()

describe("chapter page transform", () => {
  test("resizes normal pages by height and long strips by width", async () => {
    const normal = await transformChapterPage(await source(1200, 2400))
    expect({ width: normal.width, height: normal.height }).toEqual({
      width: 900,
      height: 1800,
    })

    const longStrip = await transformChapterPage(await source(1200, 4800))
    expect({ width: longStrip.width, height: longStrip.height }).toEqual({
      width: 1000,
      height: 4000,
    })
    expect((await sharp(longStrip.data).metadata()).format).toBe("webp")
  })

  test("accepts AVIF and rejects unsupported or oversized input", async () => {
    const avif = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: "white",
      },
    })
      .avif()
      .toBuffer()
    expect((await transformChapterPage(avif)).width).toBe(64)

    await expect(
      transformChapterPage(Buffer.from("BM invalid"))
    ).rejects.toBeInstanceOf(ChapterImageError)
    await expect(
      transformChapterPage(Buffer.alloc(CHAPTER_PAGE_MAX_INPUT_BYTES + 1))
    ).rejects.toBeInstanceOf(ChapterImageError)
  })
})
