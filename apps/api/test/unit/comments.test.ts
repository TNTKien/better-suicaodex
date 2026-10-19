import { describe, expect, test } from "bun:test"

import { CommentBodySchema } from "../../src/features/comments/contract"
import {
  censorForbiddenWords,
  normalizeForbiddenWord,
} from "../../src/features/comments/forbidden-words"

describe("comment content", () => {
  test("allows text, emoji, basic Markdown and stickers but rejects HTML and images", () => {
    for (const body of [
      "Hay quá 😍",
      "**Đậm**, [link](http://localhost:3000) và :doro-think:",
    ])
      expect(CommentBodySchema.safeParse(body).success).toBe(true)

    for (const body of ["<b>HTML</b>", "![ảnh](https://example.com/a.png)"])
      expect(CommentBodySchema.safeParse(body).success).toBe(false)
  })

  test("censors literal forbidden words case-insensitively without cascading replacements", () => {
    expect(normalizeForbiddenWord("  Cụm   Từ  ")).toEqual({
      word: "Cụm Từ",
      normalizedWord: "cụm từ",
    })
    expect(
      censorForbiddenWords("123 ABCDE abc a+b A+B xyz", [
        "abc",
        "abcde",
        "a+b",
        "*",
      ])
    ).toBe("123 *** *** *** *** xyz")
  })
})
