import { groupRankingOptions as sharedGroupRankingOptions } from "@workspace/catalog/ranking"

import type { components } from "@/src/lib/generated/api"

export type GroupRanking = components["schemas"]["GroupRanking"]
export type GroupRankingWindow = GroupRanking["meta"]["window"]

export function groupRankingOptions(
  apiBaseUrl: string,
  window: GroupRankingWindow
) {
  return sharedGroupRankingOptions<GroupRanking>(apiBaseUrl, window)
}
