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
import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  manga,
  member,
  moderationAction,
  organization,
  person,
  tag,
  translationGroupMemberProfile,
  translationGroupProfile,
  user,
} from "../../src/db/schema"
import { createRuntime, type Runtime } from "../../src/runtime"
import { seedCatalog } from "../helpers/catalog-fixture"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)
const origin = "http://localhost:3000"
const noop = () => undefined
const groupId = randomUUID()
const secondGroupId = randomUUID()
const tagId = randomUUID()
const personId = randomUUID()
let runtime: Runtime
let app: ReturnType<typeof createApp>
let cookie: string
let userId: string
let mangaId: string
let memberId: string
let managedPersonId: string

function request(path: string, method = "GET", body?: unknown) {
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

const metadata = {
  title: "Phase 8B Manga",
  slug: "phase-8b-manga",
  alternativeTitles: ["Manga Giai Đoạn 8B", "Phase 8B Alternate"],
  description: "Private manga management fixture",
  originalLanguage: "ja",
  publicationDemographic: "seinen" as const,
  status: "ongoing" as const,
  contentRating: "safe" as const,
  year: 2026,
  lastVolume: null,
  lastChapter: null,
  links: { mal: "https://myanimelist.net/manga/123/example" },
  tagIds: [tagId],
  authorIds: [personId],
  artistIds: [personId],
}

describe.serial("Phase 8B manga management", () => {
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
      logger: noop,
      webOrigin: origin,
    })

    const signedUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        email: `phase8b-${randomUUID()}@example.com`,
        name: "Phase 8B fixture",
        password: "phase8b-fixture-password",
      }),
    })
    expect(signedUp.status).toBe(200)
    userId = ((await signedUp.json()) as { user: { id: string } }).user.id
    cookie = signedUp.headers.get("set-cookie")!.split(";", 1)[0]!

    memberId = randomUUID()
    await runtime.database.insert(organization).values({
      id: groupId,
      name: "Phase 8B group",
      slug: `phase-8b-${randomUUID()}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: groupId,
      approvalStatus: "approved",
      publicationState: "published",
      createdByUserId: userId,
    })
    await runtime.database.insert(member).values({
      id: memberId,
      organizationId: groupId,
      userId,
      role: "owner",
      createdAt: new Date(),
    })
    await runtime.database
      .insert(translationGroupMemberProfile)
      .values({ memberId })
    await runtime.database.insert(organization).values({
      id: secondGroupId,
      name: "Phase 8B second group",
      slug: `phase-8b-second-${randomUUID()}`,
      createdAt: new Date(),
    })
    await runtime.database.insert(translationGroupProfile).values({
      organizationId: secondGroupId,
      approvalStatus: "approved",
      publicationState: "published",
      createdByUserId: userId,
    })
    await runtime.database.insert(tag).values({
      id: tagId,
      slug: `phase-8b-${randomUUID()}`,
      group: "genre",
      name: "Phase 8B tag",
    })
    await runtime.database.insert(person).values({
      id: personId,
      slug: `phase-8b-${randomUUID()}`,
      name: "Phase 8B person",
    })
  })

  afterAll(async () => {
    if (!runtime) return
    await runtime.database
      .delete(moderationAction)
      .where(eq(moderationAction.actorUserId, userId))
    if (mangaId)
      await runtime.database.delete(manga).where(eq(manga.id, mangaId))
    if (managedPersonId)
      await runtime.database
        .delete(person)
        .where(eq(person.id, managedPersonId))
    await runtime.database.delete(tag).where(eq(tag.id, tagId))
    await runtime.database.delete(person).where(eq(person.id, personId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, secondGroupId))
    await runtime.database
      .delete(organization)
      .where(eq(organization.id, groupId))
    await runtime.database.delete(user).where(eq(user.id, userId))
    await runtime.close()
  })

  test("creates visible manga and manages visibility, metadata, volumes, and deletion", async () => {
    const root = `/v1/contribution/groups/${groupId}/manga`
    expect(
      (
        await request(root, "POST", {
          ...metadata,
          links: { mal: "https://example.com/manga/123" },
        })
      ).status
    ).toBe(400)
    expect(
      (
        await request(root, "POST", {
          ...metadata,
          contentRating: "pornographic",
        })
      ).status
    ).toBe(400)
    const createdPerson = await request(
      `/v1/contribution/groups/${groupId}/people`,
      "POST",
      { name: "Phase 8B Created Person" }
    )
    expect(createdPerson.status).toBe(201)
    const createdPersonBody = (await createdPerson.json()) as {
      data: { id: string; name: string; slug: string }
    }
    managedPersonId = createdPersonBody.data.id
    expect(createdPersonBody.data).toMatchObject({
      name: "Phase 8B Created Person",
      slug: "phase-8b-created-person",
    })
    expect(
      await (
        await app.request("/v1/people?q=phase%208b%20created%20person")
      ).json()
    ).toMatchObject({ data: [{ id: managedPersonId }] })
    metadata.artistIds = [managedPersonId]

    const created = await request(root, "POST", metadata)
    expect(created.status).toBe(201)
    const createdBody = (await created.json()) as {
      data: {
        id: string
        version: number
        publicationState: string
        publishedAt: string
        alternativeTitles: Record<string, string[]>
        links: Record<string, string>
      }
    }
    mangaId = createdBody.data.id
    expect(createdBody.data).toMatchObject({
      version: 1,
      publicationState: "published",
      alternativeTitles: {
        und: ["Manga Giai Đoạn 8B", "Phase 8B Alternate"],
      },
      links: { mal: "https://myanimelist.net/manga/123" },
    })
    expect(createdBody.data.publishedAt).toBeString()
    expect((await app.request(`/v1/manga/${mangaId}`)).status).toBe(200)
    await runtime.database
      .update(member)
      .set({ organizationId: secondGroupId })
      .where(eq(member.id, memberId))
    expect(
      (
        await request(
          `/v1/contribution/groups/${secondGroupId}/manga/${mangaId}`
        )
      ).status
    ).toBe(404)
    await runtime.database
      .update(member)
      .set({ organizationId: groupId })
      .where(eq(member.id, memberId))

    const list = await request(root)
    expect(list.status).toBe(200)
    expect((await list.json()) as unknown).toMatchObject({
      data: [
        {
          id: mangaId,
          version: 1,
          alternativeTitles: {
            und: ["Manga Giai Đoạn 8B", "Phase 8B Alternate"],
          },
        },
      ],
      meta: { total: 1 },
    })

    const stale = await request(`${root}/${mangaId}`, "PUT", {
      ...metadata,
      title: "Stale title",
      expectedVersion: 2,
    })
    expect(stale.status).toBe(409)
    expect((await stale.json()) as unknown).toMatchObject({
      error: { code: "STALE_MANGA", details: [{ path: "expectedVersion" }] },
    })

    const updated = await request(`${root}/${mangaId}`, "PUT", {
      ...metadata,
      title: "Updated Phase 8B Manga",
      expectedVersion: 1,
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()) as unknown).toMatchObject({
      data: {
        title: "Updated Phase 8B Manga",
        version: 2,
        tagIds: [tagId],
        authorIds: [personId],
        artistIds: [managedPersonId],
      },
    })

    const volume = await request(`${root}/${mangaId}/volumes`, "POST", {
      number: "1.000",
      expectedVersion: 2,
    })
    expect(volume.status).toBe(201)
    const volumeBody = (await volume.json()) as {
      data: { id: string; number: string }
      mangaVersion: number
    }
    expect(volumeBody).toMatchObject({ data: { number: "1" }, mangaVersion: 3 })
    expect(
      (
        await request(`${root}/${mangaId}/volumes`, "POST", {
          number: 1,
          expectedVersion: 3,
        })
      ).status
    ).toBe(409)

    const changedVolume = await request(
      `${root}/${mangaId}/volumes/${volumeBody.data.id}`,
      "PUT",
      { number: "1.5", expectedVersion: 3 }
    )
    expect(changedVolume.status).toBe(200)
    expect((await changedVolume.json()) as unknown).toMatchObject({
      data: { number: "1.5" },
      mangaVersion: 4,
    })

    const hidden = await request(`${root}/${mangaId}/visibility`, "POST", {
      expectedVersion: 4,
      hidden: true,
    })
    expect(hidden.status).toBe(200)
    const hiddenBody = (await hidden.json()) as {
      data: { publishedAt: string; version: number }
    }
    expect(hiddenBody.data).toMatchObject({
      publishedAt: createdBody.data.publishedAt,
      version: 5,
    })
    expect((await app.request(`/v1/manga/${mangaId}`)).status).toBe(404)
    expect((await request(`${root}/${mangaId}`)).status).toBe(200)
    expect((await request(`${root}?publicationState=hidden`)).status).toBe(200)
    let seedError: unknown
    try {
      await seedCatalog(runtime.database)
    } catch (error) {
      seedError = error
    }
    expect(String(seedError)).toContain("manga rows are managed")

    const whileHidden = await request(`${root}/${mangaId}`, "PUT", {
      ...metadata,
      title: "Hidden Phase 8B Manga",
      expectedVersion: 5,
    })
    expect(whileHidden.status).toBe(200)
    expect((await whileHidden.json()) as unknown).toMatchObject({
      data: { publicationState: "hidden", version: 6 },
    })

    const shown = await request(`${root}/${mangaId}/visibility`, "POST", {
      expectedVersion: 6,
      hidden: false,
    })
    expect(shown.status).toBe(200)
    expect((await shown.json()) as unknown).toMatchObject({
      data: {
        publicationState: "published",
        publishedAt: createdBody.data.publishedAt,
        version: 7,
      },
    })
    expect((await app.request(`/v1/manga/${mangaId}`)).status).toBe(200)

    expect(
      (
        await request(
          `${root}/${mangaId}/volumes/${volumeBody.data.id}`,
          "DELETE",
          {
            expectedVersion: 7,
          }
        )
      ).status
    ).toBe(204)
    expect(
      (
        await request(`${root}/${mangaId}`, "DELETE", {
          expectedVersion: 8,
        })
      ).status
    ).toBe(204)
    expect((await request(`${root}/${mangaId}`)).status).toBe(404)
    expect((await app.request(`/v1/manga/${mangaId}`)).status).toBe(404)
  })
})
