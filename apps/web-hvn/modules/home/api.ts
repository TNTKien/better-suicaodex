import "server-only"

import {
  getGroupRanking,
  getMangaList,
  getMangaRanking,
  getRecentComments,
  getRandomManga,
} from "@workspace/catalog/server"
import type { components, paths } from "@/src/lib/generated/api"

export type MangaSummary = components["schemas"]["MangaSummary"]
type MangaList = components["schemas"]["MangaList"]
type MangaRanking = components["schemas"]["MangaRanking"]
type GroupRanking = components["schemas"]["GroupRanking"]
type RecentCommentList = components["schemas"]["RecentCommentList"]
type RandomManga = components["schemas"]["RandomManga"]

const latestOptions = {
  sort: "latestChapter",
  direction: "desc",
  limit: 18,
} satisfies NonNullable<paths["/v1/manga"]["get"]["parameters"]["query"]>
const featuredOptions = {
  metric: "score",
  window: "week",
  limit: 6,
} satisfies NonNullable<
  paths["/v1/rankings/manga"]["get"]["parameters"]["query"]
>

const recentOptions = {
  sort: "publishedAt",
  direction: "desc",
  limit: 6,
} satisfies NonNullable<paths["/v1/manga"]["get"]["parameters"]["query"]>
const topViewOptions = {
  metric: "views",
  window: "day",
  limit: 10,
} satisfies NonNullable<
  paths["/v1/rankings/manga"]["get"]["parameters"]["query"]
>

export async function getHomeCatalog() {
  const [
    latestResult,
    featuredResult,
    recentResult,
    topViewResult,
    groupsResult,
    commentsResult,
    randomResult,
  ] = await Promise.allSettled([
    getMangaList<MangaList>(latestOptions),
    getMangaRanking<MangaRanking>(featuredOptions),
    getMangaList<MangaList>(recentOptions),
    getMangaRanking<MangaRanking>(topViewOptions),
    getGroupRanking<GroupRanking>({ window: "day", limit: 5 }),
    getRecentComments<RecentCommentList>(6),
    getRandomManga<RandomManga>(6),
  ])
  const latest =
    latestResult.status === "fulfilled" ? latestResult.value.data : []
  const ranked =
    featuredResult.status === "fulfilled"
      ? featuredResult.value.data.map(({ manga }) => manga)
      : []
  const featured =
    ranked.length > 0 ? ranked : latest.slice(0, featuredOptions.limit)

  return {
    latest,
    featured,
    recent: recentResult.status === "fulfilled" ? recentResult.value.data : [],
    recentError: recentResult.status === "rejected",
    initialRanking:
      topViewResult.status === "fulfilled" ? topViewResult.value : undefined,
    initialGroupRanking:
      groupsResult.status === "fulfilled" ? groupsResult.value : undefined,
    comments:
      commentsResult.status === "fulfilled" ? commentsResult.value.data : [],
    commentsError: commentsResult.status === "rejected",
    random: randomResult.status === "fulfilled" ? randomResult.value.data : [],
    randomError: randomResult.status === "rejected",
    latestError: latestResult.status === "rejected",
    featuredError:
      featuredResult.status === "rejected" && featured.length === 0,
  }
}
