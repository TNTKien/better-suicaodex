import { expect, test } from "bun:test"

import {
  chapterNavigation,
  chapterSlots,
  mangaReadingEntries,
  type ChapterRelease,
} from "../../src/features/catalog/releases"
import {
  ChapterCreateInputSchema,
  ChapterUpdateInputSchema,
} from "../../src/features/groups/chapter-contract"
import {
  MangaCreateInputSchema,
  MangaUpdateInputSchema,
} from "../../src/features/groups/manga-contract"

function release(
  id: string,
  number: string | null,
  patch: Partial<ChapterRelease> = {}
): ChapterRelease {
  return {
    id,
    number,
    readingKey: number === null ? `id:${id}` : `n:${number}`,
    isDefault: false,
    laneGroupIds: ["a"],
    groups: [{ id: "a", slug: "a", name: "A" }],
    volume: null,
    title: null,
    language: "vi",
    pageCount: 1,
    publishedAt: "2026-10-01T00:00:00Z",
    uploader: { id: null, name: "System" },
    statistics: { views: 0, comments: 0 },
    ...patch,
  }
}

test("a baseline default cannot be replaced by a newer release or volume metadata", () => {
  const slots = chapterSlots(
    [
      release("old", "11", {
        isDefault: true,
        volume: "2",
        publishedAt: "2020-01-01T00:00:00Z",
      }),
      release("new", "11", {}),
      release("next", "11.5"),
    ],
    "global"
  )
  expect(slots).toHaveLength(2)
  expect(slots[0]).toMatchObject({
    volume: null,
    defaultChapterId: "old",
    automaticOrder: true,
  })
  expect(slots[0]!.releases.map((r) => r.id)).toEqual(["old", "new"])
  expect(slots[0]!.releases[0]).not.toHaveProperty("laneGroupIds")
  expect(slots[0]!.releases[0]).not.toHaveProperty("readingKey")
})

test("navigation skips variants and uses exact group set without provenance metadata", () => {
  const rows = [
    release("a", "11", { laneGroupIds: ["b", "a"] }),
    release("b", "11"),
    release("c", "11.5", { laneGroupIds: ["a", "b"] }),
    release("d", "12", { language: "en" }),
  ]
  const navigation = chapterNavigation(rows, "a", "global")
  expect(navigation.previous.state).toBe("boundary")
  expect(navigation.next).toMatchObject({
    state: "ready",
    selectedChapterId: "c",
  })
  expect(navigation.alternatives.map((r) => r.id)).toEqual(["b"])
  expect(chapterNavigation(rows, "c", "global").next.state).toBe("boundary")
})

test("missing lane stops at the immediate slot without silently switching or skipping ahead", () => {
  for (const next of [
    release("b", "12", { laneGroupIds: ["b"] }),
    release("b", "12", { laneGroupIds: [] }),
  ]) {
    const navigation = chapterNavigation(
      [release("a", "11"), next, release("c", "15")],
      "a",
      "global"
    )
    expect(navigation.next).toMatchObject({
      state: "choice-required",
      selectedChapterId: null,
    })
    expect(navigation.next.options.map((r) => r.id)).toEqual(["b"])
    expect(
      chapterNavigation(
        [release("a", "11"), next, release("c", "15")],
        "c",
        "global"
      ).previous.state
    ).toBe("choice-required")
  }
})

test("multiple releases in a lane require a choice unless a pinned default resolves it", () => {
  const rows = [release("a", "1"), release("b", "2"), release("c", "2")]
  expect(chapterNavigation(rows, "a", "global").next.state).toBe(
    "choice-required"
  )
  expect(chapterSlots(rows, "global")[1]!.defaultChapterId).toBeNull()
  rows[2]!.isDefault = true
  expect(chapterNavigation(rows, "a", "global").next.selectedChapterId).toBe(
    "c"
  )
})

test("NULL chapters keep individual identity, a single oneshot is readable, multiple NULLs are unordered", () => {
  const one = release("one", null)
  expect(mangaReadingEntries([one], "global")[0]!.first.selectedChapterId).toBe(
    "one"
  )
  const rows = [one, release("two", null)]
  expect(chapterSlots(rows, "global")).toHaveLength(2)
  expect(mangaReadingEntries(rows, "global")[0]!.first).toMatchObject({
    state: "unordered",
    selectedChapterId: null,
  })
  expect(chapterNavigation(rows, "one", "global").next.state).toBe("unordered")
})

test("volume reset slots and language entries stay separate; missing volume is unordered", () => {
  const rows = [
    release("v1", "1", { readingKey: "v:one:1", volume: "1" }),
    release("v2", "1", { readingKey: "v:two:1", volume: "2" }),
    release("missing", "1", { readingKey: "id:missing" }),
    release("en", "50", {
      language: "en",
      volume: "1",
      readingKey: "v:one:50",
    }),
  ]
  expect(chapterSlots(rows, "volume")).toHaveLength(4)
  expect(chapterNavigation(rows, "v1", "volume").next.selectedChapterId).toBe(
    "v2"
  )
  expect(chapterNavigation(rows, "missing", "volume").next.state).toBe(
    "unordered"
  )
  expect(
    mangaReadingEntries(rows, "volume").map((e) => [
      e.language,
      e.first.selectedChapterId,
      e.last.selectedChapterId,
    ])
  ).toEqual([
    ["vi", "v1", "v2"],
    ["en", "en", "en"],
  ])
})

test("native chapter inputs preserve up to three decimals and reject provenance/default overrides", () => {
  expect(ChapterCreateInputSchema.parse({ number: "11.125" }).number).toBe(
    "11.125"
  )
  expect(
    ChapterCreateInputSchema.safeParse({ number: "11.1251" }).success
  ).toBe(false)
  for (const extra of [
    { unexpectedField: "rejected" },
    { unexpectedField: "rejected" },
    { isDefault: true },
    { numberingMode: "volume" },
  ]) {
    expect(
      ChapterCreateInputSchema.safeParse({ number: "1", ...extra }).success
    ).toBe(false)
    expect(
      ChapterUpdateInputSchema.safeParse({
        number: "1",
        expectedVersion: 1,
        ...extra,
      }).success
    ).toBe(false)
  }
})

test("manga provenance and numbering mode cannot be forged through ordinary writes", () => {
  const input = {
    title: "Native",
    originalLanguage: "ja",
    status: "ongoing",
    contentRating: "safe",
  }
  expect(MangaCreateInputSchema.safeParse(input).success).toBe(true)
  for (const extra of [
    { unexpectedField: "rejected" },
    { unexpectedField: "rejected" },
    { sourceId: "fake" },
    { numberingMode: "volume" },
  ]) {
    expect(
      MangaCreateInputSchema.safeParse({ ...input, ...extra }).success
    ).toBe(false)
    expect(
      MangaUpdateInputSchema.safeParse({
        ...input,
        expectedVersion: 1,
        ...extra,
      }).success
    ).toBe(false)
  }
})
