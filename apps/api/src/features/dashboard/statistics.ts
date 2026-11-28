import { TZDate } from "@date-fns/tz"
import { eachDayOfInterval, format, startOfDay, subDays } from "date-fns"
import { sql, type SQL } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import {
  chapter,
  comment,
  manga,
  mangaEngagementDaily,
  mangaStats,
  user,
} from "../../db/schema.js"
import {
  readableChapter,
  visibleManga,
  type CatalogVisibility,
} from "../catalog/routes.js"
import { ENGAGEMENT_TIME_ZONE } from "../ranking/engagement.js"
import { type MetricName } from "./contract.js"

export async function dashboardStatistics(
  database: Pick<Database, "execute">,
  visibility: CatalogVisibility,
  now = new Date()
) {
  const today = startOfDay(TZDate.tz(ENGAGEMENT_TIME_ZONE, now))
  const start = subDays(today, 29)
  const dates = eachDayOfInterval({ start, end: today }).map((day) =>
    format(day, "yyyy-MM-dd")
  )
  // Collapse older records into a single bucket while counting the current catalog.
  const bucket = (instant: SQL) =>
    sql`case when ${instant} >= ${start.toISOString()}::timestamptz then (${instant} at time zone ${ENGAGEMENT_TIME_ZONE})::date end`
  const rows = await database.execute<{
    metric: MetricName
    day: string | null
    amount: string
  }>(sql`
    with titles as (
      select ${manga.id} as id, ${manga.publishedAt} as published_at from ${manga} where ${visibleManga(visibility)}
    ), chapters as (
      select ${chapter.id} as id, ${chapter.publishedAt} as published_at
      from ${chapter} join titles on titles.id = ${chapter.mangaId}
      where ${readableChapter(visibility)}
    ), counts(metric, day, amount) as (
      select 'manga', ${bucket(sql`titles.published_at`)}, count(*) from titles group by 2
      union all select 'chapters', ${bucket(sql`chapters.published_at`)}, count(*) from chapters group by 2
      union all select 'comments', ${bucket(sql`${comment.createdAt}`)}, count(*) from ${comment}
        join titles on titles.id = ${comment.mangaId} left join chapters on chapters.id = ${comment.chapterId}
        where ${comment.status} = 'visible' and ${comment.deletedAt} is null
          and (${comment.chapterId} is null or chapters.id is not null) group by 2
      union all select 'members', ${bucket(sql`${user.createdAt} at time zone 'UTC'`)}, count(*) from ${user} group by 2
      union all select 'views', null, coalesce(sum(${mangaStats.views}),0) from ${mangaStats} join titles on titles.id = ${mangaStats.mangaId}
      union all select 'views', ${mangaEngagementDaily.bucketDate}, sum(${mangaEngagementDaily.views})
        from ${mangaEngagementDaily} join titles on titles.id = ${mangaEngagementDaily.mangaId}
        where ${mangaEngagementDaily.bucketDate} between ${dates[0]}::date and ${dates[29]}::date group by 2
    )
    select metric, day::text, amount::text from counts
  `)
  const empty = () => ({ total: 0, daily: dates.map(() => 0) })
  const metrics = {
    manga: empty(),
    chapters: empty(),
    views: empty(),
    comments: empty(),
    members: empty(),
  }
  for (const { metric, day, amount } of rows.rows) {
    const value = Number(amount)
    if (metric !== "views" || day === null) metrics[metric].total += value
    const index = day ? dates.indexOf(day) : -1
    if (index >= 0) metrics[metric].daily[index] = value
  }
  return { dates, metrics }
}
