import { randomInt } from "node:crypto"
import { NORMAL_GACHA_RULE } from "./gacha-policy.js"

export type GachaRarity = keyof typeof NORMAL_GACHA_RULE.rates
export type GachaPity = { sinceSr: number; sinceSsr: number }
type RandomInt = (exclusiveMax: number) => number

// Pure rule/pity calculation. Only server code may inject a test RNG.
export function drawGacha<T extends { id: string; rarity: GachaRarity }>(
  pool: Readonly<Record<GachaRarity, readonly T[]>>,
  pity: GachaPity,
  rng: RandomInt = randomInt
) {
  const rule = NORMAL_GACHA_RULE
  if (
    !Number.isInteger(pity.sinceSr) ||
    !Number.isInteger(pity.sinceSsr) ||
    pity.sinceSr < 0 ||
    pity.sinceSr >= rule.srPity ||
    pity.sinceSsr < pity.sinceSr ||
    pity.sinceSsr >= rule.ssrPity
  )
    throw new RangeError("Invalid gacha pity")
  for (const rarity of ["R", "SR", "SSR"] as const)
    if (
      !pool[rarity].length ||
      pool[rarity].some((frame) => frame.rarity !== rarity)
    )
      throw new RangeError("Gacha requires a valid pool for every rarity")
  const pick = (max: number) => {
    const value = rng(max)
    if (!Number.isInteger(value) || value < 0 || value >= max)
      throw new RangeError("Invalid gacha RNG result")
    return value
  }
  const roll =
    pity.sinceSsr === rule.ssrPity - 1 ? null : pick(rule.rateDenominator)
  const rarity: GachaRarity =
    roll === null || roll < rule.rates.SSR
      ? "SSR"
      : pity.sinceSr === rule.srPity - 1 ||
          roll < rule.rates.SSR + rule.rates.SR
        ? "SR"
        : "R"
  const frame = pool[rarity][pick(pool[rarity].length)]!
  return {
    frame,
    rarity,
    pity: {
      sinceSr: rarity === "R" ? pity.sinceSr + 1 : 0,
      sinceSsr: rarity === "SSR" ? 0 : pity.sinceSsr + 1,
    },
  }
}
