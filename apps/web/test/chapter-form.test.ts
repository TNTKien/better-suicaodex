import assert from "node:assert/strict"

import { chapterFormSchema } from "../app/manage/manga/[mangaId]/chapters/new/form-schema"

const groupId = "3654281a-b35c-4e9d-8413-b40e944c9edd"
const result = chapterFormSchema.safeParse({
  groupIds: [groupId],
  oneShot: false,
  volumeNumber: "2.5",
  number: "12.5",
  title: "  Chương mở đầu  ",
})
assert.equal(result.success, true)
if (result.success)
  assert.deepEqual(result.data, {
    groupIds: [groupId],
    volumeNumber: "2.5",
    number: "12.5",
    title: "Chương mở đầu",
    language: "vi",
  })

const oneShot = chapterFormSchema.safeParse({
  groupIds: [],
  oneShot: true,
  volumeNumber: "2",
  number: "1",
  title: "",
})
assert.equal(oneShot.success, true)
if (oneShot.success) {
  assert.equal(oneShot.data.volumeNumber, null)
  assert.equal(oneShot.data.number, null)
}

assert.equal(
  chapterFormSchema.safeParse({
    groupIds: [],
    oneShot: false,
    volumeNumber: "",
    number: "1.23",
    title: "",
  }).success,
  false
)

console.log("Chapter form checks passed")
