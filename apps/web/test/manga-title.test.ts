import assert from "node:assert/strict"

import {
  largestFittingFontSize,
  mangaTitleFitConstraints,
} from "../app/(site)/manga/[id]/[slug]/manga-title"

assert.deepEqual(mangaTitleFitConstraints(227), {
  maxFontSize: 32,
  maxLines: 5,
  minFontSize: 20,
})
assert.deepEqual(mangaTitleFitConstraints(478), {
  maxFontSize: 47,
  maxLines: 4,
  minFontSize: 26,
})
assert.deepEqual(mangaTitleFitConstraints(1168), {
  maxFontSize: 64,
  maxLines: 3,
  minFontSize: 32,
})
assert.equal(
  largestFittingFontSize(20, 64, (size) => size <= 40),
  40
)
assert.equal(
  largestFittingFontSize(20, 64, () => false),
  20
)

console.log("Manga title checks passed")
