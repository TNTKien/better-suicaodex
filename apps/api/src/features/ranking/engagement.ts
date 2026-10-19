import { TZDate } from "@date-fns/tz"
import { format, subDays } from "date-fns"
import { and, eq, sql } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import {
  chapterStats,
  mangaEngagementDaily,
  mangaStats,
  translationGroupMangaEngagementDaily,
  translationGroupMangaViewStats,
} from "../../db/schema.js"

export const ENGAGEMENT_TIME_ZONE = "Asia/Ho_Chi_Minh"
type EngagementDatabase = Pick<Database, "execute" | "insert" | "update">

export function engagementBucketDate(now = new Date()) {
  return format(TZDate.tz(ENGAGEMENT_TIME_ZONE, now), "yyyy-MM-dd")
}

export function engagementWindowStart(days: number, now = new Date()) {
  return format(
    subDays(TZDate.tz(ENGAGEMENT_TIME_ZONE, now), days - 1),
    "yyyy-MM-dd"
  )
}

export async function addDailyEngagement(
  database: EngagementDatabase,
  mangaId: string,
  bucketDate: string,
  values: {
    views?: bigint
    followAdds?: bigint
    followRemoves?: bigint
    comments?: bigint
  }
) {
  const daily = {
    views: values.views ?? 0n,
    followAdds: values.followAdds ?? 0n,
    followRemoves: values.followRemoves ?? 0n,
    comments: values.comments ?? 0n,
  }
  await database
    .insert(mangaEngagementDaily)
    .values({ mangaId, bucketDate, ...daily })
    .onConflictDoUpdate({
      target: [mangaEngagementDaily.mangaId, mangaEngagementDaily.bucketDate],
      set: {
        views: sql`${mangaEngagementDaily.views} + ${daily.views}`,
        followAdds: sql`${mangaEngagementDaily.followAdds} + ${daily.followAdds}`,
        followRemoves: sql`${mangaEngagementDaily.followRemoves} + ${daily.followRemoves}`,
        comments: sql`${mangaEngagementDaily.comments} + ${daily.comments}`,
        updatedAt: new Date(),
      },
    })
}

export async function addViewEngagement(
  database: EngagementDatabase,
  chapterId: string,
  mangaId: string,
  viewedAt: Date
) {
  const bucketDate = engagementBucketDate(viewedAt)
  const [updatedChapter] = await database
    .insert(chapterStats)
    .values({ chapterId, views: 1n, updatedAt: viewedAt })
    .onConflictDoUpdate({
      target: chapterStats.chapterId,
      set: {
        views: sql`${chapterStats.views} + 1`,
        updatedAt: viewedAt,
      },
    })
    .returning({ views: chapterStats.views })
  await database
    .insert(mangaStats)
    .values({ mangaId, views: 1n, updatedAt: viewedAt })
    .onConflictDoUpdate({
      target: mangaStats.mangaId,
      set: {
        views: sql`${mangaStats.views} + 1`,
        updatedAt: viewedAt,
      },
    })
  await addDailyEngagement(database, mangaId, bucketDate, {
    views: 1n,
  })
  await database.execute(sql`
    with active_groups as (
      select
        chapter_group.group_id,
        count(*) over ()::numeric as group_count
      from chapter_group
      inner join translation_group_profile
        on translation_group_profile.organization_id = chapter_group.group_id
      where chapter_group.chapter_id = ${chapterId}
        and translation_group_profile.approval_status = 'approved'
        and translation_group_profile.publication_state = 'published'
        and translation_group_profile.deleted_at is null
    ), credits as (
      select
        group_id,
        round((1::numeric / nullif(group_count, 0)), 1)::numeric(14, 1) as views,
        1::bigint as actual_views
      from active_groups
      where group_count > 0
    ), aggregate_upsert as (
      insert into ${translationGroupMangaViewStats} (group_id, manga_id, views, updated_at)
      select group_id, ${mangaId}, views, ${viewedAt}
      from credits
      where views > 0
      on conflict (group_id, manga_id) do update set
        views = round((${translationGroupMangaViewStats.views} + excluded.views)::numeric, 1),
        updated_at = excluded.updated_at
      returning group_id
    )
    insert into ${translationGroupMangaEngagementDaily}
      (group_id, manga_id, bucket_date, views, actual_views, updated_at)
    select credits.group_id, ${mangaId}, ${bucketDate}, credits.views,
      credits.actual_views, ${viewedAt}
    from aggregate_upsert
    inner join credits using (group_id)
    on conflict (group_id, manga_id, bucket_date) do update set
      views = round((${translationGroupMangaEngagementDaily.views} + excluded.views)::numeric, 1),
      actual_views = ${translationGroupMangaEngagementDaily.actualViews} + excluded.actual_views,
      updated_at = excluded.updated_at
  `)
  return Number(updatedChapter!.views)
}

export async function addCommentEngagement(
  database: EngagementDatabase,
  mangaId: string,
  createdAt: Date
) {
  await database
    .insert(mangaStats)
    .values({ mangaId, comments: 1n })
    .onConflictDoUpdate({
      target: mangaStats.mangaId,
      set: {
        comments: sql`${mangaStats.comments} + 1`,
        updatedAt: new Date(),
      },
    })
  await addDailyEngagement(database, mangaId, engagementBucketDate(createdAt), {
    comments: 1n,
  })
}

export async function removeCommentEngagement(
  database: EngagementDatabase,
  mangaId: string,
  createdAt: Date
) {
  await database
    .update(mangaStats)
    .set({
      comments: sql`greatest(${mangaStats.comments} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(mangaStats.mangaId, mangaId))
  await database
    .update(mangaEngagementDaily)
    .set({
      comments: sql`greatest(${mangaEngagementDaily.comments} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mangaEngagementDaily.mangaId, mangaId),
        eq(mangaEngagementDaily.bucketDate, engagementBucketDate(createdAt))
      )
    )
}
