import { describe, expect, test } from "bun:test"
import { z } from "zod"

import { utf16MaxLength } from "../../src/shared/string-length"
import { utf16MaxLength as uiUtf16MaxLength } from "../../../../packages/ui/src/lib/string-length"
import { CommentBodySchema } from "../../src/features/comments/contract"
import { MangaCreateInputSchema } from "../../src/features/groups/manga-contract"

for (const [name, lengthChecks] of [
  ["API", utf16MaxLength],
  ["UI", uiUtf16MaxLength],
] as const) {
  describe(`${name} string length limits`, () => {
    test("keeps UTF-16 boundaries and OpenAPI length metadata", () => {
      const schema = z.string().check(...lengthChecks(2))
      for (const value of ["ab", "😀", "a\n", "a\u0301"])
        expect(schema.safeParse(value).success).toBe(true)
      for (const value of ["abc", "😀a", "a😀", "a\n\n"]) {
        const result = schema.safeParse(value)
        expect(result.success).toBe(false)
        if (!result.success)
          expect(result.error.issues).toMatchObject([
            { code: "too_big", maximum: 2, origin: "string" },
          ])
      }
      expect(z.toJSONSchema(schema).maxLength).toBe(2)
    })

    test("retains translated validation messages", () => {
      const schema = z.string().check(...lengthChecks(2, "Tối đa 2 ký tự."))
      const result = schema.safeParse("😀a")
      expect(result.success).toBe(false)
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("Tối đa 2 ký tự.")
    })
  })
}

test("comment and manga inputs keep their existing emoji limits", () => {
  expect(CommentBodySchema.safeParse("😀".repeat(2_000)).success).toBe(true)
  expect(CommentBodySchema.safeParse("😀".repeat(2_000) + "a").success).toBe(
    false
  )
  const manga = {
    title: "😀".repeat(127) + "a",
    originalLanguage: "ja",
    status: "ongoing",
    contentRating: "safe",
  }
  expect(MangaCreateInputSchema.safeParse(manga).success).toBe(true)
  expect(
    MangaCreateInputSchema.safeParse({ ...manga, title: "😀".repeat(128) })
      .success
  ).toBe(false)
})
