import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  caseRarities,
  caseWinnerIndex,
  caseLoopLength,
  caseCruiseDuration,
  caseBrakeDuration,
  createCaseReel,
  type CaseReward,
} from "../modules/shop/case-reel"

const pool: CaseReward[] = caseRarities.map((rarity) => ({
  id: `frame-${rarity}`,
  name: `Khung ${rarity}`,
  rarity,
  topic: null,
  frame: {
    id: `frame-${rarity}`,
    name: `Khung ${rarity}`,
    assetUrl: "https://example.test/animated.webp",
    previewUrl: "https://example.test/preview.webp",
    animated: true,
    width: 318,
    height: 318,
    displayScale: 125,
    offsetX: 0,
    offsetY: 0,
  },
}))

for (const winner of pool) {
  const before = structuredClone(pool)
  for (let run = 0; run < 10; run++) {
    const reel = createCaseReel(pool, winner)
    assert.equal(reel.items.length, 42)
    assert.equal(reel.winner, winner)
    assert.equal(reel.items[caseWinnerIndex], winner)
    assert.ok(reel.items.every((item) => pool.includes(item)))
    assert.ok(reel.items.length - caseWinnerIndex > 4)
  }
  assert.deepEqual(pool, before)
  const singleton = createCaseReel([], winner)
  assert.ok(singleton.items.every((item) => item === winner))
}
const separateWinner = {
  ...pool[0]!,
  id: "fixed-result",
  name: "Kết quả từ receipt, ảnh không còn khả dụng",
  frame: null,
}
assert.equal(
  createCaseReel(pool, separateWinner).items[caseWinnerIndex],
  separateWinner
)
const waiting = createCaseReel(pool, null)
assert.equal(waiting.winner, null)
assert.equal(waiting.items.length, 42)
for (let index = 0; index < waiting.items.length - caseLoopLength; index++)
  assert.equal(waiting.items[index], waiting.items[index + caseLoopLength])
const emptyWaiting = createCaseReel([], null)
assert.equal(emptyWaiting.winner, null)
assert.ok(
  emptyWaiting.items.every(
    (item) => item.frame === null && item.id === "pending"
  )
)
const css = readFileSync(
  new URL("../../../packages/ui/src/styles/globals.css", import.meta.url),
  "utf8"
)
assert.match(
  css,
  /gacha-case-cruise var\(--case-cruise-duration\) linear infinite/
)
const easing = css.match(/gacha-case-roll[^;]*cubic-bezier\(([^)]+)\)/)![1]!
const [x1, y1, x2, y2] = easing.split(",").map(Number) as [
  number,
  number,
  number,
  number,
]
const derivative = (t: number, p1: number, p2: number) =>
  3 * (1 - t) ** 2 * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t ** 2 * (1 - p2)
for (const width of [168, 140]) {
  const gap = 10
  const stride = width + gap
  const cruiseSpeed = (caseLoopLength * stride) / caseCruiseDuration
  for (const phase of [0, 0.01, 0.25, 0.5, 0.99, 1]) {
    const startX = -width / 2 - phase * caseLoopLength * stride
    const endX = -caseWinnerIndex * stride - width / 2
    const duration = caseBrakeDuration(startX, width, gap)
    assert.ok(duration >= 4400 && duration <= 6800)
    assert.ok(
      Math.abs(((startX - endX) / duration) * (y1 / x1) - cruiseSpeed) < 1e-9
    )
    let previousSpeed = cruiseSpeed
    for (let step = 1; step <= 100; step++) {
      const t = step / 100
      const speed =
        ((startX - endX) / duration) *
        (derivative(t, y1, y2) / derivative(t, x1, x2))
      assert.ok(speed >= 0 && speed <= previousSpeed + 1e-9)
      previousSpeed = speed
    }
    assert.equal(previousSpeed, 0)
  }
}
console.log(
  "Case reel fixed-result, continuous speed and deceleration checks passed"
)
