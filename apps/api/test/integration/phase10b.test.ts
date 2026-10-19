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
import { eq, inArray } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import sharp from "sharp"

import { createApp } from "../../src/app"
import {
  member,
  organization,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
} from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { MediaStorage } from "../../src/shared/storage"

setDefaultTimeout(120_000)
const origin = "http://localhost:3000"
const assetBaseUrl = "https://assets.example/profile/"
const noop = () => undefined
const groupId = randomUUID()
const accounts: Array<{ id: string; cookie: string }> = []
const objects = new Map<string, Uint8Array>()
const storage: MediaStorage = {
  async put(key, body) {
    objects.set(key, Uint8Array.from(body))
  },
  async head(key) {
    return {
      cacheControl: "public, max-age=31536000, immutable",
      contentLength: objects.get(key)?.byteLength,
      contentType: "image/webp",
    }
  },
  async delete(key) {
    objects.delete(key)
  },
}

let runtime: Runtime
let app: ReturnType<typeof createApp>
let leader: (typeof accounts)[number]
let memberAccount: (typeof accounts)[number]
let admin: (typeof accounts)[number]

async function signUp() {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      email: `phase10b-${randomUUID()}@example.com`,
      name: "Phase 10B user",
      password: "phase10b-integration-password",
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
  actor: (typeof accounts)[number],
  path: string,
  method: string,
  body?: BodyInit,
  contentType?: string
) {
  return app.request(path, {
    method,
    headers: {
      Cookie: actor.cookie,
      Origin: origin,
      ...(contentType ? { "Content-Type": contentType } : {}),
    },
    body,
  })
}

async function image() {
  return sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: { r: 40, g: 160, b: 220 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
}

async function upload(
  actor: (typeof accounts)[number],
  path: string,
  field: "avatar" | "image" = "image"
) {
  const form = new FormData()
  form.set(
    field,
    new Blob([await image()], { type: "image/jpeg" }),
    "image.jpg"
  )
  return request(actor, path, "POST", form)
}

function storageKey(url: string) {
  return decodeURIComponent(
    new URL(url).pathname.slice(new URL(assetBaseUrl).pathname.length)
  )
}

describe.serial("Phase 10B profile and group media", () => {
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
      }),
      noop
    )
    await migrate(runtime.database, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      catalog: {
        assetBaseUrl,
        cache: runtime.cache,
        database: runtime.database,
      },
      coverStorage: storage,
      logger: noop,
      webOrigin: origin,
    })
    leader = await signUp()
    memberAccount = await signUp()
    admin = await signUp()
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, admin.id))

    await runtime.database.insert(organization).values({
      id: groupId,
      name: "Phase 10B group",
      slug: `phase-10b-${groupId}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: groupId,
      approvalStatus: "approved",
      publicationState: "published",
      createdByUserId: leader.id,
    })
    const leaderMemberId = randomUUID()
    const regularMemberId = randomUUID()
    await runtime.database.insert(member).values([
      {
        id: leaderMemberId,
        organizationId: groupId,
        userId: leader.id,
        role: "owner",
        createdAt: new Date(),
      },
      {
        id: regularMemberId,
        organizationId: groupId,
        userId: memberAccount.id,
        role: "member",
        createdAt: new Date(),
      },
    ])
    await runtime.database
      .insert(translationGroupMemberProfile)
      .values([{ memberId: leaderMemberId }, { memberId: regularMemberId }])
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, groupId))
    await runtime.database.delete(user).where(
      inArray(
        user.id,
        accounts.map(({ id }) => id)
      )
    )
    await runtime.close()
  })

  test("normalizes display names and rejects direct avatar URLs", async () => {
    const updated = await request(
      leader,
      "/api/auth/update-user",
      "POST",
      JSON.stringify({ name: "  Tên   hiển thị  " }),
      "application/json"
    )
    expect(updated.status).toBe(200)
    const [identity] = await runtime.database
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, leader.id))
    expect(identity?.name).toBe("Tên hiển thị")

    const imageUpdate = await request(
      leader,
      "/api/auth/update-user",
      "POST",
      JSON.stringify({ image: "https://tracker.example/avatar.png" }),
      "application/json"
    )
    expect(imageUpdate.status).toBe(400)
  })

  test("uploads, replaces and removes the authenticated user's avatar", async () => {
    const first = await upload(leader, "/v1/me/avatar", "avatar")
    expect(first.status).toBe(200)
    const firstUrl = ((await first.json()) as { user: { image: string } }).user
      .image
    const firstKey = storageKey(firstUrl)
    expect(firstKey).toMatch(
      new RegExp(`^users/${leader.id}/avatars/[0-9a-f-]+\\.webp$`, "i")
    )
    expect(await sharp(objects.get(firstKey)).metadata()).toMatchObject({
      format: "webp",
      width: 512,
      height: 512,
    })

    const second = await upload(leader, "/v1/me/avatar", "avatar")
    expect(second.status).toBe(200)
    const secondUrl = ((await second.json()) as { user: { image: string } })
      .user.image
    const secondKey = storageKey(secondUrl)
    expect(secondKey).not.toBe(firstKey)
    expect(objects.has(firstKey)).toBe(false)
    expect(objects.has(secondKey)).toBe(true)

    const removed = await request(leader, "/v1/me/avatar", "DELETE")
    expect(removed.status).toBe(200)
    expect((await removed.json()) as { user: { image: null } }).toMatchObject({
      user: { image: null },
    })
    expect(objects.has(secondKey)).toBe(false)
  })

  test("gates group media and exposes it through management and public DTOs", async () => {
    expect(
      (await upload(memberAccount, `/v1/contribution/groups/${groupId}/avatar`))
        .status
    ).toBe(403)

    const avatar = await upload(
      leader,
      `/v1/contribution/groups/${groupId}/avatar`
    )
    expect(avatar.status).toBe(200)
    const avatarUrl = ((await avatar.json()) as { data: { avatarUrl: string } })
      .data.avatarUrl

    const banner = await upload(
      admin,
      `/v1/contribution/groups/${groupId}/banner`
    )
    expect(banner.status).toBe(200)
    const bannerUrl = ((await banner.json()) as { data: { bannerUrl: string } })
      .data.bannerUrl
    expect(
      await sharp(objects.get(storageKey(bannerUrl))).metadata()
    ).toMatchObject({ width: 1500, height: 500, format: "webp" })

    const publicGroup = await app.request(`/v1/groups/${groupId}`)
    expect(publicGroup.status).toBe(200)
    expect(await publicGroup.json()).toMatchObject({ avatarUrl, bannerUrl })

    const removedAvatar = await request(
      leader,
      `/v1/contribution/groups/${groupId}/avatar`,
      "DELETE"
    )
    expect(removedAvatar.status).toBe(200)
    expect(await removedAvatar.json()).toMatchObject({
      data: { avatarUrl: null, bannerUrl },
    })
    expect(objects.has(storageKey(avatarUrl))).toBe(false)
  })
})
