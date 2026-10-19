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

import { createApp } from "../../src/app"
import {
  manga,
  mangaTag,
  moderationAction,
  organization,
  tag,
  user,
} from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)

const origin = "http://localhost:3000"
const mangaId = randomUUID()
const ownerGroupId = randomUUID()
const accounts: Array<{ id: string; cookie: string }> = []
const tagIds: string[] = []
let runtime: Runtime
let app: ReturnType<typeof createApp>
let admin: (typeof accounts)[number]
let member: (typeof accounts)[number]

async function account(name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `phase9b-tags-${randomUUID()}@example.com`,
      name,
      password: "phase9b-tags-fixture-password",
    }),
  })
  expect(response.status).toBe(200)
  const value = {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
  accounts.push(value)
  return value
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

describe.serial("Phase 9B.1 tag moderation", () => {
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

    admin = await account("Phase 9B tags admin")
    member = await account("Phase 9B tags member")
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, admin.id))
    await runtime.database.insert(organization).values({
      id: ownerGroupId,
      name: "Phase 9B tags owner group",
      slug: `phase-9b-tags-owner-${randomUUID()}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(manga).values({
      ownerGroupId,
      id: mangaId,
      slug: `phase-9b-tags-${randomUUID()}`,
      title: "Phase 9B tags manga",
      searchTitle: "phase 9b tags manga",
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      publicationState: "published",
      publishedAt: new Date(),
    })
  })

  afterAll(async () => {
    if (!runtime) return
    if (tagIds.length) {
      await runtime.database
        .delete(moderationAction)
        .where(inArray(moderationAction.targetId, tagIds))
      await runtime.database.delete(tag).where(inArray(tag.id, tagIds))
    }
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

  test("protects admin tag routes", async () => {
    const guest = await request(undefined, "/v1/admin/tags")
    expect(guest.status).toBe(401)
    expect(guest.headers.get("cache-control")).toBe("private, no-store")
    expect((await request(member, "/v1/admin/tags")).status).toBe(403)
    expect(
      (
        await request(
          admin,
          "/v1/admin/tags",
          "POST",
          { name: "Blocked", group: "theme" },
          "https://example.invalid"
        )
      ).status
    ).toBe(403)
  })

  test("creates, edits, hides and restores a tag without losing manga relations", async () => {
    const createdResponse = await request(admin, "/v1/admin/tags", "POST", {
      name: "  Kiểm   thử  ",
      group: "theme",
    })
    expect(createdResponse.status).toBe(201)
    const created = (await createdResponse.json()) as {
      data: {
        id: string
        name: string
        slug: string
        version: number
        moderationHiddenAt: string | null
        mangaCount: number
      }
    }
    tagIds.push(created.data.id)
    expect(created.data).toMatchObject({
      name: "Kiểm thử",
      slug: "kiem-thu",
      version: 1,
      moderationHiddenAt: null,
      mangaCount: 0,
    })

    const collisionResponse = await request(admin, "/v1/admin/tags", "POST", {
      name: "Kiểm thử",
      group: "genre",
    })
    expect(collisionResponse.status).toBe(201)
    const collision = (await collisionResponse.json()) as {
      data: { id: string; slug: string }
    }
    tagIds.push(collision.data.id)
    expect(collision.data.slug).toBe("kiem-thu-2")

    const fallbackResponse = await request(admin, "/v1/admin/tags", "POST", {
      name: "🔥🔥",
      group: "format",
    })
    expect(fallbackResponse.status).toBe(201)
    const fallback = (await fallbackResponse.json()) as {
      data: { id: string; slug: string }
    }
    tagIds.push(fallback.data.id)
    expect(fallback.data.slug).toMatch(/^tag-[0-9a-f]{8}$/)

    const duplicateSlug = await request(admin, "/v1/admin/tags", "POST", {
      name: "Slug trùng",
      slug: created.data.slug,
      group: "content",
    })
    expect(duplicateSlug.status).toBe(409)
    expect(await duplicateSlug.json()).toMatchObject({
      error: { code: "TAG_SLUG_CONFLICT" },
    })

    const duplicate = await request(admin, "/v1/admin/tags", "POST", {
      name: "KIỂM THỬ",
      slug: `other-${randomUUID()}`,
      group: "theme",
    })
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toMatchObject({
      error: { code: "TAG_NAME_CONFLICT" },
    })

    await runtime.database.insert(mangaTag).values({
      mangaId,
      tagId: created.data.id,
    })
    const list = await request(admin, "/v1/admin/tags?group=theme&q=kiem-thu")
    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject({
      data: [{ id: created.data.id, mangaCount: 1 }],
    })
    expect(
      (await request(undefined, `/v1/tags/${created.data.id}`)).status
    ).toBe(200)

    await runtime.database.execute(
      sql.raw(`
        create or replace function phase9b_tags_reject_audit() returns trigger as $$
        begin
          if new.reason = 'Tag hidden' then
            raise exception 'forced audit failure';
          end if;
          return new;
        end;
        $$ language plpgsql;
        drop trigger if exists phase9b_tags_reject_audit on moderation_action;
        create trigger phase9b_tags_reject_audit before insert on moderation_action
        for each row execute function phase9b_tags_reject_audit();
      `)
    )
    try {
      expect(
        (
          await request(
            admin,
            `/v1/admin/tags/${created.data.id}/visibility`,
            "PUT",
            { hidden: true, expectedVersion: 1 }
          )
        ).status
      ).toBe(500)
      expect(
        await runtime.database
          .select({
            version: tag.version,
            moderationHiddenAt: tag.moderationHiddenAt,
          })
          .from(tag)
          .where(eq(tag.id, created.data.id))
      ).toEqual([{ version: 1, moderationHiddenAt: null }])
    } finally {
      await runtime.database.execute(
        sql.raw(`
          drop trigger if exists phase9b_tags_reject_audit on moderation_action;
          drop function if exists phase9b_tags_reject_audit();
        `)
      )
    }

    const hidden = await request(
      admin,
      `/v1/admin/tags/${created.data.id}/visibility`,
      "PUT",
      { hidden: true, expectedVersion: 1 }
    )
    expect(hidden.status).toBe(200)
    expect(await hidden.json()).toMatchObject({
      data: {
        id: created.data.id,
        version: 2,
        moderationHiddenAt: expect.any(String),
        mangaCount: 1,
      },
    })
    expect(
      (await request(undefined, `/v1/tags/${created.data.id}`)).status
    ).toBe(404)
    const publicTags = (await (
      await request(undefined, "/v1/tags")
    ).json()) as { data: Array<{ id: string }> }
    expect(publicTags.data.map(({ id }) => id)).not.toContain(created.data.id)
    const filteredManga = (await (
      await request(
        undefined,
        `/v1/manga?hasChapter=false&includeTag=${created.data.id}`
      )
    ).json()) as { data: Array<{ id: string }> }
    expect(filteredManga.data.map(({ id }) => id)).not.toContain(mangaId)

    const adminDetail = (await (
      await request(admin, `/v1/admin/manga/${mangaId}`)
    ).json()) as { data: { tagIds: string[]; version: number } }
    expect(adminDetail.data.tagIds).toEqual([])
    const mangaUpdate = await request(
      admin,
      `/v1/admin/manga/${mangaId}`,
      "PUT",
      {
        title: "Phase 9B tags manga",
        slug: `phase-9b-tags-${mangaId}`,
        alternativeTitles: [],
        description: null,
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
        expectedVersion: adminDetail.data.version,
      }
    )
    expect(mangaUpdate.status).toBe(200)
    expect(
      await runtime.database
        .select()
        .from(mangaTag)
        .where(
          and(
            eq(mangaTag.mangaId, mangaId),
            eq(mangaTag.tagId, created.data.id)
          )
        )
    ).toHaveLength(1)

    const restored = await request(
      admin,
      `/v1/admin/tags/${created.data.id}/visibility`,
      "PUT",
      { hidden: false, expectedVersion: 2 }
    )
    expect(restored.status).toBe(200)
    expect(await restored.json()).toMatchObject({
      data: { version: 3, moderationHiddenAt: null, mangaCount: 1 },
    })
    expect(
      (await request(undefined, `/v1/tags/${created.data.id}`)).status
    ).toBe(200)

    const updated = await request(
      admin,
      `/v1/admin/tags/${created.data.id}`,
      "PUT",
      {
        name: "Kiểm thử cập nhật",
        slug: "kiem-thu-cap-nhat",
        group: "content",
        expectedVersion: 3,
      }
    )
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      data: {
        name: "Kiểm thử cập nhật",
        slug: "kiem-thu-cap-nhat",
        group: "content",
        version: 4,
      },
    })
    expect(
      (
        await request(admin, `/v1/admin/tags/${created.data.id}`, "PUT", {
          name: "Stale",
          slug: "stale",
          group: "content",
          expectedVersion: 3,
        })
      ).status
    ).toBe(409)

    const audits = await runtime.database
      .select({ action: moderationAction.action })
      .from(moderationAction)
      .where(
        and(
          eq(moderationAction.targetKind, "tag"),
          eq(moderationAction.targetId, created.data.id)
        )
      )
    expect(audits.map(({ action }) => action).sort()).toEqual([
      "taxonomy.tag.created",
      "taxonomy.tag.hidden",
      "taxonomy.tag.restored",
      "taxonomy.tag.updated",
    ])
  })
})
