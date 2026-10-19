import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { addHours, addMinutes } from "date-fns"
import { and, eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

import { createApp } from "../../src/app"
import {
  chapter,
  chapterGroup,
  chapterPage,
  chapterTikTokReplica,
  chapterUploadSession,
  comment,
  libraryItem,
  manga,
  mangaGroup,
  mangaPerson,
  mangaStats,
  member,
  moderationAction,
  notification,
  organization,
  person,
  readingHistory,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
} from "../../src/db/schema"
import { discoverReplicas } from "../../src/features/image-server2/service"
import { createRuntime, type Runtime } from "../../src/runtime"
import { BusinessCache } from "../../src/shared/cache"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)

const origin = "http://localhost:3000"
const noop = () => undefined
const groupId = randomUUID()
const mangaId = randomUUID()
const chapterId = randomUUID()
const hiddenChapterId = randomUUID()
const accounts: { id: string; cookie: string }[] = []
let runtime: Runtime
let env: ReturnType<typeof parseRuntimeEnv>
let app: ReturnType<typeof createApp>
let admin: (typeof accounts)[number]
let owner: (typeof accounts)[number]

async function account(name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `phase9a-${randomUUID()}@example.com`,
      name,
      password: "phase9a-fixture-password",
    }),
  })
  expect(response.status).toBe(200)
  const result = {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
  accounts.push(result)
  return result
}

function request(
  actor: (typeof accounts)[number] | undefined,
  path: string,
  method = "GET",
  body?: unknown
) {
  return app.request(path, {
    method,
    headers: {
      Origin: origin,
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe.serial("Phase 9A content moderation", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")

    env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      WEB_ORIGIN: origin,
      DATABASE_URL: url,
      REDIS_CACHE_ENABLED: "false",
    })
    runtime = await createRuntime(env, noop)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        database: runtime.database,
        cache: runtime.cache,
        assetBaseUrl: "http://localhost:9000/",
      },
      logger: noop,
      webOrigin: origin,
    })

    admin = await account("Phase 9A admin")
    owner = await account("Phase 9A owner")
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, admin.id))

    await runtime.database.insert(organization).values({
      id: groupId,
      name: "Phase 9A group",
      slug: `phase-9a-${randomUUID()}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: groupId,
      approvalStatus: "approved",
      publicationState: "published",
      createdByUserId: owner.id,
    })
    const memberId = randomUUID()
    await runtime.database.insert(member).values({
      id: memberId,
      organizationId: groupId,
      userId: owner.id,
      role: "owner",
      createdAt: new Date(),
    })
    await runtime.database
      .insert(translationGroupMemberProfile)
      .values({ memberId })

    const now = new Date()
    await runtime.database.insert(manga).values({
      ownerGroupId: groupId,
      id: mangaId,
      slug: `phase-9a-${randomUUID()}`,
      title: "Phase 9A Manga",
      searchTitle: "phase 9a manga",
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      publicationState: "published",
      hasUsableChapters: true,
      latestChapterPublishedAt: now,
      publishedAt: now,
    })
    await runtime.database.insert(mangaGroup).values({ mangaId, groupId })
    await runtime.database.insert(mangaStats).values({
      mangaId,
      views: 10,
      follows: 0,
      comments: 0,
      scoreBayesian: "0",
    })
    await runtime.database.insert(chapter).values({
      ownerGroupId: groupId,
      id: chapterId,
      mangaId,
      uploaderUserId: owner.id,
      number: "1",
      language: "vi",
      pageCount: 1,
      availablePageCount: 1,
      pagesVersion: 1,
      isFull: true,
      publicationState: "published",
      publishedAt: now,
    })
    await runtime.database.insert(chapterGroup).values({ chapterId, groupId })
    await runtime.database.insert(chapterPage).values({
      chapterId,
      position: 0,
      originalKey: `chapters/${chapterId}/0.webp`,
      width: 800,
      height: 1200,
    })
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database
      .delete(moderationAction)
      .where(
        inArray(moderationAction.targetId, [
          mangaId,
          chapterId,
          hiddenChapterId,
        ])
      )
    await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, groupId))
    if (accounts.length)
      await runtime.database.delete(user).where(
        inArray(
          user.id,
          accounts.map(({ id }) => id)
        )
      )
    await runtime.close()
  })

  test("admin manga block hides public manga and chapters without changing contributor visibility", async () => {
    expect((await request(undefined, `/v1/manga/${mangaId}`)).status).toBe(200)
    expect((await request(undefined, `/v1/chapters/${chapterId}`)).status).toBe(
      200
    )
    expect(
      (
        await request(admin, `/v1/admin/manga/${mangaId}/visibility`, "PUT", {
          hidden: true,
          expectedVersion: 1,
        })
      ).status
    ).toBe(400)
    expect(
      (
        await request(admin, `/v1/admin/manga/${mangaId}/visibility`, "PUT", {
          hidden: false,
          expectedVersion: 1,
          reason: "Unexpected",
        })
      ).status
    ).toBe(400)

    const unchanged = await request(
      admin,
      `/v1/admin/manga/${mangaId}/visibility`,
      "PUT",
      { hidden: false, expectedVersion: 1 }
    )
    expect(unchanged.status).toBe(409)
    expect(await unchanged.json()).toMatchObject({
      error: { code: "STATE_UNCHANGED" },
    })
    await runtime.database.execute(
      sql.raw(`
        create or replace function phase9a_reject_audit() returns trigger as $$
        begin
          if new.reason = 'Phase 9A forced audit failure' then
            raise exception 'forced audit failure';
          end if;
          return new;
        end;
        $$ language plpgsql;
        drop trigger if exists phase9a_reject_audit on moderation_action;
        create trigger phase9a_reject_audit before insert on moderation_action
        for each row execute function phase9a_reject_audit();
      `)
    )
    try {
      expect(
        (
          await request(admin, `/v1/admin/manga/${mangaId}/visibility`, "PUT", {
            hidden: true,
            expectedVersion: 1,
            reason: "Phase 9A forced audit failure",
          })
        ).status
      ).toBe(500)
      expect(
        await runtime.database
          .select({
            moderationHiddenAt: manga.moderationHiddenAt,
            version: manga.version,
          })
          .from(manga)
          .where(eq(manga.id, mangaId))
      ).toEqual([{ moderationHiddenAt: null, version: 1 }])
    } finally {
      await runtime.database.execute(
        sql.raw(`
          drop trigger if exists phase9a_reject_audit on moderation_action;
          drop function if exists phase9a_reject_audit();
        `)
      )
    }
    await runtime.database
      .delete(chapterTikTokReplica)
      .where(eq(chapterTikTokReplica.chapterId, chapterId))

    const hidden = await request(
      admin,
      `/v1/admin/manga/${mangaId}/visibility`,
      "PUT",
      { hidden: true, expectedVersion: 1, reason: "Phase 9A fixture" }
    )
    expect(hidden.status).toBe(200)
    expect(await hidden.json()).toMatchObject({
      data: {
        id: mangaId,
        moderationHiddenAt: expect.any(String),
        publicationState: "published",
        version: 2,
      },
    })

    const updated = await request(admin, `/v1/admin/manga/${mangaId}`, "PUT", {
      title: "Phase 9A Manga edited",
      slug: `phase-9a-edit-${mangaId}`,
      alternativeTitles: ["Truyện đã sửa"],
      description: "Metadata do quản trị viên cập nhật.",
      originalLanguage: "ja",
      publicationDemographic: null,
      status: "ongoing",
      contentRating: "safe",
      year: null,
      lastVolume: null,
      lastChapter: null,
      links: {},
      tagIds: [],
      authorIds: [],
      artistIds: [],
      expectedVersion: 2,
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      data: {
        id: mangaId,
        title: "Phase 9A Manga edited",
        alternativeTitles: { und: ["Truyện đã sửa"] },
        description: "Metadata do quản trị viên cập nhật.",
        moderationHiddenAt: expect.any(String),
        owners: [{ id: groupId }],
        version: 3,
      },
    })

    expect((await request(undefined, `/v1/manga/${mangaId}`)).status).toBe(404)
    expect((await request(undefined, `/v1/chapters/${chapterId}`)).status).toBe(
      404
    )
    await discoverReplicas({ database: runtime.database, visibility: {} })
    expect(
      await runtime.database
        .select({ id: chapterTikTokReplica.chapterId })
        .from(chapterTikTokReplica)
        .where(eq(chapterTikTokReplica.chapterId, chapterId))
    ).toEqual([])

    const managedManga = await request(
      owner,
      `/v1/contribution/groups/${groupId}/manga/${mangaId}`
    )
    expect(managedManga.status).toBe(200)
    expect(await managedManga.json()).toMatchObject({
      data: {
        id: mangaId,
        moderationHiddenAt: expect.any(String),
        moderationReason: "Phase 9A fixture",
      },
    })

    const contributorShow = await request(
      owner,
      `/v1/contribution/groups/${groupId}/manga/${mangaId}/visibility`,
      "POST",
      { hidden: false, expectedVersion: 3 }
    )
    expect(contributorShow.status).toBe(409)
    expect(await contributorShow.json()).toMatchObject({
      error: { code: "CONTENT_MODERATED" },
    })

    const unhidden = await request(
      admin,
      `/v1/admin/manga/${mangaId}/visibility`,
      "PUT",
      { hidden: false, expectedVersion: 3 }
    )
    expect(unhidden.status).toBe(200)
    expect(await unhidden.json()).toMatchObject({
      data: {
        id: mangaId,
        moderationHiddenAt: null,
        publicationState: "published",
        version: 4,
      },
    })
    expect((await request(undefined, `/v1/manga/${mangaId}`)).status).toBe(200)
    expect((await request(undefined, `/v1/chapters/${chapterId}`)).status).toBe(
      200
    )

    const audits = await runtime.database
      .select({ action: moderationAction.action })
      .from(moderationAction)
      .where(
        and(
          eq(moderationAction.targetKind, "manga"),
          eq(moderationAction.targetId, mangaId)
        )
      )
    expect(audits.map(({ action }) => action).sort()).toEqual([
      "manga.updated",
      "moderation.manga.hidden",
      "moderation.manga.unhidden",
    ])
  })

  test("admin can soft-delete a manga with audit", async () => {
    const id = randomUUID()
    const path = `/v1/admin/manga/${id}`
    const input = { expectedVersion: 1 }
    await runtime.database.insert(manga).values({
      ownerGroupId: groupId,
      id,
      slug: `phase-9a-delete-${randomUUID()}`,
      title: "Phase 9A Delete",
      searchTitle: "phase 9a delete",
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      publicationState: "published",
      publishedAt: new Date(),
    })
    await runtime.database.insert(mangaGroup).values({ mangaId: id, groupId })
    try {
      expect((await request(owner, path, "DELETE", input)).status).toBe(403)
      expect(
        (
          await request(admin, path, "DELETE", {
            ...input,
            reason: "Unexpected",
          })
        ).status
      ).toBe(400)
      expect(
        (
          await request(admin, path, "DELETE", {
            ...input,
            expectedVersion: 2,
          })
        ).status
      ).toBe(409)

      expect((await request(admin, path, "DELETE", input)).status).toBe(204)
      expect((await request(admin, path, "DELETE", input)).status).toBe(404)
      expect((await request(admin, path)).status).toBe(404)
      expect((await request(undefined, `/v1/manga/${id}`)).status).toBe(404)
      expect(
        (await request(owner, `/v1/contribution/groups/${groupId}/manga/${id}`))
          .status
      ).toBe(404)
      expect(
        await runtime.database
          .select({
            deletedAt: manga.deletedAt,
            deletedByUserId: manga.deletedByUserId,
            deleteReason: manga.deleteReason,
            version: manga.version,
          })
          .from(manga)
          .where(eq(manga.id, id))
      ).toEqual([
        {
          deletedAt: expect.any(Date),
          deletedByUserId: admin.id,
          deleteReason: null,
          version: 2,
        },
      ])
      expect(
        await runtime.database
          .select({
            action: moderationAction.action,
            reason: moderationAction.reason,
          })
          .from(moderationAction)
          .where(eq(moderationAction.targetId, id))
      ).toEqual([
        {
          action: "moderation.manga.deleted",
          reason: "Manga deleted by administrator",
        },
      ])
    } finally {
      await runtime.database
        .delete(moderationAction)
        .where(eq(moderationAction.targetId, id))
      await runtime.database.delete(manga).where(eq(manga.id, id))
    }
  })

  test("admin can edit a moderated chapter through its group scope", async () => {
    const id = randomUUID()
    const adminPath = `/v1/admin/chapters/${id}`
    const groupPath = `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters/${id}`
    await runtime.database.insert(chapter).values({
      ownerGroupId: groupId,
      id,
      mangaId,
      uploaderUserId: owner.id,
      number: "90",
      language: "vi",
      pageCount: 0,
      availablePageCount: 0,
      isFull: false,
      publicationState: "draft",
    })
    await runtime.database
      .insert(chapterGroup)
      .values({ chapterId: id, groupId })
    try {
      expect((await request(owner, adminPath)).status).toBe(403)
      expect(
        (
          await request(admin, `${adminPath}/visibility`, "PUT", {
            hidden: true,
            expectedVersion: 1,
            reason: "Cần chỉnh sửa",
          })
        ).status
      ).toBe(200)
      const details = await request(admin, adminPath)
      expect(details.status).toBe(200)
      expect((await details.json()).groupId).toBe(groupId)
      const input = {
        expectedVersion: 2,
        language: "vi",
        number: "90",
        title: "Đã chỉnh sửa",
        volumeNumber: null,
      }
      expect((await request(owner, groupPath, "PUT", input)).status).toBe(409)
      expect((await request(admin, groupPath, "PUT", input)).status).toBe(200)
      const updated = await request(admin, adminPath)
      expect((await updated.json()).data).toMatchObject({
        title: "Đã chỉnh sửa",
        moderationReason: "Cần chỉnh sửa",
        version: 3,
      })
    } finally {
      await runtime.database
        .delete(moderationAction)
        .where(eq(moderationAction.targetId, id))
      await runtime.database.delete(chapter).where(eq(chapter.id, id))
    }
  })

  test("admin can soft-delete a moderated chapter without a reason", async () => {
    const id = randomUUID()
    const path = `/v1/admin/chapters/${id}`
    await runtime.database.insert(chapter).values({
      ownerGroupId: groupId,
      id,
      mangaId,
      uploaderUserId: owner.id,
      number: "99",
      language: "vi",
      pageCount: 0,
      availablePageCount: 0,
      isFull: false,
      publicationState: "draft",
    })
    try {
      const hidden = await request(admin, `${path}/visibility`, "PUT", {
        hidden: true,
        expectedVersion: 1,
        reason: "Review fixture",
      })
      expect(hidden.status).toBe(200)
      expect(
        (await request(owner, path, "DELETE", { expectedVersion: 2 })).status
      ).toBe(403)
      expect(
        (
          await request(admin, path, "DELETE", {
            expectedVersion: 2,
            reason: "Unexpected",
          })
        ).status
      ).toBe(400)
      expect(
        (await request(admin, path, "DELETE", { expectedVersion: 1 })).status
      ).toBe(409)
      expect(
        (await request(admin, path, "DELETE", { expectedVersion: 2 })).status
      ).toBe(204)
      expect(
        (await request(admin, path, "DELETE", { expectedVersion: 2 })).status
      ).toBe(404)
      expect(
        await runtime.database
          .select({
            deletedAt: chapter.deletedAt,
            deletedByUserId: chapter.deletedByUserId,
            version: chapter.version,
          })
          .from(chapter)
          .where(eq(chapter.id, id))
      ).toEqual([
        { deletedAt: expect.any(Date), deletedByUserId: admin.id, version: 3 },
      ])
      expect(
        (
          await runtime.database
            .select({ action: moderationAction.action })
            .from(moderationAction)
            .where(eq(moderationAction.targetId, id))
        ).sort((left, right) => left.action.localeCompare(right.action))
      ).toEqual([
        { action: "moderation.chapter.deleted" },
        { action: "moderation.chapter.hidden" },
      ])
    } finally {
      await runtime.database
        .delete(moderationAction)
        .where(eq(moderationAction.targetId, id))
      await runtime.database.delete(chapter).where(eq(chapter.id, id))
    }
  })

  test("moderates processing and failed chapters while deleted targets stay immutable", async () => {
    const processingId = randomUUID()
    const failedId = randomUUID()
    const deletedId = randomUUID()
    const ids = [processingId, failedId, deletedId]
    const now = new Date()
    await runtime.database.insert(chapter).values(
      ids.map((id, index) => ({
        ownerGroupId: groupId,
        id,
        mangaId,
        uploaderUserId: owner.id,
        number: String(120 + index),
        language: "vi",
        pageCount: 0,
        availablePageCount: 0,
        isFull: false,
        publicationState: "draft" as const,
      }))
    )
    await runtime.database
      .insert(chapterGroup)
      .values(ids.map((id) => ({ chapterId: id, groupId })))
    await runtime.database.insert(chapterUploadSession).values([
      {
        chapterId: processingId,
        mangaId,
        actorUserId: owner.id,
        groupId,
        mode: "initial",
        expectedChapterVersion: 1,
        state: "finalizing",
        finalizeClaimToken: randomUUID(),
        finalizeClaimExpiresAt: addMinutes(now, 5),
        expiresAt: addHours(now, 3),
      },
      {
        chapterId: failedId,
        mangaId,
        actorUserId: owner.id,
        groupId,
        mode: "initial",
        expectedChapterVersion: 1,
        state: "open",
        finalizeError: "Injected processing failure",
        expiresAt: addHours(now, 3),
      },
    ])

    try {
      const list = await request(
        admin,
        `/v1/admin/manga/${mangaId}/chapters?publicationState=draft&limit=100`
      )
      expect(list.status).toBe(200)
      const states = new Map(
        (
          (await list.json()) as {
            data: { id: string; processingState: string }[]
          }
        ).data.map(({ id, processingState }) => [id, processingState])
      )
      expect(states.get(processingId)).toBe("processing")
      expect(states.get(failedId)).toBe("failed")

      for (const id of [processingId, failedId]) {
        const hidden = await request(
          admin,
          `/v1/admin/chapters/${id}/visibility`,
          "PUT",
          { hidden: true, expectedVersion: 1, reason: "Processing review" }
        )
        expect(hidden.status).toBe(200)
        const unhidden = await request(
          admin,
          `/v1/admin/chapters/${id}/visibility`,
          "PUT",
          { hidden: false, expectedVersion: 2 }
        )
        expect(unhidden.status).toBe(200)
      }

      expect(
        await runtime.database
          .select({
            chapterId: chapterUploadSession.chapterId,
            state: chapterUploadSession.state,
            error: chapterUploadSession.finalizeError,
          })
          .from(chapterUploadSession)
          .where(
            inArray(chapterUploadSession.chapterId, [processingId, failedId])
          )
      ).toEqual(
        expect.arrayContaining([
          { chapterId: processingId, state: "finalizing", error: null },
          {
            chapterId: failedId,
            state: "open",
            error: "Injected processing failure",
          },
        ])
      )

      expect(
        (
          await request(admin, `/v1/admin/chapters/${deletedId}`, "DELETE", {
            expectedVersion: 1,
          })
        ).status
      ).toBe(204)
      expect(
        (
          await request(
            admin,
            `/v1/admin/chapters/${deletedId}/visibility`,
            "PUT",
            { hidden: true, expectedVersion: 2, reason: "Too late" }
          )
        ).status
      ).toBe(404)
    } finally {
      await runtime.database
        .delete(moderationAction)
        .where(inArray(moderationAction.targetId, ids))
      await runtime.database.delete(chapter).where(inArray(chapter.id, ids))
    }
  })

  test("admin chapter block updates the manga projection and preserves the published manifest", async () => {
    const replicaNow = new Date()
    const [before] = await runtime.database
      .select({ publishedAt: chapter.publishedAt })
      .from(chapter)
      .where(eq(chapter.id, chapterId))
    const replicaPages = {
      "0": {
        originalKey: `chapters/${chapterId}/0.webp`,
        width: 800,
        height: 1200,
        uri: "phase9a-page",
        url: "https://p16-sign.tiktokcdn-us.com/phase9a.webp",
        format: "webp",
        byteSize: 1,
        verifiedAt: replicaNow.toISOString(),
      },
    }
    await runtime.database
      .insert(chapterTikTokReplica)
      .values({
        chapterId,
        sourceVersion: 1,
        state: "ready",
        totalPages: 1,
        pages: replicaPages,
        readyAt: replicaNow,
      })
      .onConflictDoUpdate({
        target: chapterTikTokReplica.chapterId,
        set: {
          sourceVersion: 1,
          state: "ready",
          totalPages: 1,
          pages: replicaPages,
          readyAt: replicaNow,
          claimToken: null,
          claimExpiresAt: null,
        },
      })
    const hidden = await request(
      admin,
      `/v1/admin/chapters/${chapterId}/visibility`,
      "PUT",
      { hidden: true, expectedVersion: 1, reason: "Broken chapter pages" }
    )
    expect(hidden.status).toBe(200)
    expect(await hidden.json()).toMatchObject({
      data: {
        id: chapterId,
        moderationHiddenAt: expect.any(String),
        publicationState: "published",
        version: 2,
      },
    })
    expect((await request(undefined, `/v1/chapters/${chapterId}`)).status).toBe(
      404
    )
    expect((await request(undefined, `/v1/manga/${mangaId}`)).status).toBe(200)

    const managedChapter = await request(
      owner,
      `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters/${chapterId}`
    )
    expect(managedChapter.status).toBe(200)
    expect(await managedChapter.json()).toMatchObject({
      data: {
        id: chapterId,
        moderationHiddenAt: expect.any(String),
        moderationReason: "Broken chapter pages",
      },
    })

    const [hiddenState] = await runtime.database
      .select({
        hasUsableChapters: manga.hasUsableChapters,
        latestChapterPublishedAt: manga.latestChapterPublishedAt,
        pagesVersion: chapter.pagesVersion,
        pageCount: chapter.pageCount,
        publishedAt: chapter.publishedAt,
      })
      .from(manga)
      .innerJoin(chapter, eq(chapter.mangaId, manga.id))
      .where(and(eq(manga.id, mangaId), eq(chapter.id, chapterId)))
    expect(hiddenState).toMatchObject({
      hasUsableChapters: false,
      latestChapterPublishedAt: null,
      pagesVersion: 1,
      pageCount: 1,
      publishedAt: before!.publishedAt,
    })
    expect(
      await runtime.database
        .select({
          sourceVersion: chapterTikTokReplica.sourceVersion,
          state: chapterTikTokReplica.state,
        })
        .from(chapterTikTokReplica)
        .where(eq(chapterTikTokReplica.chapterId, chapterId))
    ).toEqual([{ sourceVersion: 1, state: "ready" }])

    const contributorDelete = await request(
      owner,
      `/v1/contribution/groups/${groupId}/manga/${mangaId}/chapters/${chapterId}`,
      "DELETE",
      { expectedVersion: 2 }
    )
    expect(contributorDelete.status).toBe(409)
    expect(await contributorDelete.json()).toMatchObject({
      error: { code: "CONTENT_MODERATED" },
    })

    const stale = await request(
      admin,
      `/v1/admin/chapters/${chapterId}/visibility`,
      "PUT",
      { hidden: false, expectedVersion: 1 }
    )
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({
      error: { code: "VERSION_CONFLICT" },
    })

    const unhidden = await request(
      admin,
      `/v1/admin/chapters/${chapterId}/visibility`,
      "PUT",
      { hidden: false, expectedVersion: 2 }
    )
    expect(unhidden.status).toBe(200)
    expect((await request(undefined, `/v1/chapters/${chapterId}`)).status).toBe(
      200
    )
    const [visibleState] = await runtime.database
      .select({
        hasUsableChapters: manga.hasUsableChapters,
        latestChapterPublishedAt: manga.latestChapterPublishedAt,
        pagesVersion: chapter.pagesVersion,
        publishedAt: chapter.publishedAt,
      })
      .from(manga)
      .innerJoin(chapter, eq(chapter.mangaId, manga.id))
      .where(and(eq(manga.id, mangaId), eq(chapter.id, chapterId)))
    expect(visibleState?.hasUsableChapters).toBe(true)
    expect(visibleState?.latestChapterPublishedAt).not.toBeNull()
    expect(visibleState?.pagesVersion).toBe(1)
    expect(visibleState?.publishedAt).toEqual(before!.publishedAt)
    expect(
      await runtime.database
        .select({
          sourceVersion: chapterTikTokReplica.sourceVersion,
          state: chapterTikTokReplica.state,
        })
        .from(chapterTikTokReplica)
        .where(eq(chapterTikTokReplica.chapterId, chapterId))
    ).toEqual([{ sourceVersion: 1, state: "ready" }])
  })

  test("moderation visibility requires an active administrator and trusted origin", async () => {
    const path = `/v1/admin/manga/${mangaId}/visibility`
    const body = { hidden: true, expectedVersion: 5, reason: "Policy review" }
    expect((await request(undefined, path, "PUT", body)).status).toBe(401)
    expect((await request(owner, path, "PUT", body)).status).toBe(403)
    const wrongOrigin = await app.request(path, {
      method: "PUT",
      headers: {
        Cookie: admin.cookie,
        Origin: "https://example.invalid",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    expect(wrongOrigin.status).toBe(403)
  })

  test("admin searches manga by id and sees the current chapter moderation reason", async () => {
    const hidden = await request(
      admin,
      `/v1/admin/chapters/${chapterId}/visibility`,
      "PUT",
      { hidden: true, expectedVersion: 3, reason: "Reader quality review" }
    )
    expect(hidden.status).toBe(200)

    const list = await request(
      admin,
      `/v1/admin/manga?q=${encodeURIComponent(mangaId)}`
    )
    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject({
      data: [{ id: mangaId, moderationHiddenAt: null }],
      meta: { total: 1 },
    })

    const detail = await request(admin, `/v1/admin/manga/${mangaId}`)
    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({ data: { id: mangaId } })

    const chapters = await request(
      admin,
      `/v1/admin/manga/${mangaId}/chapters?moderation=hidden&sort=volume&direction=asc`
    )
    expect(chapters.status).toBe(200)
    expect(await chapters.json()).toMatchObject({
      data: [
        {
          id: chapterId,
          moderationHiddenAt: expect.any(String),
          moderationReason: "Reader quality review",
          publicationState: "published",
          processingState: "idle",
          failureReason: null,
          stagedPageCount: 0,
          isFull: true,
          volume: null,
        },
      ],
      meta: { total: 1 },
    })

    expect((await request(owner, "/v1/admin/manga")).status).toBe(403)
    expect(
      (
        await request(
          admin,
          `/v1/admin/chapters/${chapterId}/visibility`,
          "PUT",
          { hidden: false, expectedVersion: 4 }
        )
      ).status
    ).toBe(200)
  })

  test("visibility-sensitive routes bypass stale cache across API instances", async () => {
    let reads = 0
    let writes = 0
    const staleCache = {
      status: "healthy",
      async get() {
        reads++
        return { stale: true }
      },
      async set() {
        writes++
        return true
      },
      async invalidateCatalog() {
        return true
      },
      async acquireLock() {
        return null
      },
    } as unknown as BusinessCache
    const staleApp = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        database: runtime.database,
        cache: staleCache,
        assetBaseUrl: "http://localhost:9000/",
      },
      logger: noop,
      webOrigin: origin,
    })

    expect((await staleApp.request(`/v1/manga/${mangaId}`)).status).toBe(200)
    expect((await staleApp.request(`/v1/chapters/${chapterId}`)).status).toBe(
      200
    )
    expect(
      (
        (await (await staleApp.request("/v1/manga")).json()) as {
          data: { id: string }[]
        }
      ).data.map(({ id }) => id)
    ).toContain(mangaId)
    expect({ reads, writes }).toEqual({ reads: 0, writes: 0 })

    const [before] = await runtime.database
      .select({ version: manga.version })
      .from(manga)
      .where(eq(manga.id, mangaId))
    const hidden = await request(
      admin,
      `/v1/admin/manga/${mangaId}/visibility`,
      "PUT",
      {
        hidden: true,
        expectedVersion: before!.version,
        reason: "Warm cache regression",
      }
    )
    expect(hidden.status).toBe(200)

    expect((await staleApp.request(`/v1/manga/${mangaId}`)).status).toBe(404)
    expect((await staleApp.request(`/v1/chapters/${chapterId}`)).status).toBe(
      404
    )
    expect(
      (
        (await (await staleApp.request("/v1/manga")).json()) as {
          data: { id: string }[]
        }
      ).data.map(({ id }) => id)
    ).not.toContain(mangaId)
    expect({ reads, writes }).toEqual({ reads: 0, writes: 0 })

    const body = (await hidden.json()) as { data: { version: number } }
    expect(
      (
        await request(admin, `/v1/admin/manga/${mangaId}/visibility`, "PUT", {
          hidden: false,
          expectedVersion: body.data.version,
        })
      ).status
    ).toBe(200)
  })

  test("Redis failure during moderation cannot leave hidden content public", async () => {
    const unavailable = new BusinessCache(
      {
        ...env,
        REDIS_CACHE_ENABLED: true,
        REDIS_URL: "redis://127.0.0.1:1",
        REDIS_CONNECT_TIMEOUT_MS: 100,
        REDIS_RECONNECT_RETRY_MS: 60_000,
      },
      noop
    )
    await unavailable.connect()
    const degradedApp = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        database: runtime.database,
        cache: unavailable,
        assetBaseUrl: "http://localhost:9000/",
      },
      logger: noop,
      webOrigin: origin,
    })
    let hiddenVersion: number | undefined

    try {
      const [before] = await runtime.database
        .select({ version: manga.version })
        .from(manga)
        .where(eq(manga.id, mangaId))
      const hidden = await degradedApp.request(
        `/v1/admin/manga/${mangaId}/visibility`,
        {
          method: "PUT",
          headers: {
            Cookie: admin.cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hidden: true,
            expectedVersion: before!.version,
            reason: "Redis failure regression",
          }),
        }
      )
      expect(hidden.status).toBe(200)
      hiddenVersion = ((await hidden.json()) as { data: { version: number } })
        .data.version
      expect(unavailable.status).toBe("degraded")
      expect((await degradedApp.request(`/v1/manga/${mangaId}`)).status).toBe(
        404
      )
      expect(
        (await degradedApp.request(`/v1/chapters/${chapterId}`)).status
      ).toBe(404)
      const list = (await (await degradedApp.request("/v1/manga")).json()) as {
        data: { id: string }[]
      }
      expect(list.data.map(({ id }) => id)).not.toContain(mangaId)
      expect((await app.request(`/v1/manga/${mangaId}`)).status).toBe(404)
    } finally {
      if (hiddenVersion !== undefined)
        expect(
          (
            await request(
              admin,
              `/v1/admin/manga/${mangaId}/visibility`,
              "PUT",
              { hidden: false, expectedVersion: hiddenVersion }
            )
          ).status
        ).toBe(200)
      await unavailable.close()
    }
  })

  test("moderator unhide preserves group-owned publication states", async () => {
    const [currentManga] = await runtime.database
      .update(manga)
      .set({ publicationState: "hidden" })
      .where(eq(manga.id, mangaId))
      .returning({ version: manga.version })
    const mangaHidden = await request(
      admin,
      `/v1/admin/manga/${mangaId}/visibility`,
      "PUT",
      {
        hidden: true,
        expectedVersion: currentManga!.version,
        reason: "Independent visibility fixture",
      }
    )
    const mangaHiddenBody = (await mangaHidden.json()) as {
      data: { version: number }
    }
    const mangaUnhidden = await request(
      admin,
      `/v1/admin/manga/${mangaId}/visibility`,
      "PUT",
      {
        hidden: false,
        expectedVersion: mangaHiddenBody.data.version,
      }
    )
    expect(mangaUnhidden.status).toBe(200)
    expect(await mangaUnhidden.json()).toMatchObject({
      data: { publicationState: "hidden", moderationHiddenAt: null },
    })
    await runtime.database
      .update(manga)
      .set({ publicationState: "published" })
      .where(eq(manga.id, mangaId))

    const now = new Date()
    await runtime.database.insert(chapter).values({
      ownerGroupId: groupId,
      id: hiddenChapterId,

      mangaId,
      uploaderUserId: owner.id,
      number: "2",
      language: "vi",
      pageCount: 0,
      availablePageCount: 0,
      isFull: false,
      publicationState: "hidden",
      moderationHiddenAt: now,
      publishedAt: now,
    })
    const unhidden = await request(
      admin,
      `/v1/admin/chapters/${hiddenChapterId}/visibility`,
      "PUT",
      {
        hidden: false,
        expectedVersion: 1,
      }
    )
    expect(unhidden.status).toBe(200)
    expect(await unhidden.json()).toMatchObject({
      data: {
        publicationState: "hidden",
        moderationHiddenAt: null,
        version: 2,
      },
    })
    expect(
      (await request(undefined, `/v1/chapters/${hiddenChapterId}`)).status
    ).toBe(404)
    await runtime.database
      .delete(chapter)
      .where(eq(chapter.id, hiddenChapterId))
  })

  test("chapter navigation excludes a newly moderated sibling", async () => {
    const siblingId = randomUUID()
    const publishedAt = new Date()
    await runtime.database.insert(chapter).values({
      ownerGroupId: groupId,
      id: siblingId,
      mangaId,
      uploaderUserId: owner.id,
      number: "2",
      language: "vi",
      pageCount: 1,
      availablePageCount: 1,
      pagesVersion: 1,
      isFull: true,
      publicationState: "published",
      publishedAt,
    })
    await runtime.database
      .insert(chapterGroup)
      .values({ chapterId: siblingId, groupId })
    await runtime.database.insert(chapterPage).values({
      chapterId: siblingId,
      position: 0,
      originalKey: `chapters/${siblingId}/0.webp`,
      width: 800,
      height: 1200,
    })
    try {
      const before = (await (
        await request(undefined, `/v1/chapters/${chapterId}`)
      ).json()) as { next: { id: string } | null }
      expect(before.next?.id).toBe(siblingId)

      expect(
        (
          await request(
            admin,
            `/v1/admin/chapters/${siblingId}/visibility`,
            "PUT",
            { hidden: true, expectedVersion: 1, reason: "Navigation review" }
          )
        ).status
      ).toBe(200)
      const hidden = (await (
        await request(undefined, `/v1/chapters/${chapterId}`)
      ).json()) as { next: { id: string } | null }
      expect(hidden.next).toBeNull()

      expect(
        (
          await request(
            admin,
            `/v1/admin/chapters/${siblingId}/visibility`,
            "PUT",
            { hidden: false, expectedVersion: 2 }
          )
        ).status
      ).toBe(200)
      const restored = (await (
        await request(undefined, `/v1/chapters/${chapterId}`)
      ).json()) as { next: { id: string } | null }
      expect(restored.next?.id).toBe(siblingId)
    } finally {
      await runtime.database
        .delete(moderationAction)
        .where(eq(moderationAction.targetId, siblingId))
      await runtime.database.delete(chapter).where(eq(chapter.id, siblingId))
    }
  })

  test("moderation disappears from secondary public and private read paths", async () => {
    const personId = randomUUID()
    const commentId = randomUUID()
    const notificationId = randomUUID()
    let hiddenVersion: number | undefined
    await runtime.database.insert(person).values({
      id: personId,
      slug: `phase-9a-person-${personId}`,
      name: "Phase 9A person",
    })
    await runtime.database
      .insert(mangaPerson)
      .values({ mangaId, personId, role: "author" })
    await runtime.database.insert(libraryItem).values({
      userId: owner.id,
      mangaId,
      category: "following",
    })
    await runtime.database.insert(readingHistory).values({
      userId: owner.id,
      mangaId,
      chapterId,
      readAt: new Date(),
    })
    await runtime.database.insert(comment).values({
      id: commentId,
      userId: owner.id,
      mangaId,
      chapterId,
      body: "Phase 9A visibility comment",
    })
    await runtime.database.insert(notification).values({
      id: notificationId,
      userId: owner.id,
      type: "manga_new_chapter",
      mangaId,
      chapterId,
    })
    await runtime.database
      .update(mangaStats)
      .set({ views: 9_000_000_000n })
      .where(eq(mangaStats.mangaId, mangaId))

    try {
      const groupBefore = (await (
        await request(undefined, `/v1/groups/${groupId}`)
      ).json()) as { statistics: { mangaCount: number; chapterCount: number } }
      expect(groupBefore.statistics).toMatchObject({
        mangaCount: 1,
        chapterCount: 1,
      })
      const personBefore = (await (
        await request(undefined, `/v1/people/${personId}`)
      ).json()) as { roles: string[] }
      expect(personBefore.roles).toEqual(["author"])
      expect(
        (await request(undefined, `/v1/manga/${mangaId}/recommendations`))
          .status
      ).toBe(200)
      const latestBefore = (await (
        await request(undefined, "/v1/chapters/latest?limit=100")
      ).json()) as { data: { id: string }[] }
      expect(latestBefore.data.map(({ id }) => id)).toContain(chapterId)
      const rankingBefore = (await (
        await request(
          undefined,
          "/v1/rankings/manga?metric=views&window=all-time&limit=50"
        )
      ).json()) as { data: { manga: { id: string } }[] }
      expect(rankingBefore.data.map(({ manga }) => manga.id)).toContain(mangaId)
      const notificationsBefore = (await (
        await request(owner, "/v1/me/notifications")
      ).json()) as { data: { id: string }[]; meta: { unreadCount: number } }
      expect(notificationsBefore.data.map(({ id }) => id)).toContain(
        notificationId
      )
      expect(notificationsBefore.meta.unreadCount).toBeGreaterThan(0)
      const historyBefore = (await (
        await request(owner, "/v1/me/reading-history")
      ).json()) as { data: { progress: { chapterId: string } }[] }
      expect(
        historyBefore.data.map(({ progress }) => progress.chapterId)
      ).toContain(chapterId)
      const libraryBefore = (await (
        await request(owner, "/v1/me/library")
      ).json()) as { data: { manga: { id: string } }[] }
      expect(libraryBefore.data.map(({ manga }) => manga.id)).toContain(mangaId)
      const commentsBefore = (await (
        await request(undefined, "/v1/comments/recent")
      ).json()) as { data: { id: string }[] }
      expect(commentsBefore.data.map(({ id }) => id)).toContain(commentId)

      const [current] = await runtime.database
        .select({ version: manga.version })
        .from(manga)
        .where(eq(manga.id, mangaId))
      const hidden = await request(
        admin,
        `/v1/admin/manga/${mangaId}/visibility`,
        "PUT",
        {
          hidden: true,
          expectedVersion: current!.version,
          reason: "Secondary read regression",
        }
      )
      expect(hidden.status).toBe(200)
      hiddenVersion = ((await hidden.json()) as { data: { version: number } })
        .data.version

      const groupHidden = (await (
        await request(undefined, `/v1/groups/${groupId}`)
      ).json()) as { statistics: { mangaCount: number; chapterCount: number } }
      expect(groupHidden.statistics).toMatchObject({
        mangaCount: 0,
        chapterCount: 0,
      })
      const personHidden = (await (
        await request(undefined, `/v1/people/${personId}`)
      ).json()) as { roles: string[] }
      expect(personHidden.roles).toEqual([])
      expect(
        (await request(undefined, `/v1/manga/${mangaId}/recommendations`))
          .status
      ).toBe(404)
      const latestHidden = (await (
        await request(undefined, "/v1/chapters/latest?limit=100")
      ).json()) as { data: { id: string }[] }
      expect(latestHidden.data.map(({ id }) => id)).not.toContain(chapterId)
      const rankingHidden = (await (
        await request(
          undefined,
          "/v1/rankings/manga?metric=views&window=all-time&limit=50"
        )
      ).json()) as { data: { manga: { id: string } }[] }
      expect(rankingHidden.data.map(({ manga }) => manga.id)).not.toContain(
        mangaId
      )
      const notificationsHidden = (await (
        await request(owner, "/v1/me/notifications")
      ).json()) as { data: { id: string }[]; meta: { unreadCount: number } }
      expect(notificationsHidden.data.map(({ id }) => id)).not.toContain(
        notificationId
      )
      expect(notificationsHidden.meta.unreadCount).toBe(0)
      const historyHidden = (await (
        await request(owner, "/v1/me/reading-history")
      ).json()) as { data: { progress: { chapterId: string } }[] }
      expect(
        historyHidden.data.map(({ progress }) => progress.chapterId)
      ).not.toContain(chapterId)
      const libraryHidden = (await (
        await request(owner, "/v1/me/library")
      ).json()) as { data: { manga: { id: string } }[] }
      expect(libraryHidden.data.map(({ manga }) => manga.id)).not.toContain(
        mangaId
      )
      expect(
        (await request(undefined, `/v1/manga/${mangaId}/comments`)).status
      ).toBe(404)
      const commentsHidden = (await (
        await request(undefined, "/v1/comments/recent")
      ).json()) as { data: { id: string }[] }
      expect(commentsHidden.data.map(({ id }) => id)).not.toContain(commentId)
    } finally {
      if (hiddenVersion !== undefined)
        expect(
          (
            await request(
              admin,
              `/v1/admin/manga/${mangaId}/visibility`,
              "PUT",
              { hidden: false, expectedVersion: hiddenVersion }
            )
          ).status
        ).toBe(200)
      await runtime.database
        .update(mangaStats)
        .set({ views: 10n })
        .where(eq(mangaStats.mangaId, mangaId))
      await runtime.database
        .delete(notification)
        .where(eq(notification.id, notificationId))
      await runtime.database.delete(comment).where(eq(comment.id, commentId))
      await runtime.database
        .delete(readingHistory)
        .where(
          and(
            eq(readingHistory.userId, owner.id),
            eq(readingHistory.chapterId, chapterId)
          )
        )
      await runtime.database
        .delete(libraryItem)
        .where(
          and(
            eq(libraryItem.userId, owner.id),
            eq(libraryItem.mangaId, mangaId)
          )
        )
      await runtime.database
        .delete(mangaPerson)
        .where(
          and(
            eq(mangaPerson.mangaId, mangaId),
            eq(mangaPerson.personId, personId)
          )
        )
      await runtime.database.delete(person).where(eq(person.id, personId))
    }
  })
})
