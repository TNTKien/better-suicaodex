import type { ChestPool } from "./admin-api"

export type CaseReward = {
  id: string
  name: string
  rarity: ChestPool["data"][number]["rarity"]
  frame: ChestPool["data"][number]["frame"] | null
  topic: ChestPool["data"][number]["topic"]
}
export const caseRarities = ["R", "SR", "SSR"] as const
export const caseWinnerIndex = 34
export const caseLoopLength = 12
export const caseCruiseDuration = 1200

export function caseBrakeDuration(
  startX: number,
  cardWidth: number,
  gap: number
) {
  const stride = cardWidth + gap
  const distance = startX + caseWinnerIndex * stride + cardWidth / 2
  const speed = (caseLoopLength * stride) / caseCruiseDuration
  // The braking curve starts at twice its average speed; match the cruise without accelerating.
  return (2 * distance) / speed
}

// The repeating strip can start before the server supplies the stopping card.
export function createCaseReel(pool: CaseReward[], winner: CaseReward | null) {
  const samples = pool.length
    ? pool
    : [
        winner ?? {
          id: "pending",
          name: "Khung Avatar",
          rarity: "R" as const,
          frame: null,
          topic: null,
        },
      ]
  const loop = Array.from(
    { length: caseLoopLength },
    () => samples[Math.floor(Math.random() * samples.length)]!
  )
  const items = Array.from(
    { length: 42 },
    (_, index) => loop[index % caseLoopLength]!
  )
  if (winner) items[caseWinnerIndex] = winner
  return { items, winner }
}
