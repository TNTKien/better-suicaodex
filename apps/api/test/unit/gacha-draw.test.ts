import { expect, test } from "bun:test"
import {
  drawGacha,
  type GachaPity,
  type GachaRarity,
} from "../../src/features/shop/gacha-draw"
import { NORMAL_GACHA_RULE } from "../../src/features/shop/gacha-policy"
import {
  ChestPoolQuerySchema,
  UpdateChestSchema,
} from "../../src/features/shop/gacha-chests"

const pool = {
  R: [{ id: "r", rarity: "R" as const }],
  SR: [{ id: "sr", rarity: "SR" as const }],
  SSR: [{ id: "ssr", rarity: "SSR" as const }],
}
function roll(value: number, pity: GachaPity = { sinceSr: 0, sinceSsr: 0 }) {
  const calls: number[] = []
  const result = drawGacha(pool, pity, (max) => {
    calls.push(max)
    return max === NORMAL_GACHA_RULE.rateDenominator ? value : 0
  })
  return { ...result, calls }
}
test("base rate boundaries are exact integer intervals, with no statistical pass gate", () => {
  for (const [value, rarity] of [
    [0, "SSR"],
    [249, "SSR"],
    [250, "SR"],
    [1249, "SR"],
    [1250, "R"],
    [9999, "R"],
  ] as const)
    expect(roll(value).rarity).toBe(rarity)
  const counts = { R: 0, SR: 0, SSR: 0 }
  for (let value = 0; value < 10_000; value++) counts[roll(value).rarity]++
  expect(counts).toEqual(NORMAL_GACHA_RULE.rates)
})
test("tenth roll preserves 2.5% SSR and otherwise forces SR; fiftieth SSR takes precedence", () => {
  const atSr = { sinceSr: 9, sinceSsr: 9 }
  expect(roll(249, atSr)).toMatchObject({
    rarity: "SSR",
    pity: { sinceSr: 0, sinceSsr: 0 },
  })
  expect(roll(250, atSr)).toMatchObject({
    rarity: "SR",
    pity: { sinceSr: 0, sinceSsr: 10 },
  })
  expect(roll(9999, atSr).rarity).toBe("SR")
  const counts = { R: 0, SR: 0, SSR: 0 }
  for (let value = 0; value < 10_000; value++)
    counts[roll(value, atSr).rarity]++
  expect(counts).toEqual({ R: 0, SR: 9750, SSR: 250 })
  for (const sinceSr of [0, 9])
    expect(roll(-1, { sinceSr, sinceSsr: 49 })).toMatchObject({
      rarity: "SSR",
      pity: { sinceSr: 0, sinceSsr: 0 },
      calls: [1],
    })
})
test("R advances both counters, SR resets only ten, early/duplicate SSR resets both", () => {
  const before = { sinceSr: 8, sinceSsr: 48 }
  expect(roll(9999, before).pity).toEqual({ sinceSr: 9, sinceSsr: 49 })
  expect(roll(250, before).pity).toEqual({ sinceSr: 0, sinceSsr: 49 })
  expect(roll(0, before).pity).toEqual({ sinceSr: 0, sinceSsr: 0 })
  expect(before).toEqual({ sinceSr: 8, sinceSsr: 48 })
  // Ownership and chest IDs are intentionally not inputs: duplicates/change of chest cannot reset counters.
  let shared = { sinceSr: 0, sinceSsr: 0 }
  for (let n = 0; n < 50; n++) {
    const result = roll(9999, shared)
    if (n === 9 || n === 19 || n === 29 || n === 39)
      expect(result.rarity).toBe("SR")
    if (n === 49) expect(result.rarity).toBe("SSR")
    shared = result.pity
  }
  expect(shared).toEqual({ sinceSr: 0, sinceSsr: 0 })
})
test("every member has one uniform index, including already-owned frames and pools of size one", () => {
  for (const rarity of ["R", "SR", "SSR"] as const) {
    const members = Array.from({ length: 5 }, (_, n) => ({
      id: `${rarity}-${n}`,
      rarity,
    }))
    const larger = { ...pool, [rarity]: members }
    const base = { R: 9999, SR: 250, SSR: 0 }[rarity]
    for (let index = 0; index < members.length; index++) {
      const maxima: number[] = []
      const result = drawGacha(larger, { sinceSr: 0, sinceSsr: 0 }, (max) => {
        maxima.push(max)
        return maxima.length === 1 ? base : index
      })
      expect(result.frame.id).toBe(members[index]!.id)
      expect(maxima).toEqual([10000, 5])
    }
  }
  expect(roll(0).frame).toBe(pool.SSR[0])
  // Smoke-check production crypto's shape, not the distribution of a random sample.
  const result = drawGacha(pool, { sinceSr: 0, sinceSsr: 0 })
  expect(pool[result.rarity]).toContain(result.frame)
})
test("invalid counters/RNG/missing or misclassified pools fail without fallback", () => {
  for (const pity of [
    { sinceSr: -1, sinceSsr: 0 },
    { sinceSr: 10, sinceSsr: 10 },
    { sinceSr: 0, sinceSsr: 50 },
    { sinceSr: 1, sinceSsr: 0 },
    { sinceSr: 0.5, sinceSsr: 1 },
    { sinceSr: 0, sinceSsr: NaN },
  ])
    expect(() => drawGacha(pool, pity, () => 0)).toThrow(RangeError)
  for (const value of [-1, 10000, NaN, Infinity, 1.5])
    expect(() => roll(value)).toThrow(RangeError)
  for (const value of [-1, 1, NaN, 0.5]) {
    let calls = 0
    expect(() =>
      drawGacha(pool, { sinceSr: 0, sinceSsr: 0 }, () =>
        ++calls === 1 ? 0 : value
      )
    ).toThrow(RangeError)
  }
  for (const rarity of ["R", "SR", "SSR"] as GachaRarity[]) {
    let calls = 0
    expect(() =>
      drawGacha({ ...pool, [rarity]: [] }, { sinceSr: 9, sinceSsr: 49 }, () => {
        calls++
        return 0
      })
    ).toThrow(RangeError)
    expect(calls).toBe(0)
  }
  expect(() =>
    drawGacha({ ...pool, R: pool.SR }, { sinceSr: 0, sinceSsr: 0 }, () => 0)
  ).toThrow(RangeError)
})
test("chest preparation inputs are strict and bounded; no stock/price/RNG fields", () => {
  expect(
    UpdateChestSchema.parse({ expectedVersion: 1, saleEnabled: false })
  ).toEqual({ expectedVersion: 1, saleEnabled: false })
  for (const expectedVersion of [0, -1, 1.5, 2147483648])
    expect(() =>
      UpdateChestSchema.parse({ expectedVersion, saleEnabled: true })
    ).toThrow()
  for (const field of ["price", "stock", "rarity", "seed"])
    expect(() =>
      UpdateChestSchema.parse({
        expectedVersion: 1,
        saleEnabled: true,
        [field]: 1,
      })
    ).toThrow()
  expect(() => ChestPoolQuerySchema.parse({ limit: 101 })).toThrow()
  expect(() => ChestPoolQuerySchema.parse({ rarity: "limited" })).toThrow()
  expect(ChestPoolQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
})
