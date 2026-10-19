import {
  groupRankingOptions,
  mangaRankingOptions,
} from "@workspace/catalog/ranking"
import type { components } from "@/src/lib/generated/api"

export type MangaRanking = components["schemas"]["MangaRanking"]
export type MangaRankingWindow = MangaRanking["meta"]["window"]
export type GroupRanking = components["schemas"]["GroupRanking"]
export type GroupRankingWindow = GroupRanking["meta"]["window"]

export function topGroupsOptions(
  apiBaseUrl: string,
  window: GroupRankingWindow
) {
  return groupRankingOptions<GroupRanking>(apiBaseUrl, window, 5)
}

export function topViewOptions(apiBaseUrl: string, window: MangaRankingWindow) {
  return mangaRankingOptions<MangaRanking>(apiBaseUrl, "views", window)
}
