import type { OpenAPIHono } from "@hono/zod-openapi"
import { and, eq, inArray, ne, sql } from "drizzle-orm"
import { formatISO } from "date-fns"

import {
  cover,
  chapter,
  chapterGroup,
  chapterStats,
  manga,
  mangaEngagementDaily,
  mangaStats,
  organization,
  translationGroupMangaEngagementDaily,
  translationGroupMangaViewStats,
  translationGroupProfile,
} from "../../db/schema.js"
import {
  catalogManga,
  hydrateMangaRows,
  mangaSummaryColumns,
  publicGroup,
  readableChapter,
  type CatalogDependencies,
  type CatalogVisibility,
  visibleManga,
} from "../catalog/routes.js"
import {
  listGroupRankingRoute,
  listMangaRankingRoute,
  type GroupRanking,
  type MangaRanking,
  type RankingMetric,
  type RankingWindow,
} from "./contract.js"
import {
  ENGAGEMENT_TIME_ZONE,
  engagementBucketDate,
  engagementWindowStart,
} from "./engagement.js"

const MIN_POSITIVE_SAMPLES = 20

type RankingRow = {
  mangaId: string | null
  views: string | null
  follows: string | null
  comments: string | null
  score: number | string | null
  viewSamples: string
  followSamples: string
  commentSamples: string
}

type GroupRankingRow = {
  groupId: string
  name: string
  slug: string
  avatarUrl: string | null
  inactive: boolean
  views: string
  chapters: string
  releases: string
  score: number | string
}

function windowDays(window: RankingWindow) {
  return window === "day" ? 1 : window === "week" ? 7 : 30
}

function rankingSource(
  window: RankingWindow,
  bucketDate: string,
  startDate: string
) {
  if (window === "all-time")
    return sql`
      select ${mangaStats.mangaId} manga_id,
        ${mangaStats.views} views,
        ${mangaStats.follows} follows,
        ${mangaStats.comments} comments
      from ${mangaStats}
    `

  return sql`
    select ${mangaEngagementDaily.mangaId} manga_id,
      sum(${mangaEngagementDaily.views})::bigint views,
      greatest(
        sum(${mangaEngagementDaily.followAdds}) -
          sum(${mangaEngagementDaily.followRemoves}),
        0
      )::bigint follows,
      sum(${mangaEngagementDaily.comments})::bigint comments
    from ${mangaEngagementDaily}
    where ${mangaEngagementDaily.bucketDate}
      between ${startDate}::date and ${bucketDate}::date
    group by ${mangaEngagementDaily.mangaId}
  `
}

function rankingOrder(metric: RankingMetric) {
  if (metric === "views") return sql`views desc, manga_id asc`
  if (metric === "follows") return sql`follows desc, manga_id asc`
  if (metric === "comments") return sql`comments desc, manga_id asc`
  return sql`score desc, follows desc, views desc, comments desc, manga_id asc`
}

async function loadRanking(
  dependencies: CatalogDependencies,
  metric: RankingMetric,
  window: RankingWindow,
  limit: number,
  bucketDate: string,
  now: Date,
  visibility: CatalogVisibility
): Promise<MangaRanking> {
  const { assetBaseUrl, database } = dependencies
  const startDate =
    window === "all-time"
      ? bucketDate
      : engagementWindowStart(windowDays(window), now)
  const source = rankingSource(window, bucketDate, startDate)
  const onlyScored = metric === "score" ? sql`where score is not null` : sql``
  const result = await database.execute(sql<RankingRow>`
    with source as (${source}),
    eligible as (
      select ${manga.id} manga_id,
        coalesce(source.views, 0)::bigint views,
        coalesce(source.follows, 0)::bigint follows,
        coalesce(source.comments, 0)::bigint comments
      from ${manga}
      left join source on source.manga_id = ${manga.id}
      where ${catalogManga(database, visibility)}
    ),
    caps as (
      select
        count(*) filter (where views > 0) view_samples,
        count(*) filter (where follows > 0) follow_samples,
        count(*) filter (where comments > 0) comment_samples,
        percentile_cont(0.99) within group (order by views)
          filter (where views > 0) view_cap,
        percentile_cont(0.99) within group (order by follows)
          filter (where follows > 0) follow_cap,
        percentile_cont(0.99) within group (order by comments)
          filter (where comments > 0) comment_cap
      from eligible
    ),
    normalized as (
      select eligible.*,
        case when caps.view_samples >= ${MIN_POSITIVE_SAMPLES}
          then least(10, 10 * ln(1 + views::double precision) / ln(1 + view_cap))
        end view_score,
        case when caps.follow_samples >= ${MIN_POSITIVE_SAMPLES}
          then least(10, 10 * ln(1 + follows::double precision) / ln(1 + follow_cap))
        end follow_score,
        case when caps.comment_samples >= ${MIN_POSITIVE_SAMPLES}
          then least(10, 10 * ln(1 + comments::double precision) / ln(1 + comment_cap))
        end comment_score
      from eligible cross join caps
    ),
    scored as (
      select normalized.*,
        case when view_score is null and follow_score is null and comment_score is null
          then null
          else (
            coalesce(view_score * 0.45, 0) +
            coalesce(follow_score * 0.35, 0) +
            coalesce(comment_score * 0.20, 0)
          ) / (
            case when view_score is null then 0 else 0.45 end +
            case when follow_score is null then 0 else 0.35 end +
            case when comment_score is null then 0 else 0.20 end
          )
        end score
      from normalized
    )
    select ranked.manga_id "mangaId",
      ranked.views::text views,
      ranked.follows::text follows,
      ranked.comments::text comments,
      ranked.score,
      caps.view_samples::text "viewSamples",
      caps.follow_samples::text "followSamples",
      caps.comment_samples::text "commentSamples"
    from caps
    left join lateral (
      select * from scored
      ${onlyScored}
      order by ${rankingOrder(metric)}
      limit ${limit}
    ) ranked on true
  `)
  const first = result.rows[0]!
  const activeSignals = {
    views: Number(first.viewSamples) >= MIN_POSITIVE_SAMPLES,
    follows: Number(first.followSamples) >= MIN_POSITIVE_SAMPLES,
    comments: Number(first.commentSamples) >= MIN_POSITIVE_SAMPLES,
  }
  const ranked = result.rows.filter(
    (row): row is RankingRow & { mangaId: string } => row.mangaId !== null
  )
  const ids = ranked.map(({ mangaId }) => mangaId)
  const mangaRows = ids.length
    ? await database
        .select(mangaSummaryColumns)
        .from(manga)
        .leftJoin(
          cover,
          and(eq(cover.mangaId, manga.id), eq(cover.isPrimary, true))
        )
        .where(and(inArray(manga.id, ids), catalogManga(database, visibility)))
    : []
  const summaries = new Map(
    (await hydrateMangaRows(database, assetBaseUrl, mangaRows, visibility)).map(
      (item) => [item.id, item]
    )
  )
  const data = ranked.flatMap((row) => {
    const item = summaries.get(row.mangaId)
    return item
      ? [
          {
            rank: 0,
            manga: item,
            views: Number(row.views),
            follows: Number(row.follows),
            comments: Number(row.comments),
            score:
              metric === "score" && row.score !== null
                ? Number(row.score)
                : null,
          },
        ]
      : []
  })
  data.forEach((item, index) => (item.rank = index + 1))

  return {
    data,
    meta: {
      metric,
      window,
      limit,
      bucketDate,
      calculatedAt: formatISO(now),
      insufficientData:
        metric === "score" && !Object.values(activeSignals).some(Boolean),
      activeSignals,
    },
  }
}

function groupViewSource(
  window: RankingWindow,
  bucketDate: string,
  startDate: string
) {
  if (window === "all-time")
    return sql`
      select ${translationGroupMangaViewStats.groupId} group_id,
        ${translationGroupMangaViewStats.mangaId} manga_id,
        ${translationGroupMangaViewStats.views} views
      from ${translationGroupMangaViewStats}
    `

  return sql`
    select ${translationGroupMangaEngagementDaily.groupId} group_id,
      ${translationGroupMangaEngagementDaily.mangaId} manga_id,
      sum(${translationGroupMangaEngagementDaily.views})::numeric views
    from ${translationGroupMangaEngagementDaily}
    where ${translationGroupMangaEngagementDaily.bucketDate}
      between ${startDate}::date and ${bucketDate}::date
    group by ${translationGroupMangaEngagementDaily.groupId},
      ${translationGroupMangaEngagementDaily.mangaId}
  `
}

function groupActualViewSource(
  window: RankingWindow,
  bucketDate: string,
  startDate: string,
  visibility: CatalogVisibility
) {
  if (window === "all-time")
    return sql`
      select ${chapterGroup.groupId} group_id,
        ${chapter.mangaId} manga_id,
        sum(coalesce(${chapterStats.views}, 0))::numeric views
      from ${chapterGroup}
      inner join ${chapter} on ${chapter.id} = ${chapterGroup.chapterId}
      inner join ${manga} on ${manga.id} = ${chapter.mangaId}
      left join ${chapterStats} on ${chapterStats.chapterId} = ${chapter.id}
      where ${readableChapter(visibility)}
        and ${visibleManga(visibility)}
      group by ${chapterGroup.groupId}, ${chapter.mangaId}
    `

  return sql`
    select ${translationGroupMangaEngagementDaily.groupId} group_id,
      ${translationGroupMangaEngagementDaily.mangaId} manga_id,
      sum(${translationGroupMangaEngagementDaily.actualViews})::numeric views
    from ${translationGroupMangaEngagementDaily}
    where ${translationGroupMangaEngagementDaily.bucketDate}
      between ${startDate}::date and ${bucketDate}::date
    group by ${translationGroupMangaEngagementDaily.groupId},
      ${translationGroupMangaEngagementDaily.mangaId}
  `
}

async function loadGroupRanking(
  dependencies: CatalogDependencies,
  window: RankingWindow,
  limit: number,
  bucketDate: string,
  now: Date,
  visibility: CatalogVisibility
): Promise<GroupRanking> {
  const { database } = dependencies
  const startDate =
    window === "all-time"
      ? bucketDate
      : engagementWindowStart(windowDays(window), now)
  const viewSource = groupViewSource(window, bucketDate, startDate)
  const actualViewSource = groupActualViewSource(
    window,
    bucketDate,
    startDate,
    visibility
  )
  const chapterWindow =
    window === "all-time"
      ? sql``
      : sql`and (${chapter.publishedAt} at time zone ${ENGAGEMENT_TIME_ZONE})::date
          between ${startDate}::date and ${bucketDate}::date`

  const result = await database.execute(sql<GroupRankingRow>`
    with eligible_groups as (
      select ${organization.id} group_id,
        ${organization.name} name,
        ${organization.slug} slug,
        ${organization.logo} avatar_url,
        ${translationGroupProfile.inactive} inactive
      from ${organization}
      inner join ${translationGroupProfile}
        on ${translationGroupProfile.organizationId} = ${organization.id}
      where ${and(publicGroup, ne(organization.slug, "system"))}
    ), view_source as (${viewSource}),
    actual_view_source as (${actualViewSource}),
    score_view_totals as (
      select view_source.group_id,
        sum(view_source.views)::numeric views
      from view_source
      inner join eligible_groups
        on eligible_groups.group_id = view_source.group_id
      inner join ${manga} on ${manga.id} = view_source.manga_id
      where ${visibleManga(visibility)}
        and exists (
          select 1
          from ${chapterGroup}
          inner join ${chapter}
            on ${chapter.id} = ${chapterGroup.chapterId}
          where ${chapterGroup.groupId} = view_source.group_id
            and ${chapter.mangaId} = view_source.manga_id
            and ${readableChapter(visibility)}
        )
      group by view_source.group_id
    ), actual_view_totals as (
      select actual_view_source.group_id,
        sum(actual_view_source.views)::numeric views
      from actual_view_source
      inner join eligible_groups
        on eligible_groups.group_id = actual_view_source.group_id
      inner join ${manga} on ${manga.id} = actual_view_source.manga_id
      where ${visibleManga(visibility)}
        and exists (
          select 1
          from ${chapterGroup}
          inner join ${chapter}
            on ${chapter.id} = ${chapterGroup.chapterId}
          where ${chapterGroup.groupId} = actual_view_source.group_id
            and ${chapter.mangaId} = actual_view_source.manga_id
            and ${readableChapter(visibility)}
        )
      group by actual_view_source.group_id
    ), readable_credits as (
      select ${chapterGroup.groupId} group_id,
        ${chapter.mangaId} manga_id, ${chapter.language} language,
        ${chapter.readingKey} reading_key, count(*)::bigint releases
      from ${chapter}
      inner join ${manga} on ${manga.id} = ${chapter.mangaId}
      inner join ${chapterGroup} on ${chapterGroup.chapterId} = ${chapter.id}
      inner join eligible_groups
        on eligible_groups.group_id = ${chapterGroup.groupId}
      where ${readableChapter(visibility)}
        and ${visibleManga(visibility)}
        ${chapterWindow}
      group by ${chapterGroup.groupId}, ${chapter.mangaId},
        ${chapter.language}, ${chapter.readingKey}
    ), chapter_credits as (
      select group_id, releases,
        1::numeric / count(*) over (partition by manga_id, language, reading_key)::numeric score_chapters,
        1::bigint chapters
      from readable_credits
    ), chapter_totals as (
      select group_id,
        sum(score_chapters)::numeric score_chapters,
        sum(chapters)::numeric chapters,
        sum(releases)::numeric releases
      from chapter_credits
      group by group_id
    ), signals as (
      select eligible_groups.*,
        coalesce(score_view_totals.views, 0)::numeric score_views,
        coalesce(chapter_totals.score_chapters, 0)::numeric score_chapters,
        coalesce(actual_view_totals.views, 0)::numeric views,
        coalesce(chapter_totals.chapters, 0)::numeric chapters,
        coalesce(chapter_totals.releases, 0)::numeric releases
      from eligible_groups
      left join score_view_totals using (group_id)
      left join actual_view_totals using (group_id)
      left join chapter_totals using (group_id)
    ), caps as (
      select
        percentile_cont(0.99) within group (order by score_views)
          filter (where score_views > 0) view_cap,
        percentile_cont(0.99) within group (order by score_chapters)
          filter (where score_chapters > 0) chapter_cap
      from signals
    ), normalized as (
      select signals.*,
        case when view_cap is not null then
          least(10, 10 * ln(1 + score_views::double precision) / ln(1 + view_cap))
        end view_score,
        case when chapter_cap is not null then
          least(10, 10 * ln(1 + score_chapters::double precision) / ln(1 + chapter_cap))
        end chapter_score
      from signals cross join caps
    ), scored as (
      select normalized.*,
        case when view_score is null and chapter_score is null then null
          else (
            coalesce(view_score * 0.60, 0) +
            coalesce(chapter_score * 0.40, 0)
          ) / (
            case when view_score is null then 0 else 0.60 end +
            case when chapter_score is null then 0 else 0.40 end
          )
        end score
      from normalized
    )
    select group_id "groupId", name, slug, avatar_url "avatarUrl", inactive,
      views::text views,
      chapters::text chapters,
      releases::text releases,
      score
    from scored
    where score is not null
    order by score desc, score_views desc, score_chapters desc, group_id asc
    limit ${limit}
  `)

  return {
    data: result.rows.map((row, index) => ({
      rank: index + 1,
      group: {
        id: String(row.groupId),
        name: String(row.name),
        slug: String(row.slug),
        avatarUrl: row.avatarUrl ? String(row.avatarUrl) : null,
        inactive: Boolean(row.inactive),
      },
      views: Number(row.views),
      chapters: Number(row.chapters),
      releases: Number(row.releases),
      score: Number(row.score),
    })),
    meta: {
      window,
      limit,
      bucketDate,
      calculatedAt: formatISO(now),
    },
  }
}

export function registerRankingRoutes(
  app: OpenAPIHono,
  dependencies: CatalogDependencies
) {
  const visibility: CatalogVisibility = {
    hideR18: dependencies.hideR18 ?? true,
    hiddenMangaIds: [...(dependencies.hiddenMangaIds ?? [])].sort(),
    hiddenChapterIds: [...(dependencies.hiddenChapterIds ?? [])].sort(),
  }
  app.openapi(listMangaRankingRoute, async (c) => {
    const { metric, window, limit } = c.req.valid("query")
    const now = new Date()
    const bucketDate = engagementBucketDate(now)
    const value = await loadRanking(
      dependencies,
      metric,
      window,
      limit,
      bucketDate,
      now,
      visibility
    )
    return c.json(value, 200)
  })
  app.openapi(listGroupRankingRoute, async (c) => {
    const { window, limit } = c.req.valid("query")
    const now = new Date()
    const bucketDate = engagementBucketDate(now)
    const value = await loadGroupRanking(
      dependencies,
      window,
      limit,
      bucketDate,
      now,
      visibility
    )
    return c.json(value, 200)
  })
}
