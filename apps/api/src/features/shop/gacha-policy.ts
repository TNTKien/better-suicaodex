// Versioned normal-chest rules; banners and editable per-item weights are not in 10E.3.
export const NORMAL_GACHA_RULE = {
  version: 1,
  price: "5",
  rateDenominator: 10_000,
  rates: { R: 8_750, SR: 1_000, SSR: 250 },
  duplicateRefund: { R: "1", SR: "5", SSR: "20" },
  srPity: 10,
  ssrPity: 50,
} as const

export type NormalGachaRule = typeof NORMAL_GACHA_RULE
