import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

import { and, eq, isNull, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createDatabase } from "../../src/db/client"
import type { Database } from "../../src/db/client"
import {
  chapter,
  contentReport,
  libraryItem,
  manga,
  mangaStats,
  mangaVolume,
  notification,
  organization,
  user,
} from "../../src/db/schema"

setDefaultTimeout(30_000)
let database: Database
let pool: ReturnType<typeof createDatabase>["pool"]
const mangaAId = randomUUID()
const mangaBId = randomUUID()
const volumeId = randomUUID()
const chapterId = randomUUID()
const notificationUserId = `notification-${randomUUID()}`
const notificationEmail = `${notificationUserId}@example.com`
const ownerGroupId = randomUUID()
const chapterValues = {
  ownerGroupId,
  number: "1",
  language: "vi",
  pageCount: 1,
  availablePageCount: 1,
  isFull: true,
}

async function expectConstraint(
  operation: Promise<unknown>,
  constraint: string
) {
  let error: unknown
  try {
    await operation
  } catch (caught) {
    error = caught
  }
  expect(error).toHaveProperty("cause.constraint", constraint)
}

describe.serial("database redesign constraints", () => {
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error("TEST_DATABASE_URL is required for integration tests")
    }

    const connection = createDatabase(process.env.TEST_DATABASE_URL)
    database = connection.db
    pool = connection.pool
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })

    await database.insert(organization).values({
      id: ownerGroupId,
      name: "Constraint owner group",
      slug: `constraint-owner-${ownerGroupId}`,
      createdAt: new Date(),
    })

    const base = {
      ownerGroupId,
      title: "Constraint fixture",
      searchTitle: "constraint fixture",
      originalLanguage: "ja",
      status: "ongoing" as const,
      contentRating: "safe" as const,
    }
    await database
      .insert(manga)
      .values([
        { ...base, id: mangaAId, slug: `constraint-a-${mangaAId}` },
        { ...base, id: mangaBId, slug: `constraint-b-${mangaBId}` },
      ])
      .execute()
    await database
      .insert(mangaVolume)
      .values({ id: volumeId, mangaId: mangaAId, number: "1" })
      .execute()
    await database.insert(user).values({
      id: notificationUserId,
      name: "Notification foundation fixture",
      email: notificationEmail,
    })
  })

  afterAll(async () => {
    if (!database) return
    await database.delete(manga).where(eq(manga.id, mangaAId)).execute()
    await database.delete(manga).where(eq(manga.id, mangaBId)).execute()
    await database.delete(user).where(eq(user.id, notificationUserId)).execute()
    await database
      .delete(organization)
      .where(eq(organization.id, ownerGroupId))
      .execute()
    await pool.end()
  })

  test("rejects a volume owned by another manga", async () => {
    await expectConstraint(
      database
        .insert(chapter)
        .values({
          ...chapterValues,
          mangaId: mangaBId,
          volumeId,
        })
        .execute(),
      "chapter_volume_manga_fk"
    )
  })

  test("generates UUIDv7 canonical IDs", async () => {
    const [created] = await database
      .insert(manga)
      .values({
        ownerGroupId,
        slug: `uuidv7-${randomUUID()}`,
        title: "UUIDv7 fixture",
        searchTitle: "uuidv7 fixture",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
      })
      .returning({ id: manga.id })

    try {
      expect(created?.id[14]).toBe("7")
      expect(created?.id[19]).toMatch(/[89ab]/)
    } finally {
      if (created) {
        await database.delete(manga).where(eq(manga.id, created.id)).execute()
      }
    }
  })

  test("allows releases with duplicate numbers but only one pinned default", async () => {
    await database
      .insert(chapter)
      .values({
        ...chapterValues,
        id: chapterId,
        isDefault: true,
        mangaId: mangaAId,
        volumeId,
      })
      .execute()
    await database.insert(chapter).values({
      ...chapterValues,
      mangaId: mangaAId,
      volumeId,
    })
    await expectConstraint(
      database
        .insert(chapter)
        .values({
          ...chapterValues,
          mangaId: mangaAId,
          volumeId,
          isDefault: true,
        })
        .execute(),
      "chapter_default_slot_uidx"
    )
  })

  test("allows reusing a chapter number after soft delete", async () => {
    await database
      .update(chapter)
      .set({ deletedAt: new Date() })
      .where(eq(chapter.id, chapterId))
      .execute()
    await database
      .insert(chapter)
      .values({ ...chapterValues, mangaId: mangaAId, volumeId })
      .execute()
  })

  test("enforces the notification foundation and follower fan-out index", async () => {
    const chapters = await database
      .insert(chapter)
      .values([
        { ...chapterValues, mangaId: mangaAId, number: "2" },
        { ...chapterValues, mangaId: mangaBId, number: "1" },
      ])
      .returning({ id: chapter.id, mangaId: chapter.mangaId })
    const mangaAChapterId = chapters.find(
      ({ mangaId }) => mangaId === mangaAId
    )!.id

    expect(
      await database
        .select({ id: notification.id })
        .from(notification)
        .where(eq(notification.userId, notificationUserId))
    ).toHaveLength(0)

    await database.insert(libraryItem).values({
      userId: notificationUserId,
      mangaId: mangaAId,
      category: "following",
    })
    const [created] = await database
      .insert(notification)
      .values({
        userId: notificationUserId,
        type: "manga_new_chapter",
        mangaId: mangaAId,
        chapterId: mangaAChapterId,
      })
      .returning()

    expect(created?.id[14]).toBe("7")
    expect(created?.readAt).toBeNull()
    await expectConstraint(
      database.insert(notification).values({
        userId: notificationUserId,
        type: "manga_new_chapter",
        mangaId: mangaAId,
        chapterId: mangaAChapterId,
      }),
      "notification_user_type_manga_uidx"
    )
    await expectConstraint(
      database.insert(notification).values({
        userId: notificationUserId,
        type: "manga_new_chapter",
        mangaId: mangaBId,
        chapterId: mangaAChapterId,
      }),
      "notification_chapter_manga_fk"
    )

    expect(
      await database
        .select({ id: notification.id })
        .from(notification)
        .where(
          and(
            eq(notification.userId, notificationUserId),
            isNull(notification.readAt)
          )
        )
    ).toHaveLength(1)
    await database
      .update(notification)
      .set({ readAt: new Date() })
      .where(eq(notification.id, created!.id))
    expect(
      await database
        .select({ id: notification.id })
        .from(notification)
        .where(
          and(
            eq(notification.userId, notificationUserId),
            isNull(notification.readAt)
          )
        )
    ).toHaveLength(0)

    const plan = await database.transaction(async (transaction) => {
      await transaction.execute(sql`set local enable_seqscan = off`)
      return transaction.execute(sql`
        explain select user_id
        from library_item
        where manga_id = ${mangaAId}::uuid and category = 'following'
      `)
    })
    expect(JSON.stringify(plan.rows)).toContain(
      "library_item_following_manga_user_idx"
    )

    await database.delete(chapter).where(eq(chapter.id, mangaAChapterId))
    expect(
      await database
        .select({ id: notification.id })
        .from(notification)
        .where(eq(notification.id, created!.id))
    ).toHaveLength(0)
  })

  test("rejects invalid counters and report targets", async () => {
    await expectConstraint(
      database
        .insert(mangaStats)
        .values({ mangaId: mangaAId, views: -1n })
        .execute(),
      "manga_stats_nonnegative_check"
    )
    await expectConstraint(
      database
        .insert(contentReport)
        .values({ reason: "missing target" })
        .execute(),
      "content_report_single_target_check"
    )
    await expectConstraint(
      database
        .insert(contentReport)
        .values({
          mangaId: mangaAId,
          chapterId,
          reason: "two targets",
        })
        .execute(),
      "content_report_single_target_check"
    )
  })
})
