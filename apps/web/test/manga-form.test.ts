import assert from "node:assert/strict"

import {
  MAX_PUBLICATION_YEAR,
  mangaFormSchema,
} from "../app/manage/manga/new/form-schema"

const input = {
  title: " Manga ",
  alternativeTitles: ["Tên khác", "", "Tên khác"],
  description: "**In đậm** và [liên kết](https://example.com).",
  originalLanguage: "ja",
  publicationDemographic: null,
  status: "ongoing",
  contentRating: "safe",
  year: "2024",
  lastVolume: "",
  lastChapter: "",
  links: {},
  tagIds: [],
  authorIds: [],
  artistIds: [],
  groupIds: [],
  cover: null,
  coverUploadId: null,
}

const result = mangaFormSchema.safeParse(input)
assert.equal(result.success, true)
if (result.success) {
  assert.equal(result.data.title, "Manga")
  assert.deepEqual(result.data.alternativeTitles, ["Tên khác"])
  assert.equal(result.data.year, 2024)
}
assert.equal(
  mangaFormSchema.safeParse({ ...input, description: "<b>HTML</b>" }).success,
  false
)
assert.equal(
  mangaFormSchema.safeParse({
    ...input,
    groupIds: Array(21).fill(crypto.randomUUID()),
  }).success,
  false
)
assert.equal(
  mangaFormSchema.safeParse({
    ...input,
    description: "![ảnh](https://example.com/a.png)",
  }).success,
  false
)
assert.equal(
  mangaFormSchema.safeParse({
    ...input,
    year: String(MAX_PUBLICATION_YEAR),
  }).success,
  true
)
assert.equal(
  mangaFormSchema.safeParse({
    ...input,
    year: String(MAX_PUBLICATION_YEAR + 1),
  }).success,
  false
)

console.log("Manga form checks passed")
