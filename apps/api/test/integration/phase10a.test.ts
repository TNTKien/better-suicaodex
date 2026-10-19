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
import { and, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  chapter,
  chapterGroup,
  chapterUploadSession,
  manga,
  mangaGroup,
  member,
  notification,
  organization,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
} from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"
import type { ChapterStorage } from "../../src/shared/storage"

const origin = "http://localhost:3000"
setDefaultTimeout(120_000)
const noop = () => undefined
const ownerGroupId = randomUUID()
const partnerGroupId = randomUUID()
const storage: ChapterStorage = {
  async copyToPublic() {},
  async delete() {},
  async deletePublic() {},
  async head() {
    return {}
  },
  async headPublic() {
    return {}
  },
  async previewUrl() {
    return ""
  },
  async put() {},
}
let runtime: Runtime
let app: ReturnType<typeof createApp>
let owner: { id: string; cookie: string }
let partner: { id: string; cookie: string }
let mangaId: string
let chapterId: string
let systemGroupId: string

async function account(name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      email: `${name.toLowerCase().replaceAll(" ", "-")}-${randomUUID()}@example.com`,
      name,
      password: "phase10a-fixture-password",
    }),
  })
  expect(response.status).toBe(200)
  return {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
}

function request(cookie: string, path: string, method = "GET", body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const mangaInput = {
  title: "Phase 10A ownership",
  alternativeTitles: [],
  description: null,
  originalLanguage: "ja",
  publicationDemographic: null,
  status: "ongoing" as const,
  contentRating: "safe" as const,
  year: null,
  lastVolume: null,
  lastChapter: null,
  links: {},
  tagIds: [],
  authorIds: [],
  artistIds: [],
}

describe.serial("Phase 10A content ownership", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    runtime = await createRuntime(
      parseRuntimeEnv({
        ...process.env,
        NODE_ENV: "test",
        WEB_ORIGIN: origin,
        DATABASE_URL: url,
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
        database: runtime.database,
        cache: runtime.cache,
        assetBaseUrl: "http://localhost:9000/",
      },
      chapterStorage: storage,
      logger: noop,
      webOrigin: origin,
    })
    owner = await account("Phase 10A owner")
    partner = await account("Phase 10A partner")

    const [existingSystem] = await runtime.database
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, "system"))
      .limit(1)
    systemGroupId = existingSystem?.id ?? randomUUID()
    if (!existingSystem) {
      await runtime.database.insert(organization).values({
        id: systemGroupId,
        name: "System",
        slug: "system",
        createdAt: new Date(),
      })
      await runtime.database.insert(translationGroupProfile).values({
        organizationId: systemGroupId,
        approvalStatus: "approved",
        publicationState: "published",
      })
    }

    for (const [id, name, slug, userId] of [
      [ownerGroupId, "Phase 10A owner group", "phase-10a-owner", owner.id],
      [
        partnerGroupId,
        "Phase 10A partner group",
        "phase-10a-partner",
        partner.id,
      ],
    ] as const) {
      await runtime.database.insert(organization).values({
        id,
        name,
        slug: `${slug}-${randomUUID()}`,
        createdAt: new Date(),
      })
      await runtime.database.insert(translationGroupProfile).values({
        organizationId: id,
        approvalStatus: "approved",
        publicationState: "published",
        createdByUserId: userId,
      })
      const memberId = randomUUID()
      await runtime.database.insert(member).values({
        id: memberId,
        organizationId: id,
        userId,
        role: "owner",
        createdAt: new Date(),
      })
      await runtime.database
        .insert(translationGroupMemberProfile)
        .values({ memberId })
    }
  })

  afterAll(async () => {
    if (!runtime) return
    if (mangaId)
      await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, partnerGroupId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, ownerGroupId))
    if (owner) await runtime.database.delete(user).where(eq(user.id, owner.id))
    if (partner)
      await runtime.database.delete(user).where(eq(user.id, partner.id))
    await runtime.close()
  })

  test("separates ownership from manga and chapter collaboration", async () => {
    const ownerRoot = `/v1/contribution/groups/${ownerGroupId}/manga`
    expect(
      (
        await request(owner.cookie, ownerRoot, "POST", {
          ...mangaInput,
          title: "Invalid System collaboration",
          groupIds: [systemGroupId],
        })
      ).status
    ).toBe(403)

    const created = await request(owner.cookie, ownerRoot, "POST", {
      ...mangaInput,
      groupIds: [partnerGroupId],
    })
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as {
      data: { id: string; slug: string; ownerGroupId: string; isOwner: boolean }
    }
    mangaId = createdBody.data.id
    expect(createdBody.data).toMatchObject({
      ownerGroupId,
      isOwner: true,
    })
    expect(
      await runtime.database
        .select({ groupId: mangaGroup.groupId })
        .from(mangaGroup)
        .where(eq(mangaGroup.mangaId, mangaId))
    ).toHaveLength(2)

    const partnerRoot = `/v1/contribution/groups/${partnerGroupId}/manga`
    const partnerDetail = await request(
      partner.cookie,
      `${partnerRoot}/${mangaId}`
    )
    expect(partnerDetail.status).toBe(200)
    expect((await partnerDetail.json()) as unknown).toMatchObject({
      data: { ownerGroupId, isOwner: false },
    })
    const updated = await request(
      partner.cookie,
      `${partnerRoot}/${mangaId}`,
      "PUT",
      {
        ...mangaInput,
        title: "Phase 10A updated by partner",
        slug: createdBody.data.slug,
        expectedVersion: 1,
      }
    )
    expect(updated.status).toBe(200)
    expect(
      (
        await request(
          partner.cookie,
          `${partnerRoot}/${mangaId}/visibility`,
          "POST",
          { hidden: true, expectedVersion: 2 }
        )
      ).status
    ).toBe(403)
    expect(
      (
        await request(partner.cookie, `${partnerRoot}/${mangaId}`, "DELETE", {
          expectedVersion: 2,
        })
      ).status
    ).toBe(403)

    const chapterCreated = await request(
      owner.cookie,
      `${ownerRoot}/${mangaId}/chapters`,
      "POST",
      {
        number: "1",
        volumeNumber: null,
        title: "Ownership",
        language: "vi",
        groupIds: [partnerGroupId],
      }
    )
    expect(chapterCreated.status).toBe(201)
    chapterId = ((await chapterCreated.json()) as { data: { id: string } }).data
      .id
    expect(
      await runtime.database
        .select({ groupId: chapterGroup.groupId })
        .from(chapterGroup)
        .where(eq(chapterGroup.chapterId, chapterId))
    ).toHaveLength(2)

    const partnerChapterRoot = `${partnerRoot}/${mangaId}/chapters`
    expect(
      (
        await request(
          partner.cookie,
          `${partnerChapterRoot}/${chapterId}`,
          "PUT",
          {
            number: "1",
            volumeNumber: null,
            title: "Updated by partner",
            language: "vi",
            expectedVersion: 1,
          }
        )
      ).status
    ).toBe(200)
    expect(
      (
        await request(
          partner.cookie,
          `${partnerChapterRoot}/${chapterId}`,
          "DELETE",
          { expectedVersion: 2 }
        )
      ).status
    ).toBe(403)

    const ownerOnlyChapter = await request(
      owner.cookie,
      `${ownerRoot}/${mangaId}/chapters`,
      "POST",
      {
        number: "2",
        volumeNumber: null,
        title: "Owner only",
        language: "vi",
        groupIds: [],
      }
    )
    expect(ownerOnlyChapter.status).toBe(201)
    const ownerOnlyChapterId = (
      (await ownerOnlyChapter.json()) as { data: { id: string } }
    ).data.id
    expect(
      (
        await request(
          partner.cookie,
          `${partnerChapterRoot}/${ownerOnlyChapterId}`,
          "PUT",
          {
            number: "2",
            volumeNumber: null,
            title: "Must remain inaccessible",
            language: "vi",
            expectedVersion: 1,
          }
        )
      ).status
    ).toBe(404)

    expect(
      await runtime.database
        .select({ type: notification.type })
        .from(notification)
        .where(
          and(
            eq(notification.userId, partner.id),
            eq(notification.type, "content_group_added")
          )
        )
    ).toHaveLength(2)

    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, owner.id))
    const transferred = await request(
      owner.cookie,
      `/v1/admin/manga/${mangaId}/owner`,
      "PUT",
      {
        ownerGroupId: partnerGroupId,
        expectedVersion: 2,
        addTargetGroupToChapters: true,
      }
    )
    expect(transferred.status).toBe(200)
    expect((await transferred.json()) as unknown).toMatchObject({
      data: { ownerGroupId: partnerGroupId, version: 3 },
    })
    expect(
      await runtime.database
        .select({ groupId: mangaGroup.groupId })
        .from(mangaGroup)
        .where(eq(mangaGroup.mangaId, mangaId))
    ).toEqual([{ groupId: partnerGroupId }])
    expect(
      await runtime.database
        .select({ groupId: chapterGroup.groupId })
        .from(chapterGroup)
        .where(eq(chapterGroup.chapterId, ownerOnlyChapterId))
    ).toEqual(
      expect.arrayContaining([
        { groupId: ownerGroupId },
        { groupId: partnerGroupId },
      ])
    )
    expect(
      await runtime.database
        .select({ ownerGroupId: chapter.ownerGroupId })
        .from(chapter)
        .where(eq(chapter.mangaId, mangaId))
    ).toEqual([{ ownerGroupId }, { ownerGroupId }])
    expect(
      (
        await request(
          owner.cookie,
          `/v1/admin/manga/${mangaId}/groups/${partnerGroupId}`,
          "DELETE",
          { expectedVersion: 3 }
        )
      ).status
    ).toBe(409)

    const transferredBack = await request(
      owner.cookie,
      `/v1/admin/manga/${mangaId}/owner`,
      "PUT",
      { ownerGroupId, expectedVersion: 3 }
    )
    expect(transferredBack.status).toBe(200)
    expect((await transferredBack.json()) as unknown).toMatchObject({
      data: { ownerGroupId, version: 4 },
    })
    expect(
      new Set(
        (
          await runtime.database
            .select({ groupId: mangaGroup.groupId })
            .from(mangaGroup)
            .where(eq(mangaGroup.mangaId, mangaId))
        ).map(({ groupId }) => groupId)
      )
    ).toEqual(new Set([ownerGroupId, partnerGroupId]))

    expect(
      (
        await request(
          owner.cookie,
          `/v1/admin/manga/${mangaId}/groups/${partnerGroupId}`,
          "DELETE",
          { expectedVersion: 4 }
        )
      ).status
    ).toBe(409)

    const removedChapterGroup = await request(
      owner.cookie,
      `/v1/admin/chapters/${chapterId}/groups/${partnerGroupId}`,
      "DELETE",
      { expectedVersion: 2 }
    )
    expect(removedChapterGroup.status).toBe(200)
    expect((await removedChapterGroup.json()) as unknown).toMatchObject({
      data: { version: 3 },
    })
    const removedOwnerOnlyChapterGroup = await request(
      owner.cookie,
      `/v1/admin/chapters/${ownerOnlyChapterId}/groups/${partnerGroupId}`,
      "DELETE",
      { expectedVersion: 1 }
    )
    expect(removedOwnerOnlyChapterGroup.status).toBe(200)
    expect(
      (await removedOwnerOnlyChapterGroup.json()) as unknown
    ).toMatchObject({ data: { version: 2 } })
    expect(
      (
        await request(
          owner.cookie,
          `/v1/admin/chapters/${chapterId}/groups/${ownerGroupId}`,
          "DELETE",
          { expectedVersion: 3 }
        )
      ).status
    ).toBe(409)

    const removedMangaGroup = await request(
      owner.cookie,
      `/v1/admin/manga/${mangaId}/groups/${partnerGroupId}`,
      "DELETE",
      { expectedVersion: 4 }
    )
    expect(removedMangaGroup.status).toBe(200)
    expect((await removedMangaGroup.json()) as unknown).toMatchObject({
      data: { version: 5 },
    })
    expect(
      await runtime.database
        .select({ groupId: mangaGroup.groupId })
        .from(mangaGroup)
        .where(eq(mangaGroup.mangaId, mangaId))
    ).toEqual([{ groupId: ownerGroupId }])

    const deletedGroup = await request(
      owner.cookie,
      `/v1/admin/groups/${ownerGroupId}`,
      "DELETE"
    )
    expect(deletedGroup.status).toBe(204)
    expect(
      await runtime.database
        .select({ ownerGroupId: manga.ownerGroupId, version: manga.version })
        .from(manga)
        .where(eq(manga.id, mangaId))
    ).toEqual([{ ownerGroupId: systemGroupId, version: 6 }])
    expect(
      await runtime.database
        .select({ ownerGroupId: chapter.ownerGroupId })
        .from(chapter)
        .where(eq(chapter.mangaId, mangaId))
    ).toEqual([
      { ownerGroupId: systemGroupId },
      { ownerGroupId: systemGroupId },
    ])
    expect(
      await runtime.database
        .select({
          groupId: mangaGroup.groupId,
          isExplicit: mangaGroup.isExplicit,
        })
        .from(mangaGroup)
        .where(eq(mangaGroup.mangaId, mangaId))
    ).toEqual([{ groupId: systemGroupId, isExplicit: true }])
    expect(
      await runtime.database
        .select({
          chapterId: chapterGroup.chapterId,
          groupId: chapterGroup.groupId,
        })
        .from(chapterGroup)
        .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
        .where(eq(chapter.mangaId, mangaId))
    ).toEqual(
      expect.arrayContaining([
        { chapterId, groupId: systemGroupId },
        { chapterId: ownerOnlyChapterId, groupId: systemGroupId },
      ])
    )

    await runtime.database
      .delete(chapterGroup)
      .where(
        and(
          eq(chapterGroup.chapterId, chapterId),
          eq(chapterGroup.groupId, systemGroupId)
        )
      )

    const uploadRoot = `/v1/contribution/groups/${systemGroupId}/manga/${mangaId}/chapters/${chapterId}/uploads`
    const openedUpload = await request(owner.cookie, uploadRoot, "POST", {
      mode: "initial",
      expectedVersion: 4,
    })
    expect(openedUpload.status).toBe(200)
    const uploadSessionId = (
      (await openedUpload.json()) as { data: { id: string } }
    ).data.id
    expect(
      (await request(owner.cookie, `${uploadRoot}/${uploadSessionId}`)).status
    ).toBe(200)
    expect(
      (
        await request(owner.cookie, `/v1/admin/manga/${mangaId}/owner`, "PUT", {
          ownerGroupId: partnerGroupId,
          expectedVersion: 6,
          transferSystemChapterOwnership: true,
        })
      ).status
    ).toBe(409)
    await runtime.database
      .delete(chapterUploadSession)
      .where(eq(chapterUploadSession.id, uploadSessionId))

    const transferredFromSystem = await request(
      owner.cookie,
      `/v1/admin/manga/${mangaId}/owner`,
      "PUT",
      {
        ownerGroupId: partnerGroupId,
        expectedVersion: 6,
        transferSystemChapterOwnership: true,
      }
    )
    expect(transferredFromSystem.status).toBe(200)
    expect((await transferredFromSystem.json()) as unknown).toMatchObject({
      data: { ownerGroupId: partnerGroupId, version: 7 },
    })
    expect(
      await runtime.database
        .select({ ownerGroupId: chapter.ownerGroupId })
        .from(chapter)
        .where(eq(chapter.mangaId, mangaId))
    ).toEqual([
      { ownerGroupId: partnerGroupId },
      { ownerGroupId: partnerGroupId },
    ])
    expect(
      await runtime.database
        .select({ groupId: mangaGroup.groupId })
        .from(mangaGroup)
        .where(eq(mangaGroup.mangaId, mangaId))
    ).toEqual([{ groupId: partnerGroupId }])
    expect(
      await runtime.database
        .select({ groupId: chapterGroup.groupId })
        .from(chapterGroup)
        .innerJoin(chapter, eq(chapter.id, chapterGroup.chapterId))
        .where(eq(chapter.mangaId, mangaId))
    ).toEqual([{ groupId: partnerGroupId }, { groupId: partnerGroupId }])
  })
})
