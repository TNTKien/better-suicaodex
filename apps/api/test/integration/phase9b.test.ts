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
import { and, eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { parseISO } from "date-fns"

import { createApp } from "../../src/app"
import {
  chapter,
  comment,
  forbiddenWord,
  manga,
  mangaEngagementDaily,
  mangaStats,
  moderationAction,
  organization,
  user,
  userProfile,
} from "../../src/db/schema"
import { engagementBucketDate } from "../../src/features/ranking/engagement"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)

const origin = "http://localhost:3000"
const mangaId = randomUUID()
const chapterId = randomUUID()
const ownerGroupId = randomUUID()
const commentIds: string[] = []
const forbiddenWordIds: string[] = []
const accounts: Array<{ id: string; cookie: string }> = []
const createdAt = new Date("2026-09-20T10:00:00.000Z")
let runtime: Runtime
let app: ReturnType<typeof createApp>
let admin: (typeof accounts)[number]
let owner: (typeof accounts)[number]
let other: (typeof accounts)[number]

async function account(name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `phase9b-${randomUUID()}@example.com`,
      name,
      password: "phase9b-fixture-password",
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
  body?: unknown,
  requestOrigin = origin
) {
  return app.request(path, {
    method,
    headers: {
      Origin: requestOrigin,
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function createComment(body: string, parentId?: string) {
  const response = await request(
    owner,
    `/v1/chapters/${chapterId}/comments`,
    "POST",
    { body, ...(parentId ? { parentId } : {}) }
  )
  expect(response.status).toBe(201)
  const result = (await response.json()) as {
    id: string
    body: string
    version: number
    createdAt: string
  }
  commentIds.push(result.id)
  return result
}

async function commentCount() {
  const [row] = await runtime.database
    .select({ comments: mangaStats.comments })
    .from(mangaStats)
    .where(eq(mangaStats.mangaId, mangaId))
  return row?.comments
}

async function dailyCount(commentCreatedAt: Date) {
  const [row] = await runtime.database
    .select({ comments: mangaEngagementDaily.comments })
    .from(mangaEngagementDaily)
    .where(
      and(
        eq(mangaEngagementDaily.mangaId, mangaId),
        eq(
          mangaEngagementDaily.bucketDate,
          engagementBucketDate(commentCreatedAt)
        )
      )
    )
  return row?.comments ?? 0n
}

describe.serial("Phase 9B comment moderation", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")

    const env = parseRuntimeEnv({
      ...process.env,
      NODE_ENV: "test",
      WEB_ORIGIN: origin,
      DATABASE_URL: url,
      REDIS_CACHE_ENABLED: "false",
    })
    runtime = await createRuntime(env, () => undefined)
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        assetBaseUrl: "http://localhost:9000/",
        cache: runtime.cache,
        database: runtime.database,
      },
      logger: () => undefined,
      webOrigin: origin,
    })

    admin = await account("Phase 9B admin")
    owner = await account("Phase 9B owner")
    other = await account("Phase 9B other")
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, admin.id))
    await runtime.database
      .update(userProfile)
      .set({ isPublic: true })
      .where(eq(userProfile.userId, owner.id))

    await runtime.database.insert(organization).values({
      id: ownerGroupId,
      name: "Phase 9B owner group",
      slug: `phase-9b-owner-${randomUUID()}`,
      createdAt,
    })

    await runtime.database.insert(manga).values({
      ownerGroupId,
      id: mangaId,
      slug: `phase-9b-${randomUUID()}`,
      title: "Phase 9B Manga",
      searchTitle: "phase 9b manga",
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      publicationState: "published",
      hasUsableChapters: true,
      latestChapterPublishedAt: createdAt,
      publishedAt: createdAt,
    })
    await runtime.database.insert(chapter).values({
      ownerGroupId,
      id: chapterId,
      mangaId,
      number: "1",
      title: "Comment moderation",
      language: "vi",
      pageCount: 1,
      availablePageCount: 1,
      isFull: true,
      publicationState: "published",
      publishedAt: createdAt,
    })
    await runtime.database.insert(mangaStats).values({
      mangaId,
      views: 0,
      follows: 0,
      comments: 0,
    })
  })

  afterAll(async () => {
    if (!runtime) return
    if (commentIds.length) {
      await runtime.database
        .delete(moderationAction)
        .where(inArray(moderationAction.targetId, commentIds))
      await runtime.database
        .delete(comment)
        .where(inArray(comment.id, commentIds))
    }
    if (forbiddenWordIds.length)
      await runtime.database
        .delete(forbiddenWord)
        .where(inArray(forbiddenWord.id, forbiddenWordIds))
    await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, ownerGroupId))
    if (accounts.length)
      await runtime.database.delete(user).where(
        inArray(
          user.id,
          accounts.map(({ id }) => id)
        )
      )
    await runtime.close()
  })

  test("protects admin comment routes and returns private list data", async () => {
    const guest = await request(undefined, "/v1/admin/comments")
    expect(guest.status).toBe(401)
    expect(guest.headers.get("cache-control")).toBe("private, no-store")
    expect((await request(other, "/v1/admin/comments")).status).toBe(403)

    const response = await request(admin, "/v1/admin/comments")
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")

    const wrongOrigin = await request(
      admin,
      `/v1/admin/comments/${randomUUID()}/visibility`,
      "PUT",
      { hidden: true, expectedVersion: 1 },
      "https://example.invalid"
    )
    expect(wrongOrigin.status).toBe(403)
  })

  test("keeps replies when a root is hidden and updates engagement once", async () => {
    const root = await createComment("Phase 9B root body")
    const reply = await createComment("Phase 9B visible reply", root.id)
    const rootCreatedAt = parseISO(root.createdAt)
    expect(await commentCount()).toBe(2n)
    expect(await dailyCount(rootCreatedAt)).toBe(2n)

    const strictInput = await request(
      admin,
      `/v1/admin/comments/${root.id}/visibility`,
      "PUT",
      { hidden: true, expectedVersion: root.version, reason: "not accepted" }
    )
    expect(strictInput.status).toBe(400)

    const hidden = await request(
      admin,
      `/v1/admin/comments/${root.id}/visibility`,
      "PUT",
      { hidden: true, expectedVersion: root.version }
    )
    expect(hidden.status).toBe(200)
    expect(await hidden.json()).toMatchObject({
      data: { id: root.id, status: "hidden", version: 2 },
    })
    expect(await commentCount()).toBe(1n)
    expect(await dailyCount(rootCreatedAt)).toBe(1n)

    const replyToHidden = await request(
      owner,
      `/v1/chapters/${chapterId}/comments`,
      "POST",
      { body: "must not be created", parentId: root.id }
    )
    expect(replyToHidden.status).toBe(400)
    expect(await replyToHidden.json()).toMatchObject({
      error: { code: "INVALID_PARENT" },
    })

    const thread = (await (
      await request(undefined, `/v1/chapters/${chapterId}/comments`)
    ).json()) as {
      data: Array<{
        id: string
        body: string | null
        deleted: boolean
        hidden: boolean
        version: number
        replies: Array<{ id: string; body: string | null; hidden: boolean }>
      }>
      meta: { total: number }
    }
    const tombstone = thread.data.find(({ id }) => id === root.id)
    expect(tombstone).toMatchObject({
      body: null,
      deleted: false,
      hidden: true,
      version: 2,
      replies: [
        { id: reply.id, body: "Phase 9B visible reply", hidden: false },
      ],
    })
    expect(thread.meta.total).toBe(1)

    const recent = (await (
      await request(undefined, "/v1/comments/recent?limit=10")
    ).json()) as { data: Array<{ id: string }> }
    expect(recent.data.map(({ id }) => id)).not.toContain(root.id)
    expect(recent.data.map(({ id }) => id)).toContain(reply.id)

    const profile = (await (
      await request(undefined, `/v1/profiles/${owner.id}`)
    ).json()) as { commentCount: number; recentComments: Array<{ id: string }> }
    expect(profile.commentCount).toBe(1)
    expect(profile.recentComments.map(({ id }) => id)).not.toContain(root.id)

    const adminList = (await (
      await request(
        admin,
        `/v1/admin/comments?status=hidden&chapterId=${chapterId}&q=${encodeURIComponent("Phase 9B root")}`
      )
    ).json()) as {
      data: Array<{ id: string; body: string; status: string; version: number }>
      meta: { total: number }
    }
    expect(adminList).toMatchObject({
      data: [
        {
          id: root.id,
          body: "Phase 9B root body",
          status: "hidden",
          version: 2,
        },
      ],
      meta: { total: 1 },
    })

    const [audit] = await runtime.database
      .select({
        action: moderationAction.action,
        before: moderationAction.before,
        after: moderationAction.after,
      })
      .from(moderationAction)
      .where(
        and(
          eq(moderationAction.targetKind, "comment"),
          eq(moderationAction.targetId, root.id)
        )
      )
    expect(audit?.action).toBe("moderation.comment.hidden")
    expect(JSON.stringify(audit)).not.toContain("Phase 9B root body")

    const shown = await request(
      admin,
      `/v1/admin/comments/${root.id}/visibility`,
      "PUT",
      { hidden: false, expectedVersion: 2 }
    )
    expect(shown.status).toBe(200)
    expect(await commentCount()).toBe(2n)
    expect(await dailyCount(rootCreatedAt)).toBe(2n)

    const concurrent = await Promise.all([
      request(admin, `/v1/admin/comments/${root.id}/visibility`, "PUT", {
        hidden: true,
        expectedVersion: 3,
      }),
      request(admin, `/v1/admin/comments/${root.id}/visibility`, "PUT", {
        hidden: true,
        expectedVersion: 3,
      }),
    ])
    expect(concurrent.map(({ status }) => status).sort()).toEqual([200, 409])
    expect(await commentCount()).toBe(1n)

    const deleted = await request(owner, `/v1/comments/${root.id}`, "DELETE", {
      expectedVersion: 4,
    })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toMatchObject({
      id: root.id,
      body: null,
      deleted: true,
      hidden: true,
      version: 5,
    })
    expect(await commentCount()).toBe(1n)
    expect(await dailyCount(rootCreatedAt)).toBe(1n)

    const restoreDeleted = await request(
      admin,
      `/v1/admin/comments/${root.id}/visibility`,
      "PUT",
      { hidden: false, expectedVersion: 5 }
    )
    expect(restoreDeleted.status).toBe(409)
    expect(await restoreDeleted.json()).toMatchObject({
      error: { code: "COMMENT_DELETED" },
    })
  })

  test("uses compare-and-set for self edit and blocks editing hidden comments", async () => {
    const editable = await createComment("Phase 9B editable")
    const editableCreatedAt = parseISO(editable.createdAt)
    const edited = await request(
      owner,
      `/v1/comments/${editable.id}`,
      "PATCH",
      { body: "Phase 9B edited", expectedVersion: editable.version }
    )
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({
      id: editable.id,
      body: "Phase 9B edited",
      hidden: false,
      version: 2,
    })

    const stale = await request(owner, `/v1/comments/${editable.id}`, "PATCH", {
      body: "stale",
      expectedVersion: 1,
    })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({
      error: { code: "VERSION_CONFLICT" },
    })

    expect(
      (
        await request(
          admin,
          `/v1/admin/comments/${editable.id}/visibility`,
          "PUT",
          { hidden: true, expectedVersion: 2 }
        )
      ).status
    ).toBe(200)
    const hiddenEdit = await request(
      owner,
      `/v1/comments/${editable.id}`,
      "PATCH",
      { body: "must stay hidden", expectedVersion: 3 }
    )
    expect(hiddenEdit.status).toBe(409)
    expect(await hiddenEdit.json()).toMatchObject({
      error: { code: "COMMENT_HIDDEN" },
    })

    const deleted = await request(
      owner,
      `/v1/comments/${editable.id}`,
      "DELETE",
      { expectedVersion: 3 }
    )
    expect(deleted.status).toBe(200)
    expect(await commentCount()).toBe(1n)
    expect(await dailyCount(editableCreatedAt)).toBe(1n)
  })

  test("manages forbidden words and censors comment creates and edits", async () => {
    const phrase = `phase9b-${randomUUID()}`
    expect(
      (await request(undefined, "/v1/admin/comments/forbidden-words")).status
    ).toBe(401)
    expect(
      (await request(other, "/v1/admin/comments/forbidden-words")).status
    ).toBe(403)

    const created = await request(
      admin,
      "/v1/admin/comments/forbidden-words",
      "POST",
      { words: [phrase, `  ${phrase.toUpperCase()}  `] }
    )
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as {
      data: Array<{ id: string; word: string }>
    }
    expect(createdBody.data).toHaveLength(1)
    expect(createdBody.data[0]?.word).toBe(phrase)
    forbiddenWordIds.push(createdBody.data[0]!.id)

    const duplicate = await request(
      admin,
      "/v1/admin/comments/forbidden-words",
      "POST",
      { words: [phrase.toUpperCase()] }
    )
    expect(duplicate.status).toBe(409)

    const listed = (await (
      await request(admin, "/v1/admin/comments/forbidden-words")
    ).json()) as { data: Array<{ id: string; word: string }> }
    expect(listed.data).toContainEqual(createdBody.data[0]!)

    const censored = await createComment(`before ${phrase.toUpperCase()} after`)
    expect(censored.body).toBe("before *** after")

    const editable = await createComment("clean before edit")
    const edited = await request(
      owner,
      `/v1/comments/${editable.id}`,
      "PATCH",
      { body: `edited ${phrase}`, expectedVersion: editable.version }
    )
    expect(edited.status).toBe(200)
    expect(await edited.json()).toMatchObject({ body: "edited ***" })

    const deleted = await request(
      admin,
      `/v1/admin/comments/forbidden-words/${createdBody.data[0]!.id}`,
      "DELETE"
    )
    expect(deleted.status).toBe(200)
    const uncensored = await createComment(`after delete ${phrase}`)
    expect(uncensored.body).toBe(`after delete ${phrase}`)
  })

  test("updates a comment batch atomically", async () => {
    const first = await createComment("Phase 9B bulk first")
    const second = await createComment("Phase 9B bulk second")
    const firstCreatedAt = parseISO(first.createdAt)
    const commentsBefore = (await commentCount())!
    const dailyBefore = await dailyCount(firstCreatedAt)

    const hidden = await request(
      admin,
      "/v1/admin/comments/visibility",
      "PUT",
      {
        hidden: true,
        items: [
          { id: first.id, expectedVersion: first.version },
          { id: second.id, expectedVersion: second.version },
        ],
      }
    )
    expect(hidden.status).toBe(200)
    expect(await hidden.json()).toMatchObject({
      data: [
        { id: first.id, status: "hidden", version: 2 },
        { id: second.id, status: "hidden", version: 2 },
      ],
    })
    expect(await commentCount()).toBe(commentsBefore - 2n)
    expect(await dailyCount(firstCreatedAt)).toBe(dailyBefore - 2n)

    const visible = await request(
      admin,
      "/v1/admin/comments/visibility",
      "PUT",
      {
        hidden: false,
        items: [
          { id: first.id, expectedVersion: 2 },
          { id: second.id, expectedVersion: 2 },
        ],
      }
    )
    expect(visible.status).toBe(200)
    expect(await commentCount()).toBe(commentsBefore)
    expect(await dailyCount(firstCreatedAt)).toBe(dailyBefore)

    const stale = await request(admin, "/v1/admin/comments/visibility", "PUT", {
      hidden: true,
      items: [
        { id: first.id, expectedVersion: 3 },
        { id: second.id, expectedVersion: 2 },
      ],
    })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({
      error: { code: "VERSION_CONFLICT" },
    })
    const stored = await runtime.database
      .select({
        id: comment.id,
        status: comment.status,
        version: comment.version,
      })
      .from(comment)
      .where(inArray(comment.id, [first.id, second.id]))
    expect(stored).toEqual(
      expect.arrayContaining([
        { id: first.id, status: "visible", version: 3 },
        { id: second.id, status: "visible", version: 3 },
      ])
    )
    expect(await commentCount()).toBe(commentsBefore)

    const duplicate = await request(
      admin,
      "/v1/admin/comments/visibility",
      "PUT",
      {
        hidden: true,
        items: [
          { id: first.id, expectedVersion: 3 },
          { id: first.id, expectedVersion: 3 },
        ],
      }
    )
    expect(duplicate.status).toBe(400)
  })

  test("rolls back visibility and engagement when audit creation fails", async () => {
    const rollback = await createComment("Phase 9B audit rollback")
    const rollbackCreatedAt = parseISO(rollback.createdAt)
    const commentsBefore = await commentCount()
    const dailyBefore = await dailyCount(rollbackCreatedAt)

    await runtime.database.execute(
      sql.raw(`
      create or replace function phase9b_reject_comment_audit()
      returns trigger language plpgsql as $$
      begin
        if new.target_kind = 'comment'
          and new.target_id = '${rollback.id}'::uuid then
          raise exception 'phase9b forced audit failure';
        end if;
        return new;
      end
      $$
    `)
    )
    await runtime.database.execute(
      sql.raw(`
      drop trigger if exists phase9b_reject_comment_audit
      on moderation_action
    `)
    )
    await runtime.database.execute(
      sql.raw(`
      create trigger phase9b_reject_comment_audit
      before insert on moderation_action
      for each row execute function phase9b_reject_comment_audit()
    `)
    )

    try {
      const response = await request(
        admin,
        `/v1/admin/comments/${rollback.id}/visibility`,
        "PUT",
        { hidden: true, expectedVersion: rollback.version }
      )
      expect(response.status).toBe(500)
    } finally {
      await runtime.database.execute(
        sql.raw(`
        drop trigger if exists phase9b_reject_comment_audit
        on moderation_action
      `)
      )
      await runtime.database.execute(
        sql.raw("drop function if exists phase9b_reject_comment_audit()")
      )
    }

    const [stored] = await runtime.database
      .select({ status: comment.status, version: comment.version })
      .from(comment)
      .where(eq(comment.id, rollback.id))
    expect(stored).toEqual({ status: "visible", version: rollback.version })
    expect(await commentCount()).toBe(commentsBefore)
    expect(await dailyCount(rollbackCreatedAt)).toBe(dailyBefore)
  })
})
