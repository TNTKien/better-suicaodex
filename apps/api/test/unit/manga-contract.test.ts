import { describe, expect, test } from "bun:test"

import { MangaCreateInputSchema } from "../../src/features/groups/manga-contract"

const input = {
  title: "Manga",
  description: "**In đậm** và [liên kết](https://example.com).",
  originalLanguage: "ja",
  status: "ongoing",
  contentRating: "safe",
}

describe("manga management contract", () => {
  test("accepts basic Markdown and rejects HTML and Markdown images", () => {
    expect(MangaCreateInputSchema.safeParse(input).success).toBe(true)
    expect(
      MangaCreateInputSchema.safeParse({ ...input, description: "<b>HTML</b>" })
        .success
    ).toBe(false)
    expect(
      MangaCreateInputSchema.safeParse({
        ...input,
        description: "![ảnh](https://example.com/a.png)",
      }).success
    ).toBe(false)
  })
})
