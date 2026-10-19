import { mangaRankingOptions as sharedMangaRankingOptions } from "@workspace/catalog/ranking"

import type { components } from "@/src/lib/generated/api"

export type MangaRanking = components["schemas"]["MangaRanking"]
export type MangaRankingMetric = Exclude<
  MangaRanking["meta"]["metric"],
  "score"
>
export type MangaRankingWindow = MangaRanking["meta"]["window"]

export function mangaRankingOptions(
  apiBaseUrl: string,
  metric: MangaRankingMetric,
  window: MangaRankingWindow
) {
  return sharedMangaRankingOptions<MangaRanking>(apiBaseUrl, metric, window)
}
