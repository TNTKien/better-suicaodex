import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { v7 as uuidv7 } from "uuid"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createDatabase } from "../../src/db/client"
import {
  chapter,
  comment,
  manga,
  mangaStats,
  mangaEngagementDaily,
  organization,
  user,
} from "../../src/db/schema"
import { dashboardStatistics } from "../../src/features/dashboard/statistics"

test("dashboard aggregates visible content and distinct lifetime and Vietnam daily totals", async () => {
  const url = process.env.TEST_DATABASE_URL
  if (!url || url === process.env.DATABASE_URL)
    throw new Error("TEST_DATABASE_URL is required for integration tests")
  const { db, pool } = createDatabase(url)
  const done = new Error("rollback dashboard fixtures")
  try {
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    await db.transaction(async (tx) => {
      const now = new Date("2026-11-27T17:00:00Z")
      const before = await dashboardStatistics(tx, {}, now)
      const id = uuidv7()
      await tx
        .insert(organization)
        .values({ id, name: id, slug: id, createdAt: now })
      await tx
        .insert(user)
        .values({ id, name: id, email: id + "@example.test", createdAt: now })
      const title = {
        ownerGroupId: id,
        title: id,
        searchTitle: id,
        originalLanguage: "vi",
        status: "ongoing" as const,
        contentRating: "safe" as const,
        publishedAt: now,
      }
      const [visible, hidden] = await tx
        .insert(manga)
        .values([
          { ...title, slug: id },
          { ...title, slug: id + "-hidden", moderationHiddenAt: now },
        ])
        .returning()
      const release = {
        ownerGroupId: id,
        number: "1",
        language: "vi",
        pageCount: 1,
        availablePageCount: 1,
        isFull: true,
        publicationState: "published" as const,
        publishedAt: now,
      }
      await tx.insert(chapter).values([
        { ...release, mangaId: visible!.id },
        { ...release, mangaId: hidden!.id },
      ])
      await tx.insert(comment).values([
        { mangaId: visible!.id, userId: id, body: id, createdAt: now },
        { mangaId: hidden!.id, userId: id, body: id, createdAt: now },
      ])
      await tx.insert(mangaStats).values([
        { mangaId: visible!.id, views: 100n },
        { mangaId: hidden!.id, views: 99n },
      ])
      await tx.insert(mangaEngagementDaily).values([
        { mangaId: visible!.id, bucketDate: "2026-11-28", views: 3n },
        { mangaId: visible!.id, bucketDate: "2026-11-27", views: 2n },
      ])
      const result = await dashboardStatistics(tx, {}, now)
      expect(result.dates.length).toBe(30)
      expect(result.dates.at(-1)).toBe("2026-11-28")
      for (const key of [
        "manga",
        "chapters",
        "comments",
        "members",
        "views",
      ] as const) {
        expect(result.metrics[key].total - before.metrics[key].total).toBe(
          key === "views" ? 100 : 1
        )
        expect(
          result.metrics[key].daily[29]! - before.metrics[key].daily[29]!
        ).toBe(key === "views" ? 3 : 1)
      }
      expect(
        result.metrics.views.daily[28]! - before.metrics.views.daily[28]!
      ).toBe(2)
      throw done
    })
  } catch (error) {
    if (error !== done) throw error
  } finally {
    await pool.end()
  }
}, 30_000)
