import assert from "node:assert/strict"

import {
  mangaProgressOptions,
  mangaProgressKey,
  readChapterIdSet,
  resumeChapterHref,
} from "../modules/reading/progress"

const progress = {
  chapterId: "current-chapter",
  mangaId: "manga-id",
  readAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
}

assert.equal(resumeChapterHref(), null)
assert.equal(resumeChapterHref(progress), "/chapter/current-chapter")
assert.notDeepEqual(
  mangaProgressKey("https://api.example", "user-a", "manga-id"),
  mangaProgressKey("https://api.example", "user-b", "manga-id")
)
assert.equal(
  mangaProgressOptions("https://api.example", "user-a", "manga-id").staleTime,
  30_000
)
assert.deepEqual([...readChapterIdSet([progress])], ["current-chapter"])

console.log("Reading progress action checks passed")
