import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { and, count, eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createHash, randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { createApp } from "../../src/app"
import {
  avatarFrame,
  avatarFrameTopic,
  comment,
  manga,
  moderationAction,
  organization,
  translationGroupProfile,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { MediaStorage } from "../../src/shared/storage"

setDefaultTimeout(120_000)
const origin = "http://localhost:3000"
const assetBaseUrl = "https://assets.example/"
const objects = new Map<string, Uint8Array>()
let failStorage = false
const storage: MediaStorage = {
  async put(key, body) {
    objects.set(key, Uint8Array.from(body))
  },
  async head(key) {
    return {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
      contentLength: failStorage ? 0 : objects.get(key)?.length,
    }
  },
  async delete(key) {
    objects.delete(key)
  },
}
let runtime: Runtime
let app: ReturnType<typeof createApp>
const accounts: Array<{ id: string; cookie: string }> = []
const frameIds: string[] = []
const topicIds: string[] = []
const oldUser = `frames-old-${randomUUID()}`
const groupId = randomUUID()
const mangaId = randomUUID()
let admin: (typeof accounts)[number]
let reader: (typeof accounts)[number]
let stranger: (typeof accounts)[number]
const buildApp = (enabled = true) =>
  createApp({
    account: { database: runtime.database },
    auth: runtime.auth,
    avatarFramesEnabled: enabled,
    coverStorage: storage,
    catalog: { assetBaseUrl, cache: runtime.cache, database: runtime.database },
    webOrigin: origin,
    logger: () => undefined,
  })
async function signup(name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      email: `frames-${randomUUID()}@example.com`,
      name,
      password: "frames-integration-password",
    }),
  })
  expect(response.status).toBe(200)
  const actor = {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
  accounts.push(actor)
  return actor
}
function request(
  actor: (typeof accounts)[number] | null,
  path: string,
  method = "GET",
  body?: unknown,
  webOrigin = origin,
  target = app
) {
  return target.request(path, {
    method,
    headers: {
      Origin: webOrigin,
      ...(actor ? { Cookie: actor.cookie } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
  })
}
type Frame = {
  id: string
  version: number
  displayScale: number
  offsetX: number
  offsetY: number
  frame: {
    assetUrl: string
    previewUrl: string
    animated: boolean
    width: number
    height: number
  } | null
}
async function create(rarity: "R" | "SR" | "SSR" = "R", limited = false) {
  const response = await request(admin, "/v1/admin/avatar-frames", "POST", {
    code: `frame-${randomUUID()}`,
    name: "Test frame",
    rarity,
    limited,
  })
  expect(response.status).toBe(201)
  const row = ((await response.json()) as { data: Frame }).data
  frameIds.push(row.id)
  return row
}
async function image() {
  return sharp({
    create: {
      width: 318,
      height: 318,
      channels: 4,
      background: { r: 90, g: 40, b: 120, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer()
}
async function upload(row: Frame, bytes?: Buffer, actor = admin) {
  const form = new FormData()
  form.set("expectedVersion", String(row.version))
  form.set(
    "file",
    new Blob([bytes ?? (await image())], { type: "image/webp" }),
    "frame.webp"
  )
  return request(actor, `/v1/admin/avatar-frames/${row.id}/asset`, "POST", form)
}
async function update(row: Frame, values: Record<string, unknown>) {
  return request(admin, `/v1/admin/avatar-frames/${row.id}`, "PATCH", {
    expectedVersion: row.version,
    ...values,
  })
}
async function ready(
  rarity: "R" | "SR" | "SSR" = "R",
  limited = false,
  bytes?: Buffer
) {
  const draft = await create(rarity, limited)
  const response = await upload(draft, bytes)
  expect(response.status).toBe(200)
  const uploaded = ((await response.json()) as { data: Frame }).data
  const activated = await update(uploaded, { active: true })
  expect(activated.status).toBe(200)
  return ((await activated.json()) as { data: Frame }).data
}
const ownership = (row: Frame, method: "PUT" | "DELETE", target = reader) =>
  request(
    admin,
    `/v1/admin/users/${target.id}/avatar-frames/${row.id}`,
    method,
    {}
  )
const equip = (row: Frame, target = reader, appTarget = app) =>
  request(
    target,
    "/v1/me/avatar-frame",
    "PUT",
    { frameId: row.id },
    origin,
    appTarget
  )
const key = (url: string) => new URL(url).pathname.slice(1)

describe.serial("Phase 10E.F1 avatar frames", () => {
  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL
    if (!databaseUrl || databaseUrl === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    runtime = await createRuntime(
      parseRuntimeEnv({
        ...process.env,
        NODE_ENV: "test",
        WEB_ORIGIN: origin,
        DATABASE_URL: databaseUrl,
        REDIS_CACHE_ENABLED: "false",
        ASSET_BASE_URL: assetBaseUrl,
      }),
      () => undefined
    )
    const migrations = fileURLToPath(new URL("../../drizzle", import.meta.url))
    await migrate(runtime.database, { migrationsFolder: migrations })
    await runtime.database.execute(
      sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES (${oldUser}, 'Old account', ${`${oldUser}@example.com`}, false, now(), now())`
    )
    await runtime.database.execute(
      sql`INSERT INTO user_profile (user_id, bio) VALUES (${oldUser}, 'Preserved bio')`
    )
    await migrate(runtime.database, { migrationsFolder: migrations })
    const [preserved] = await runtime.database
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, oldUser))
    expect(preserved?.bio).toBe("Preserved bio")
    expect(preserved?.avatarFrameId).toBeNull()
    expect(
      (
        await runtime.database.select({ total: count() }).from(userAvatarFrame)
      )[0]?.total
    ).toBe(0)
    app = buildApp()
    admin = await signup("Frame admin")
    reader = await signup("Frame reader")
    stranger = await signup("Frame stranger")
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, admin.id))
    await runtime.database.insert(organization).values({
      id: groupId,
      name: "Frame group",
      slug: `frame-${groupId}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: groupId,
      approvalStatus: "approved",
      publicationState: "published",
      createdByUserId: admin.id,
    })
    await runtime.database.insert(manga).values({
      id: mangaId,
      slug: `frame-${mangaId}`,
      title: "Frame manga",
      searchTitle: "frame manga",
      ownerGroupId: groupId,
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      publicationState: "published",
    })
  })
  afterAll(async () => {
    if (!runtime) return
    const ids = [oldUser, ...accounts.map((row) => row.id)]
    if (topicIds.length) {
      await runtime.database
        .delete(avatarFrameTopic)
        .where(inArray(avatarFrameTopic.id, topicIds))
      await runtime.database
        .delete(moderationAction)
        .where(
          and(
            eq(moderationAction.targetKind, "avatar_frame_topic"),
            inArray(moderationAction.targetId, topicIds)
          )
        )
    }
    await runtime.database.delete(comment).where(eq(comment.mangaId, mangaId))
    await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, groupId))
    await runtime.database
      .delete(userAvatarFrame)
      .where(inArray(userAvatarFrame.userId, ids))
    await runtime.database
      .update(userProfile)
      .set({ avatarFrameId: null })
      .where(inArray(userProfile.userId, ids))
    if (frameIds.length) {
      await runtime.database
        .delete(moderationAction)
        .where(
          and(
            eq(moderationAction.targetKind, "avatar_frame"),
            inArray(moderationAction.targetId, frameIds)
          )
        )
      await runtime.database
        .delete(avatarFrame)
        .where(inArray(avatarFrame.id, frameIds))
    }
    await runtime.database.delete(user).where(inArray(user.id, ids))
    await runtime.close()
  })

  test("guards admin, trusted Origin, strict inputs, version, draft activation and limited lifecycle", async () => {
    expect((await request(null, "/v1/admin/avatar-frames")).status).toBe(401)
    expect((await request(reader, "/v1/admin/avatar-frames")).status).toBe(403)
    expect(
      (await request(reader, `/v1/admin/users/${stranger.id}/avatar-frames`))
        .status
    ).toBe(403)
    expect(
      (
        await request(
          admin,
          "/v1/admin/avatar-frames",
          "POST",
          { code: "a", name: "a", rarity: "R" },
          "https://evil.example"
        )
      ).status
    ).toBe(403)
    expect(
      (
        await request(admin, "/v1/admin/avatar-frames", "POST", {
          code: "a",
          name: "a",
          rarity: "R",
          assetUrl: "https://evil.example/",
        })
      ).status
    ).toBe(400)
    const draft = await create()
    expect(draft.frame).toBeNull()
    expect((await update(draft, { active: true })).status).toBe(409)
    expect((await upload(draft, undefined, reader)).status).toBe(403)
    expect((await upload(draft, Buffer.from("not an image"))).status).toBe(400)
    expect(
      (await upload(draft, Buffer.alloc(10 * 1024 * 1024 + 1))).status
    ).toBe(413)
    expect(objects.size).toBe(0)
    const row = await ready("SSR", true)
    expect((await ownership(row, "PUT")).status).toBe(403)
    const inactive = await update(row, { active: false })
    expect(inactive.status).toBe(200)
    const current = ((await inactive.json()) as { data: Frame }).data
    expect((await update(current, { limited: false })).status).toBe(403)
    expect((await update(row, { name: "stale" })).status).toBe(409)
  })
  test("grants once, never auto-equips, projects current frame everywhere, retains disabled/flag-off ownership", async () => {
    const row = await ready()
    const grants = await Promise.all([
      ownership(row, "PUT"),
      ownership(row, "PUT"),
    ])
    expect(grants.map((r) => r.status)).toEqual([200, 200])
    const outcomes = await Promise.all(
      grants.map((r) => r.json() as Promise<{ changed: boolean }>)
    )
    expect(outcomes.filter((r) => r.changed)).toHaveLength(1)
    const owned = await runtime.database
      .select()
      .from(userAvatarFrame)
      .where(
        and(
          eq(userAvatarFrame.userId, reader.id),
          eq(userAvatarFrame.frameId, row.id)
        )
      )
    expect(owned).toHaveLength(1)
    expect(
      (
        (await request(reader, "/v1/me").then((r) => r.json())) as {
          user: { avatarFrame: unknown }
        }
      ).user.avatarFrame
    ).toBeNull()
    expect((await equip(row, stranger)).status).toBe(403)
    const equipped = await equip(row)
    expect(equipped.status).toBe(200)
    expect(
      ((await equipped.json()) as { user: { avatarFrame: { id: string } } })
        .user.avatarFrame.id
    ).toBe(row.id)
    const [root] = await runtime.database
      .insert(comment)
      .values({ userId: reader.id, mangaId, body: "Frame comment" })
      .returning({ id: comment.id })
    await runtime.database.insert(comment).values({
      userId: reader.id,
      mangaId,
      parentId: root!.id,
      body: "Frame reply",
    })
    const publicProfile = (await request(
      null,
      `/v1/profiles/${reader.id}`
    ).then((r) => r.json())) as { avatarFrame: { id: string } }
    expect(publicProfile.avatarFrame.id).toBe(row.id)
    await runtime.database
      .update(userProfile)
      .set({ isPublic: false })
      .where(eq(userProfile.userId, reader.id))
    expect((await request(null, `/v1/profiles/${reader.id}`)).status).toBe(404)
    await runtime.database
      .update(userProfile)
      .set({ isPublic: true })
      .where(eq(userProfile.userId, reader.id))
    const feed = (await request(null, `/v1/manga/${mangaId}/comments`).then(
      (r) => r.json()
    )) as {
      data: Array<{
        author: { avatarFrame: { id: string } }
        replies: Array<{ author: { avatarFrame: { id: string } } }>
      }>
    }
    expect(feed.data[0]?.author.avatarFrame.id).toBe(row.id)
    expect(feed.data[0]?.replies[0]?.author.avatarFrame.id).toBe(row.id)
    const recent = (await request(null, "/v1/comments/recent").then((r) =>
      r.json()
    )) as { data: Array<{ author: { avatarFrame: { id: string } } }> }
    expect(recent.data.every((r) => r.author.avatarFrame.id === row.id)).toBe(
      true
    )
    const adminDetail = (await request(
      admin,
      `/v1/admin/users/${reader.id}`
    ).then((r) => r.json())) as { data: { avatarFrame: { id: string } } }
    expect(adminDetail.data.avatarFrame.id).toBe(row.id)
    const adminComments = (await request(
      admin,
      `/v1/admin/comments?mangaId=${mangaId}`
    ).then((r) => r.json())) as {
      data: Array<{ author: { avatarFrame: { id: string } } }>
    }
    expect(
      adminComments.data.every((r) => r.author.avatarFrame.id === row.id)
    ).toBe(true)
    const off = buildApp(false)
    expect(
      (
        (await request(reader, "/v1/me", "GET", undefined, origin, off).then(
          (r) => r.json()
        )) as { user: { avatarFrame: unknown } }
      ).user.avatarFrame
    ).toBeNull()
    expect((await equip(row, reader, off)).status).toBe(403)
    const offInventory = (await request(
      reader,
      "/v1/me/avatar-frames",
      "GET",
      undefined,
      origin,
      off
    ).then((r) => r.json())) as { enabled: boolean; selectedFrameId: string }
    expect(offInventory.enabled).toBe(false)
    expect(offInventory.selectedFrameId).toBe(row.id)
    await runtime.database
      .update(userProfile)
      .set({
        status: "suspended",
        moderatedAt: new Date(),
        moderationReason: "Restricted account test",
      })
      .where(eq(userProfile.userId, reader.id))
    expect((await equip(row)).status).toBe(403)
    expect(
      (
        await request(
          reader,
          "/v1/me/avatar-frame",
          "DELETE",
          undefined,
          origin,
          off
        )
      ).status
    ).toBe(200)
    await runtime.database
      .update(userProfile)
      .set({ status: "active" })
      .where(eq(userProfile.userId, reader.id))
    expect((await equip(row)).status).toBe(200)
    const selected = (await request(reader, "/v1/me/avatar-frames").then((r) =>
      r.json()
    )) as { selectedFrameId: string }
    expect(selected.selectedFrameId).toBe(row.id)
    const inactive = await update(row, { active: false })
    expect(inactive.status).toBe(200)
    const disabled = ((await inactive.json()) as { data: Frame }).data
    expect(
      (
        (await request(reader, "/v1/me").then((r) => r.json())) as {
          user: { avatarFrame: unknown }
        }
      ).user.avatarFrame
    ).toBeNull()
    expect(
      (
        (await request(reader, "/v1/me/avatar-frames").then((r) =>
          r.json()
        )) as { selectedFrameId: string }
      ).selectedFrameId
    ).toBe(row.id)
    const enabled = await update(disabled, { active: true })
    expect(enabled.status).toBe(200)
    expect(
      (
        (await request(reader, "/v1/me").then((r) => r.json())) as {
          user: { avatarFrame: { id: string } }
        }
      ).user.avatarFrame.id
    ).toBe(row.id)
    const races = await Promise.all([equip(row), ownership(row, "DELETE")])
    expect([200, 403]).toContain(races[0]!.status)
    expect(races[1]!.status).toBe(200)
    expect(
      (
        (await request(reader, "/v1/me").then((r) => r.json())) as {
          user: { avatarFrame: unknown }
        }
      ).user.avatarFrame
    ).toBeNull()
    expect(
      (
        (await ownership(row, "DELETE").then((r) => r.json())) as {
          changed: boolean
        }
      ).changed
    ).toBe(false)
    expect((await ownership(row, "PUT")).status).toBe(200)
    expect(
      (await request(reader, "/v1/me/avatar-frame", "DELETE")).status
    ).toBe(200)
    const audit = (await request(
      admin,
      `/v1/admin/audit?targetKind=avatar_frame&targetId=${row.id}`
    ).then((r) => r.json())) as {
      data: Array<{ action: string; reason: string }>
    }
    expect(
      audit.data
        .filter(
          (r) =>
            r.action === "avatar_frame.granted" ||
            r.action === "avatar_frame.revoked"
        )
        .every((r) => r.reason === "Admin avatar frame ownership change")
    ).toBe(true)
    expect(
      audit.data.filter((r) => r.action === "avatar_frame.granted")
    ).toHaveLength(2)
    expect(
      audit.data.filter((r) => r.action === "avatar_frame.revoked")
    ).toHaveLength(1)
    expect((await ownership(row, "PUT", admin)).status).toBe(200)
    expect((await equip(row, admin)).status).toBe(200)
    const projectedAudit = (await request(
      admin,
      `/v1/admin/audit?targetKind=avatar_frame&targetId=${row.id}`
    ).then((r) => r.json())) as {
      data: Array<{ actor: { avatarFrame: { id: string } } }>
    }
    expect(projectedAudit.data.length).toBeGreaterThan(0)
    expect(
      projectedAudit.data.every((r) => r.actor.avatarFrame.id === row.id)
    ).toBe(true)
  })
  test("alignment is admin-only, versioned, audited and projected without altering assets or ownership", async () => {
    const original = await ready()
    expect(original).toMatchObject({
      displayScale: 125,
      offsetX: 0,
      offsetY: 0,
    })
    await ownership(original, "PUT")
    await equip(original)
    const alignment = { displayScale: 140, offsetX: -6, offsetY: 3 }
    const path = `/v1/admin/avatar-frames/${original.id}`
    expect(
      (
        await request(reader, path, "PATCH", {
          ...alignment,
          expectedVersion: original.version,
        })
      ).status
    ).toBe(403)
    expect((await update(original, { offsetX: -51 })).status).toBe(400)
    const [before] = await runtime.database
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, original.id))
    const objectCount = objects.size
    const response = await update(original, alignment)
    expect(response.status).toBe(200)
    const adjusted = ((await response.json()) as { data: Frame }).data
    expect(adjusted).toMatchObject({
      ...alignment,
      version: original.version + 1,
      frame: alignment,
    })
    expect((await update(original, alignment)).status).toBe(409)
    const [after] = await runtime.database
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, original.id))
    expect(after).toEqual({
      ...before!,
      ...alignment,
      version: original.version + 1,
      updatedAt: after!.updatedAt,
    })
    expect(objects.size).toBe(objectCount)
    for (const target of ["/v1/me", `/v1/profiles/${reader.id}`]) {
      const result = (await (await request(reader, target)).json()) as {
        user?: { avatarFrame: unknown }
        avatarFrame?: unknown
      }
      expect(result.user?.avatarFrame ?? result.avatarFrame).toMatchObject({
        id: original.id,
        ...alignment,
      })
    }
    const inventory = (await (
      await request(reader, "/v1/me/avatar-frames?limit=100")
    ).json()) as { data: Array<{ frame: { id: string } }> }
    expect(
      inventory.data.find((row) => row.frame.id === original.id)?.frame
    ).toMatchObject(alignment)
    const [record] = await runtime.database
      .select()
      .from(moderationAction)
      .where(
        and(
          eq(moderationAction.targetId, original.id),
          eq(moderationAction.action, "avatar_frame.updated")
        )
      )
      .orderBy(sql`${moderationAction.createdAt} DESC`)
      .limit(1)
    expect(record?.before).toMatchObject({
      displayScale: 125,
      offsetX: 0,
      offsetY: 0,
    })
    expect(record?.after).toMatchObject(alignment)
    let rejected = false
    try {
      await runtime.database.execute(
        sql`UPDATE avatar_frame SET display_scale = 201 WHERE id = ${original.id}`
      )
    } catch (error) {
      rejected =
        (error as { cause?: { code?: string } }).cause?.code === "23514"
    }
    expect(rejected).toBe(true)
    expect(
      (
        await runtime.database
          .select()
          .from(avatarFrame)
          .where(eq(avatarFrame.id, original.id))
      )[0]?.displayScale
    ).toBe(140)
    expect((await upload(adjusted)).status).toBe(200)
    const [replaced] = await runtime.database
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, original.id))
    expect(replaced).toMatchObject(alignment)
  })
  test("keeps animated bytes/timing, immutable replacements, storage failure and audit rollback preserve canonical", async () => {
    const png = await image()
    const animated = await sharp(
      [png, await sharp(png).negate({ alpha: false }).png().toBuffer()],
      { join: { animated: true } }
    )
      .webp({ lossless: true, loop: 3, delay: [40, 90] })
      .toBuffer()
    const row = await ready("SR", false, animated)
    const originalKey = key(row.frame!.assetUrl)
    expect(row.frame?.animated).toBe(true)
    expect(Buffer.from(objects.get(originalKey)!).equals(animated)).toBe(true)
    const metadata = await sharp(objects.get(originalKey)!, {
      animated: true,
    }).metadata()
    expect(metadata.pages).toBe(2)
    expect(metadata.delay).toEqual([40, 90])
    expect(metadata.loop).toBe(3)
    expect(
      (await sharp(objects.get(key(row.frame!.previewUrl))!).metadata())
        .pages ?? 1
    ).toBe(1)
    const objectsBefore = objects.size
    failStorage = true
    try {
      expect((await upload(row)).status).toBe(503)
    } finally {
      failStorage = false
    }
    expect(objects.size).toBe(objectsBefore)
    expect(
      (
        await runtime.database
          .select()
          .from(avatarFrame)
          .where(eq(avatarFrame.id, row.id))
      )[0]?.assetKey
    ).toBe(originalKey)
    const replacements = await Promise.all([
      upload(row, animated),
      upload(row, animated),
    ])
    expect(replacements.map((r) => r.status).sort()).toEqual([200, 409])
    const success = replacements.find((r) => r.status === 200)!
    const replacement = ((await success.json()) as { data: Frame }).data
    expect(replacement.frame!.assetUrl).not.toBe(row.frame!.assetUrl)
    expect(objects.has(originalKey)).toBe(true)
    expect(objects.size).toBe(objectsBefore + 2)
    const beforeLostAck = objects.size
    const databaseWithLostAck = new Proxy(runtime.database, {
      get(target, property, receiver) {
        if (property !== "transaction")
          return Reflect.get(target, property, receiver)
        return async (...args: Parameters<typeof target.transaction>) => {
          const committed = (await target.transaction(...args)) as {
            version: number
          }
          // Commit happened, but a newer upload wins before its acknowledgement
          // reaches the caller. Neither previously published key may be removed.
          const newer = await upload(
            { ...replacement, version: committed.version },
            animated
          )
          expect(newer.status).toBe(200)
          throw new Error("Test commit acknowledgement lost")
        }
      },
    })
    const lostAckApp = createApp({
      account: { database: databaseWithLostAck },
      auth: runtime.auth,
      avatarFramesEnabled: true,
      coverStorage: storage,
      catalog: {
        assetBaseUrl,
        cache: runtime.cache,
        database: databaseWithLostAck,
      },
      webOrigin: origin,
      logger: () => undefined,
    })
    const lostAckForm = new FormData()
    lostAckForm.set("expectedVersion", String(replacement.version))
    lostAckForm.set("file", new Blob([animated]), "frame.webp")
    expect(
      (
        await request(
          admin,
          `/v1/admin/avatar-frames/${row.id}/asset`,
          "POST",
          lostAckForm,
          origin,
          lostAckApp
        )
      ).status
    ).toBe(503)
    expect(objects.size).toBe(beforeLostAck + 4)
    const [latest] = await runtime.database
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, row.id))
    replacement.version = latest!.version
    replacement.frame!.assetUrl = new URL(latest!.assetKey!, assetBaseUrl).href
    // Inject audit failure only for these test transactions, then always remove it.
    await runtime.database.execute(
      sql`CREATE FUNCTION frames_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_kind::text = 'avatar_frame' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`
    )
    await runtime.database.execute(
      sql`CREATE TRIGGER frames_test_audit_failure BEFORE INSERT ON moderation_action FOR EACH ROW EXECUTE FUNCTION frames_test_audit_failure()`
    )
    try {
      expect((await ownership(replacement, "PUT")).status).toBe(500)
      const [ownershipRow] = await runtime.database
        .select()
        .from(userAvatarFrame)
        .where(
          and(
            eq(userAvatarFrame.userId, reader.id),
            eq(userAvatarFrame.frameId, row.id)
          )
        )
      expect(ownershipRow).toBeUndefined()
      const countBefore = objects.size
      expect((await upload(replacement, animated)).status).toBe(503)
      expect(objects.size).toBe(countBefore)
      expect(
        (
          await runtime.database
            .select()
            .from(avatarFrame)
            .where(eq(avatarFrame.id, row.id))
        )[0]?.assetKey
      ).toBe(key(replacement.frame!.assetUrl))
    } finally {
      await runtime.database.execute(
        sql`DROP TRIGGER frames_test_audit_failure ON moderation_action`
      )
      await runtime.database.execute(
        sql`DROP FUNCTION frames_test_audit_failure()`
      )
    }
    expect(
      createHash("sha256")
        .update(objects.get(key(replacement.frame!.assetUrl))!)
        .digest("hex")
    ).toBe(createHash("sha256").update(animated).digest("hex"))
    let invalidDraftRejected = false
    try {
      await runtime.database
        .insert(avatarFrame)
        .values({
          code: `invalid-${randomUUID()}`,
          name: "Bad draft",
          rarity: "R",
          active: true,
        })
        .execute()
    } catch {
      invalidDraftRejected = true
    }
    expect(invalidDraftRejected).toBe(true)
  })
  test("manages topics and descriptions with guards, versions and deletion preserving frames/ownership", async () => {
    const base = "/v1/admin/avatar-frame-topics"
    expect((await request(null, base)).status).toBe(401)
    expect(
      (await request(reader, base, "POST", { name: "Denied" })).status
    ).toBe(403)
    expect(
      (
        await request(
          admin,
          base,
          "POST",
          { name: "Denied" },
          "https://other.example"
        )
      ).status
    ).toBe(403)
    const created = await request(admin, base, "POST", {
      name: " Genshin Impact ",
    })
    expect(created.status).toBe(201)
    expect(created.headers.get("cache-control")).toBe("private, no-store")
    const topic = (
      (await created.json()) as {
        data: { id: string; version: number; name: string }
      }
    ).data
    topicIds.push(topic.id)
    expect(topic.name).toBe("Genshin Impact")
    expect(
      (await request(admin, base, "POST", { name: "genshin impact" })).status
    ).toBe(409)
    expect(
      (
        await request(admin, `${base}/${topic.id}`, "PATCH", {
          name: "Bad",
          expectedVersion: 5,
        })
      ).status
    ).toBe(409)
    expect(
      (
        await request(admin, `${base}/${topic.id}`, "PATCH", {
          name: "HoYoLAB",
          expectedVersion: topic.version,
        })
      ).status
    ).toBe(200)

    const withTopic = await request(admin, "/v1/admin/avatar-frames", "POST", {
      code: `topic-${randomUUID()}`,
      name: "Topic draft",
      description: " Mô tả nhiều dòng\nDòng 2 ",
      topicId: topic.id,
      rarity: "R",
    })
    expect(withTopic.status).toBe(201)
    const draft = (
      (await withTopic.json()) as {
        data: Frame & { description: string; topicId: string | null }
      }
    ).data
    frameIds.push(draft.id)
    expect(draft.description).toBe("Mô tả nhiều dòng\nDòng 2")
    expect(draft.topicId).toBe(topic.id)
    const list = await request(
      admin,
      `/v1/admin/avatar-frames?topicId=${topic.id}`
    )
    expect(
      ((await list.json()) as { data: Frame[] }).data.map((row) => row.id)
    ).toEqual([draft.id])
    expect(
      (await update(draft, { description: "a".repeat(2001) })).status
    ).toBe(400)
    expect((await update(draft, { topicId: randomUUID() })).status).toBe(404)
    const cleared = await update(draft, { description: "", topicId: null })
    expect(cleared.status).toBe(200)
    const clearData = (
      (await cleared.json()) as {
        data: { description: string; topicId: string | null }
      }
    ).data
    expect(clearData).toMatchObject({ description: "", topicId: null })

    const active = await ready()
    const assigned = await update(active, {
      description: "Keep this",
      topicId: topic.id,
    })
    const attached = ((await assigned.json()) as { data: Frame }).data
    await ownership(attached, "PUT")
    await equip(attached)
    for (const [actor, path] of [
      [reader, "/v1/me/avatar-frames"],
      [admin, `/v1/admin/users/${reader.id}/avatar-frames`],
    ] as const) {
      const response = await request(actor, path)
      expect(response.status).toBe(200)
      const inventory = (await response.json()) as {
        data: Array<{
          frame: { id: string }
          topic: { id: string; name: string } | null
        }>
      }
      expect(
        inventory.data.find((item) => item.frame.id === active.id)?.topic
      ).toEqual({ id: topic.id, name: "HoYoLAB" })
    }
    const [before] = await runtime.database
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, active.id))
    const topics = await request(admin, base)
    expect(
      (
        (await topics.json()) as {
          data: Array<{ id: string; name: string; frameCount: number }>
        }
      ).data.find((row) => row.id === topic.id)
    ).toMatchObject({ name: "HoYoLAB", frameCount: 1 })
    expect(
      (
        await request(reader, `${base}/${topic.id}`, "DELETE", {
          expectedVersion: 2,
        })
      ).status
    ).toBe(403)
    expect(
      (
        await request(admin, `${base}/${topic.id}`, "DELETE", {
          expectedVersion: 1,
        })
      ).status
    ).toBe(409)
    expect(
      (
        await request(admin, `${base}/${topic.id}`, "DELETE", {
          expectedVersion: 2,
        })
      ).status
    ).toBe(200)
    const [after] = await runtime.database
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, active.id))
    expect(after).toMatchObject({
      description: "Keep this",
      topicId: null,
      version: before!.version + 1,
      active: true,
      assetKey: before!.assetKey,
      sha256: before!.sha256,
    })
    const [owner] = await runtime.database
      .select()
      .from(userAvatarFrame)
      .where(
        and(
          eq(userAvatarFrame.userId, reader.id),
          eq(userAvatarFrame.frameId, active.id)
        )
      )
    expect(owner?.revokedAt).toBeNull()
    const [profile] = await runtime.database
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, reader.id))
    expect(profile?.avatarFrameId).toBe(active.id)
    for (const [actor, path] of [
      [reader, "/v1/me/avatar-frames"],
      [admin, `/v1/admin/users/${reader.id}/avatar-frames`],
    ] as const) {
      const inventory = (await (await request(actor, path)).json()) as {
        data: Array<{ frame: { id: string }; topic: unknown }>
      }
      expect(
        inventory.data.find((item) => item.frame.id === active.id)?.topic
      ).toBeNull()
    }
    expect((await update(attached, { name: "Stale editor" })).status).toBe(409)
    const uncategorized = await request(
      admin,
      "/v1/admin/avatar-frames?topicId=none"
    )
    expect(
      ((await uncategorized.json()) as { data: Frame[] }).data.some(
        (row) => row.id === active.id
      )
    ).toBe(true)
    expect((await request(admin, base, "POST", { name: " " })).status).toBe(400)
    const audits = await runtime.database
      .select()
      .from(moderationAction)
      .where(
        and(
          eq(moderationAction.targetKind, "avatar_frame_topic"),
          eq(moderationAction.targetId, topic.id)
        )
      )
    expect(audits.map((row) => row.action).sort()).toEqual([
      "avatar_frame_topic.created",
      "avatar_frame_topic.deleted",
      "avatar_frame_topic.updated",
    ])
  })
})
