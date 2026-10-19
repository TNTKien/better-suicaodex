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
import {
  addHours,
  addSeconds,
  differenceInMilliseconds,
  parseISO,
  subSeconds,
} from "date-fns"
import { and, eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createDatabase } from "../../src/db/client"
import { createApp } from "../../src/app"
import type { Auth } from "../../src/features/account/auth"
import {
  chapter,
  chapterGroup,
  chapterStats,
  coinCommentReward,
  coinLedger,
  coinViewReceipt,
  coinWallet,
  comment,
  forbiddenWord,
  manga,
  mangaGroup,
  mangaStats,
  member,
  organization,
  translationGroupApplication,
  translationGroupMemberProfile,
  translationGroupProfile,
  translationGroupMangaViewStats,
  user,
  userProfile,
} from "../../src/db/schema"
import {
  createCoinService,
  reconcileCoinWallet,
} from "../../src/features/coin/service"
import { acceptCoinView } from "../../src/features/coin/views"
import { transferGroupCoin } from "../../src/features/coin/wallet"
import { reconcileCoinDatabase } from "../../src/features/coin/reconciliation"
import { lockGroup } from "../../src/features/groups/service"
import { setCommentModerationVisibility } from "../../src/features/moderation/comments"
import type { BusinessCache } from "../../src/shared/cache"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>
let time = parseISO("2026-10-05T00:00:00Z")
const secret = "coin-test-reader-session-secret-32-bytes"
const origin = "http://localhost:3000"
const coin = createCoinService({ enabled: true })
const excluded: string[] = []
let app: ReturnType<typeof createApp>
const auth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get("x-test-user")
      return id ? { user: { id } } : null
    },
  },
} as unknown as Auth
const cache = {
  status: "disabled",
  acquireLock: async () => null,
  invalidateCatalog: async () => {},
} as unknown as BusinessCache
function makeApp(enabled = true, cacheOverride = cache) {
  return createApp({
    auth,
    account: { database: connection.db },
    coin: enabled ? coin : createCoinService(),
    coinExcludedGroupIds: excluded,
    catalog: {
      database: connection.db,
      cache: cacheOverride,
      assetBaseUrl: "https://assets.example.com/",
    },
    viewTracking: { secret, now: () => time },
    commentNow: () => time,
    logger: () => {},
    webOrigin: origin,
  })
}
async function account(role = "user") {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, name: "Reward fixture", email: `${id}@example.com`, role })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function group(inactive = false) {
  const id = randomUUID()
  await connection.db
    .insert(organization)
    .values({ id, name: "Reward group", slug: `reward-${id}`, createdAt: time })
  await connection.db.insert(translationGroupProfile).values({
    organizationId: id,
    approvalStatus: "approved",
    publicationState: "published",
    inactive,
  })
  return id
}
async function join(groupId: string, userId: string, role = "member") {
  const id = randomUUID()
  await connection.db
    .insert(member)
    .values({ id, organizationId: groupId, userId, role, createdAt: time })
  await connection.db
    .insert(translationGroupMemberProfile)
    .values({ memberId: id })
  return id
}
async function story(groups?: string[]) {
  const ids = groups ?? [await group()]
  const [row] = await connection.db
    .insert(manga)
    .values({
      ownerGroupId: ids[0]!,
      slug: `coin-${randomUUID()}`,
      title: "Coin test",
      searchTitle: "coin test",
      originalLanguage: "ja",
      status: "ongoing",
      contentRating: "safe",
      hasUsableChapters: true,
    })
    .returning()
  await connection.db
    .insert(mangaGroup)
    .values(ids.map((groupId) => ({ mangaId: row!.id, groupId })))
  const [part] = await connection.db
    .insert(chapter)
    .values({
      ownerGroupId: ids[0]!,
      mangaId: row!.id,
      language: "vi",
      pageCount: 1,
      availablePageCount: 1,
      isFull: true,
      publicationState: "published",
      publishedAt: time,
    })
    .returning()
  await connection.db
    .insert(chapterGroup)
    .values({ chapterId: part!.id, groupId: ids[0]! })
  return { id: row!.id, chapterId: part!.id, groups: ids }
}
function request(
  actor: string | null,
  path: string,
  method = "GET",
  body?: unknown,
  selectedApp = app,
  requestOrigin = origin
) {
  return selectedApp.request(path, {
    method,
    headers: {
      ...(actor ? { "x-test-user": actor } : {}),
      origin: requestOrigin,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
async function assertBalance(
  id: string,
  amount: string,
  kind: "user" | "group" = "user"
) {
  expect(await reconcileCoinWallet(connection.db, { kind, id })).toMatchObject({
    balance: amount,
    ledgerBalance: amount,
    matches: true,
  })
}
async function fund(
  id: string,
  amount: string,
  kind: "user" | "group" = "user"
) {
  await connection.db.transaction((tx) =>
    coin.apply(tx, {
      key: `fixture:${randomUUID()}`,
      actorUserId: null,
      sourceType: "test",
      sourceId: id,
      entries: [{ owner: { kind, id }, mode: "credit", amount }],
    })
  )
}
async function failure(action: Promise<unknown>) {
  const error = await action.then(
    () => null,
    (error) => error
  )
  expect(error).toBeInstanceOf(Error)
  return error
}
const eligible = "Cảm ơn nhóm dịch nhiều"
const groupPath = (id: string) => `/v1/contribution/groups/${id}/coin-wallet`

describe("10E.1 D-F: reward and wallet API", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (
      !url ||
      url === process.env.DATABASE_URL ||
      !new URL(url).pathname.endsWith("_test")
    )
      throw new Error("Dedicated disposable _test database required")
    connection = createDatabase(url)
    await migrate(connection.db, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
    app = makeApp()
  })
  afterAll(async () => {
    await connection?.pool.end()
  })

  test("D: concurrent create retry has one comment/reward; different input conflicts", async () => {
    const author = await account(),
      manga = await story()
    const payload = { body: eligible, operationId: randomUUID() }
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(author, `/v1/manga/${manga.id}/comments`, "POST", payload)
      )
    )
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(201))
    const rows = await Promise.all(responses.map((r) => r.json()))
    expect(new Set(rows.map((r) => r.id)).size).toBe(1)
    await assertBalance(author, "1")
    expect(
      await connection.db
        .select()
        .from(comment)
        .where(eq(comment.userId, author))
    ).toHaveLength(1)
    expect(
      (
        await request(author, `/v1/manga/${manga.id}/comments`, "POST", {
          ...payload,
          body: "Changed payload",
        })
      ).status
    ).toBe(409)
    expect(
      (
        await request(
          author,
          `/v1/chapters/${manga.chapterId}/comments`,
          "POST",
          payload
        )
      ).status
    ).toBe(409)
    await assertBalance(author, "1")
  })

  test("D: root chapter reward, edit revoke/restore, stale version and spent reward cannot mint", async () => {
    const author = await account(),
      manga = await story()
    const created = await request(
      author,
      `/v1/chapters/${manga.chapterId}/comments`,
      "POST",
      { body: eligible }
    )
    expect(created.status).toBe(201)
    const { id } = await created.json()
    await assertBalance(author, "1")
    const edit = (body: string, expectedVersion: number) =>
      request(author, `/v1/comments/${id}`, "PATCH", { body, expectedVersion })
    expect((await edit("ngắn", 1)).status).toBe(200)
    await assertBalance(author, "0")
    expect((await edit(eligible, 1)).status).toBe(409)
    expect((await edit(eligible, 2)).status).toBe(200)
    await assertBalance(author, "1")
    await connection.db.transaction((tx) =>
      coin.apply(tx, {
        key: `spend:${randomUUID()}`,
        actorUserId: author,
        sourceType: "test",
        sourceId: id,
        entries: [
          { owner: { kind: "user", id: author }, mode: "debit", amount: "1" },
        ],
      })
    )
    expect((await edit("ngắn", 3)).status).toBe(200)
    expect((await edit(eligible, 4)).status).toBe(200)
    await assertBalance(author, "0")
    await fund(author, "2")
    expect((await edit("ngắn", 5)).status).toBe(200)
    expect((await edit(eligible, 6)).status).toBe(200)
    await assertBalance(author, "2")
  })

  test("D: new unqualified root can qualify once; replies and historical/off comments cannot", async () => {
    const author = await account(),
      manga = await story()
    const post = (body: unknown, selectedApp = app) =>
      request(
        author,
        `/v1/manga/${manga.id}/comments`,
        "POST",
        body,
        selectedApp
      )
    const root = await (await post({ body: "ngắn" })).json()
    expect(
      (
        await request(author, `/v1/comments/${root.id}`, "PATCH", {
          body: eligible,
          expectedVersion: 1,
        })
      ).status
    ).toBe(200)
    await assertBalance(author, "1")
    time = addSeconds(time, 31)
    const reply = await (
      await post({ body: eligible, parentId: root.id })
    ).json()
    expect(reply.parentId).toBe(root.id)
    await assertBalance(author, "1")
    const old = await (await post({ body: "lịch sử" }, makeApp(false))).json()
    expect(
      (
        await request(author, `/v1/comments/${old.id}`, "PATCH", {
          body: eligible,
          expectedVersion: 1,
        })
      ).status
    ).toBe(200)
    await assertBalance(author, "1")
  })

  test("D: stored censored words and stickers do not earn rewards", async () => {
    const author = await account(),
      manga = await story()
    const [blocked] = await connection.db
      .insert(forbiddenWord)
      .values({ word: "từcấmcoinfixture", normalizedWord: "từcấmcoinfixture" })
      .onConflictDoNothing()
      .returning()
    const result = await request(
      author,
      `/v1/manga/${manga.id}/comments`,
      "POST",
      { body: "Cảm ơn nhóm từcấmcoinfixture :kyaru-vuong:" }
    )
    expect(result.status).toBe(201)
    expect((await result.json()).body).toContain("***")
    await assertBalance(author, "0")
    if (blocked)
      await connection.db
        .delete(forbiddenWord)
        .where(eq(forbiddenWord.id, blocked.id))
  })

  test("D: cooldown/duplicate are DB-serialized, including deleted comments, with exact boundaries", async () => {
    const author = await account(),
      manga = await story()
    const post = (body: string) =>
      request(author, `/v1/manga/${manga.id}/comments`, "POST", { body })
    const first = await (await post(eligible)).json()
    const burst = await Promise.all([
      post("Bình luận khác thứ nhất"),
      post("Bình luận khác thứ hai"),
    ])
    expect(burst.map((r) => r.status)).toEqual([429, 429])
    time = addSeconds(time, 10)
    expect((await post("Bình luận khác thứ nhất")).status).toBe(201)
    expect(
      (
        await request(author, `/v1/comments/${first.id}`, "DELETE", {
          expectedVersion: 1,
        })
      ).status
    ).toBe(200)
    time = addSeconds(time, 19)
    expect((await post(eligible)).status).toBe(429)
    time = addSeconds(time, 1)
    expect((await post(eligible)).status).toBe(201)
  })

  test("D: delete penalty clamps at 0/1/2/3 and never charges replies by cascade", async () => {
    const manga = await story()
    for (const initial of [0, 1, 2, 3, 4]) {
      const author = await account()
      if (initial) await fund(author, String(initial))
      const [root] = await connection.db
        .insert(comment)
        .values({ userId: author, mangaId: manga.id, body: "old root" })
        .returning()
      const [reply] = await connection.db
        .insert(comment)
        .values({
          userId: author,
          mangaId: manga.id,
          parentId: root!.id,
          body: "old reply",
        })
        .returning()
      expect(
        (
          await request(author, `/v1/comments/${root!.id}`, "DELETE", {
            expectedVersion: 1,
          })
        ).status
      ).toBe(200)
      await assertBalance(author, String(Math.max(0, initial - 3)))
      expect(
        (
          await connection.db
            .select()
            .from(comment)
            .where(eq(comment.id, reply!.id))
        )[0]!.deletedAt
      ).toBeNull()
      expect(
        (
          await request(author, `/v1/comments/${root!.id}`, "DELETE", {
            expectedVersion: 1,
          })
        ).status
      ).toBe(409)
      await assertBalance(author, String(Math.max(0, initial - 3)))
    }
  })

  test("D: real moderation hide/unhide preserves rewards and comment counters", async () => {
    const author = await account(),
      admin = await account("admin"),
      manga = await story()
    const root = await (
      await request(author, `/v1/manga/${manga.id}/comments`, "POST", {
        body: eligible,
      })
    ).json()
    const reward = () =>
      connection.db
        .select()
        .from(coinCommentReward)
        .where(eq(coinCommentReward.commentId, root.id))
    const before = await reward()
    const count = async () =>
      (
        await connection.db
          .select()
          .from(mangaStats)
          .where(eq(mangaStats.mangaId, manga.id))
      )[0]!.comments
    expect(await count()).toBe(1n)
    await setCommentModerationVisibility(
      { database: connection.db, cache },
      admin,
      root.id,
      { hidden: true, expectedVersion: 1 }
    )
    expect(await count()).toBe(0n)
    expect(await reward()).toEqual(before)
    await assertBalance(author, "1")
    await setCommentModerationVisibility(
      { database: connection.db, cache },
      admin,
      root.id,
      { hidden: false, expectedVersion: 2 }
    )
    expect(await count()).toBe(1n)
    expect(await reward()).toEqual(before)
    await assertBalance(author, "1")
  })

  test("D: concurrent edits reward once; suspension, hidden/version failures leave coin unchanged", async () => {
    const author = await account(),
      manga = await story()
    const root = await (
      await request(author, `/v1/manga/${manga.id}/comments`, "POST", {
        body: "ngắn",
      })
    ).json()
    const edit = () =>
      request(author, `/v1/comments/${root.id}`, "PATCH", {
        body: eligible,
        expectedVersion: 1,
      })
    expect(
      (await Promise.all([edit(), edit()])).map((r) => r.status).sort()
    ).toEqual([200, 409])
    await connection.db
      .update(userProfile)
      .set({
        status: "suspended",
        moderatedAt: time,
        moderationReason: "Coin test",
      })
      .where(eq(userProfile.userId, author))
    expect(
      (
        await request(author, `/v1/comments/${root.id}`, "PATCH", {
          body: "ngắn",
          expectedVersion: 2,
        })
      ).status
    ).toBe(403)
    await connection.db
      .update(userProfile)
      .set({ status: "active" })
      .where(eq(userProfile.userId, author))
    await connection.db
      .update(comment)
      .set({ status: "hidden" })
      .where(eq(comment.id, root.id))
    expect(
      (
        await request(author, `/v1/comments/${root.id}`, "PATCH", {
          body: "ngắn",
          expectedVersion: 2,
        })
      ).status
    ).toBe(409)
    await assertBalance(author, "1")
  })

  test("D: reward transaction failure rolls back comment; post-commit cache failure replays same ID", async () => {
    const author = await account(),
      manga = await story(),
      operationId = randomUUID()
    const failCoin = {
      enabled: true,
      apply: async () => {
        throw new Error("injected reward failure")
      },
    }
    const broken = createApp({
      auth,
      coin: failCoin,
      catalog: {
        database: connection.db,
        cache,
        assetBaseUrl: "https://assets.example.com",
      },
      logger: () => {},
    })
    expect(
      (
        await request(
          author,
          `/v1/manga/${manga.id}/comments`,
          "POST",
          { body: eligible, operationId },
          broken
        )
      ).status
    ).toBe(500)
    expect(
      await connection.db
        .select()
        .from(comment)
        .where(eq(comment.userId, author))
    ).toHaveLength(0)
    await assertBalance(author, "0")
    const lostResponse = makeApp(true, {
      ...cache,
      invalidateCatalog: async () => {
        throw new Error("cache lost")
      },
    } as unknown as BusinessCache)
    expect(
      (
        await request(
          author,
          `/v1/manga/${manga.id}/comments`,
          "POST",
          { body: eligible, operationId },
          lostResponse
        )
      ).status
    ).toBe(500)
    expect(
      (
        await request(author, `/v1/manga/${manga.id}/comments`, "POST", {
          body: eligible,
          operationId,
        })
      ).status
    ).toBe(201)
    expect(
      await connection.db
        .select()
        .from(comment)
        .where(eq(comment.userId, author))
    ).toHaveLength(1)
    await assertBalance(author, "1")
  })

  test("E: DB dedup counts once across concurrent requests/new tokens/Redis reset; rolling 12h expires exactly", async () => {
    const manga = await story()
    const start = async (cookie?: string) =>
      app.request(`/v1/chapters/${manga.chapterId}/view-session`, {
        method: "POST",
        headers: cookie ? { cookie } : {},
      })
    const initial = await start(),
      cookie = initial.headers.get("set-cookie")!.split(";")[0]!,
      session = await initial.json()
    const complete = (token: string) =>
      app.request(`/v1/chapters/${manga.chapterId}/view`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ token, seenPages: 1 }),
      })
    expect(await (await complete(session.token)).json()).toMatchObject({
      counted: false,
      retryAfterSeconds: 1,
    })
    time = addSeconds(time, 1)
    const results = await Promise.all(
      Array.from({ length: 8 }, async () =>
        (await complete(session.token)).json()
      )
    )
    expect(results.filter((r) => r.counted)).toHaveLength(1)
    expect(results.filter((r) => r.alreadyCounted)).toHaveLength(7)
    const acceptedAt = time
    time = addHours(time, 6)
    const next = await (await start(cookie)).json()
    time = addSeconds(time, 1)
    expect(await (await complete(next.token)).json()).toMatchObject({
      counted: false,
      alreadyCounted: true,
      trackingAvailable: true,
    })
    time = subSeconds(addHours(acceptedAt, 12), 1)
    expect(await (await complete(next.token)).json()).toMatchObject({
      counted: false,
      alreadyCounted: true,
    })
    time = addSeconds(time, 1)
    expect(await (await complete(next.token)).json()).toMatchObject({
      counted: true,
      viewCount: 2,
    })
    const [wallet] = await connection.db
      .select()
      .from(coinWallet)
      .where(eq(coinWallet.groupId, manga.groups[0]!))
    expect(wallet!.viewRemainderTenths).toBe(20)
  })

  test("E: manga groups get exact carry, chapter groups keep ranking; exclusion occurs before division", async () => {
    const groups = [await group(true), await group(), await group()]
    const skipped = await group()
    excluded.push(skipped)
    const [system] = await connection.db
      .select()
      .from(organization)
      .where(eq(organization.slug, "system"))
    const manga = await story([...groups, skipped, system!.id])
    await connection.db
      .insert(coinWallet)
      .values(groups.map((groupId) => ({ groupId, viewRemainderTenths: 998 })))
    const input = {
      sessionHash: "a".repeat(64),
      chapterId: manga.chapterId,
      mangaId: manga.id,
      now: time,
      excludedGroupIds: excluded,
    }
    await connection.db.transaction((tx) => acceptCoinView(tx, coin, input))
    for (const id of groups) {
      await assertBalance(id, "1", "group")
      expect(
        (
          await connection.db
            .select()
            .from(coinWallet)
            .where(eq(coinWallet.groupId, id))
        )[0]!.viewRemainderTenths
      ).toBe(1)
    }
    await assertBalance(skipped, "0", "group")
    expect(
      (
        await connection.db
          .select()
          .from(translationGroupMangaViewStats)
          .where(eq(translationGroupMangaViewStats.mangaId, manga.id))
      ).map((r) => ({ groupId: r.groupId, views: r.views }))
    ).toEqual([{ groupId: groups[0], views: 1 }])
    // Change attribution after commit; replay must not redistribute the receipt.
    await connection.db
      .delete(mangaGroup)
      .where(
        and(
          eq(mangaGroup.mangaId, manga.id),
          eq(mangaGroup.groupId, groups[1]!)
        )
      )
    expect(
      await connection.db.transaction((tx) => acceptCoinView(tx, coin, input))
    ).toMatchObject({ counted: false })
    const [receipt] = await connection.db
      .select()
      .from(coinViewReceipt)
      .where(eq(coinViewReceipt.chapterId, manga.chapterId))
    expect(receipt!.allocations).toHaveLength(3)
  })

  test("E: unrelated views serialize group carry; no eligible group still counts normally", async () => {
    const manga = await story()
    const inputs = Array.from({ length: 25 }, (_, index) => ({
      sessionHash: index.toString(16).padStart(64, "0"),
      chapterId: manga.chapterId,
      mangaId: manga.id,
      now: time,
      excludedGroupIds: [],
    }))
    await connection.db
      .insert(coinWallet)
      .values({ groupId: manga.groups[0]!, viewRemainderTenths: 990 })
    await Promise.all(
      inputs.map((input) =>
        connection.db.transaction((tx) => acceptCoinView(tx, coin, input))
      )
    )
    await assertBalance(manga.groups[0]!, "1", "group")
    expect(
      (
        await connection.db
          .select()
          .from(coinWallet)
          .where(eq(coinWallet.groupId, manga.groups[0]!))
      )[0]!.viewRemainderTenths
    ).toBe(240)
    await connection.db
      .delete(mangaGroup)
      .where(eq(mangaGroup.mangaId, manga.id))
    const result = await connection.db.transaction((tx) =>
      acceptCoinView(tx, coin, { ...inputs[0]!, sessionHash: "f".repeat(64) })
    )
    expect(result).toMatchObject({ counted: true, viewCount: 26 })
    await assertBalance(manga.groups[0]!, "1", "group")
  })

  test("E: ledger failure rolls back view stats, receipt and remainder, allowing a clean retry", async () => {
    const manga = await story()
    await connection.db
      .insert(coinWallet)
      .values({ groupId: manga.groups[0]!, viewRemainderTenths: 995 })
    const input = {
      sessionHash: "b".repeat(64),
      chapterId: manga.chapterId,
      mangaId: manga.id,
      now: time,
      excludedGroupIds: [],
    }
    await failure(
      connection.db.transaction((tx) =>
        acceptCoinView(
          tx,
          {
            enabled: true,
            apply: async () => {
              throw new Error("ledger unavailable")
            },
          },
          input
        )
      )
    )
    expect(
      await connection.db
        .select()
        .from(coinViewReceipt)
        .where(eq(coinViewReceipt.chapterId, manga.chapterId))
    ).toHaveLength(0)
    expect(
      await connection.db
        .select()
        .from(chapterStats)
        .where(eq(chapterStats.chapterId, manga.chapterId))
    ).toHaveLength(0)
    expect(
      (
        await connection.db
          .select()
          .from(coinWallet)
          .where(eq(coinWallet.groupId, manga.groups[0]!))
      )[0]!.viewRemainderTenths
    ).toBe(995)
    await connection.db.transaction((tx) => acceptCoinView(tx, coin, input))
    await assertBalance(manga.groups[0]!, "1", "group")
  })

  test("E: separate chapter variants and manga share exact group carry without merging view receipts", async () => {
    const ids = [await group(), await group()]
    const first = await story(ids),
      second = await story([...ids].reverse())
    const [variant] = await connection.db
      .insert(chapter)
      .values({
        mangaId: first.id,
        ownerGroupId: ids[0]!,
        language: "vi",
        pageCount: 1,
        availablePageCount: 1,
        isFull: true,
        publicationState: "published",
        publishedAt: time,
      })
      .returning()
    await connection.db
      .insert(chapterGroup)
      .values({ chapterId: variant!.id, groupId: ids[1]! })
    await connection.db
      .insert(coinWallet)
      .values(ids.map((groupId) => ({ groupId, viewRemainderTenths: 990 })))
    const inputs = [
      first,
      second,
      { id: first.id, chapterId: variant!.id },
    ].map((row) => ({
      sessionHash: "c".repeat(64),
      chapterId: row.chapterId,
      mangaId: row.id,
      now: time,
      excludedGroupIds: [],
    }))
    const results = await Promise.all(
      inputs.map((input) =>
        connection.db.transaction((tx) => acceptCoinView(tx, coin, input))
      )
    )
    expect(results.every((row) => row.counted)).toBe(true)
    for (const id of ids) {
      await assertBalance(id, "1", "group")
      expect(
        (
          await connection.db
            .select()
            .from(coinWallet)
            .where(eq(coinWallet.groupId, id))
        )[0]!.viewRemainderTenths
      ).toBe(5)
    }
    for (const input of inputs) {
      expect(
        await connection.db.transaction((tx) => acceptCoinView(tx, coin, input))
      ).toMatchObject({ counted: false, alreadyCounted: true, viewCount: 1 })
    }
  })

  test("F: personal wallet is private, precise and lazy; history uses stable sequence cursors", async () => {
    const author = await account(),
      other = await account()
    expect((await request(null, "/v1/me/coin-wallet")).status).toBe(401)
    const empty = await request(author, "/v1/me/coin-wallet")
    expect(empty.headers.get("cache-control")).toBe("private, no-store")
    expect(await empty.json()).toEqual({ balance: "0" })
    expect(
      await connection.db
        .select()
        .from(coinWallet)
        .where(eq(coinWallet.userId, author))
    ).toHaveLength(0)
    await fund(author, "9007199254740993")
    await fund(author, "2")
    await fund(author, "3")
    expect(await (await request(other, "/v1/me/coin-wallet")).json()).toEqual({
      balance: "0",
    })
    expect(await (await request(author, "/v1/me/coin-wallet")).json()).toEqual({
      balance: "9007199254740998",
    })
    const first = await (
      await request(author, "/v1/me/coin-wallet/transactions?limit=2")
    ).json()
    expect(first.data.map((row: { sequence: string }) => row.sequence)).toEqual(
      ["3", "2"]
    )
    expect(first.meta.nextCursor).toBe("2")
    expect(first.data[0].fingerprint).toBeUndefined()
    await fund(author, "1")
    const next = await (
      await request(
        author,
        `/v1/me/coin-wallet/transactions?limit=2&cursor=${first.meta.nextCursor}`
      )
    ).json()
    expect(next.data.map((row: { sequence: string }) => row.sequence)).toEqual([
      "1",
    ])
    expect(next.meta.nextCursor).toBeNull()
    expect(
      (await request(author, "/v1/me/coin-wallet/transactions?cursor=1e3"))
        .status
    ).toBe(400)
  })

  test("F: leader/admin transfer once with scoped membership, origin, balance and idempotency checks", async () => {
    const leader = await account(),
      recipient = await account(),
      outsider = await account(),
      admin = await account("admin"),
      groupId = await group(true)
    await join(groupId, leader, "owner")
    await join(groupId, recipient)
    await fund(groupId, "20", "group")
    const path = groupPath(groupId),
      input = {
        recipientUserId: recipient,
        amount: "5",
        operationId: randomUUID(),
      }
    expect((await request(recipient, path)).status).toBe(403)
    expect((await request(outsider, path)).status).toBe(403)
    expect((await request(leader, path)).status).toBe(200)
    expect(
      (
        await request(
          leader,
          `${path}/transfers`,
          "POST",
          input,
          app,
          "https://evil.example"
        )
      ).status
    ).toBe(403)
    const replies = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(leader, `${path}/transfers`, "POST", input)
      )
    )
    expect(replies.map((r) => r.status)).toEqual(Array(6).fill(200))
    const receipts = await Promise.all(replies.map((r) => r.json()))
    for (const receipt of receipts) expect(receipt).toEqual(receipts[0])
    expect(receipts[0].recipientBalance).toBeUndefined()
    await assertBalance(groupId, "15", "group")
    await assertBalance(recipient, "5")
    expect(
      (
        await request(leader, `${path}/transfers`, "POST", {
          ...input,
          amount: "6",
        })
      ).status
    ).toBe(409)
    expect(
      (
        await request(leader, `${path}/transfers`, "POST", {
          ...input,
          recipientUserId: leader,
        })
      ).status
    ).toBe(409)
    expect(
      (
        await request(leader, `${path}/transfers`, "POST", {
          ...input,
          recipientUserId: outsider,
          operationId: randomUUID(),
        })
      ).status
    ).toBe(403)
    expect(
      (
        await request(leader, `${path}/transfers`, "POST", {
          ...input,
          amount: "99",
          operationId: randomUUID(),
        })
      ).status
    ).toBe(409)
    expect(
      (
        await request(admin, `${path}/transfers`, "POST", {
          ...input,
          operationId: randomUUID(),
        })
      ).status
    ).toBe(200)
    const entries = await connection.db
      .select()
      .from(coinLedger)
      .where(
        eq(coinLedger.operationKey, `transfer:${leader}:${input.operationId}`)
      )
    expect(entries).toHaveLength(2)
    expect(entries.reduce((n, row) => n + row.delta, 0n)).toBe(0n)
    const groupHistory = await (
      await request(leader, `${path}/transactions`)
    ).json()
    const personalHistory = await (
      await request(recipient, "/v1/me/coin-wallet/transactions")
    ).json()
    expect(groupHistory.data[1]).toMatchObject({
      delta: "-5",
      transactionGroup: receipts[0].transactionGroup,
    })
    expect(personalHistory.data[1]).toMatchObject({
      delta: "5",
      transactionGroup: receipts[0].transactionGroup,
    })
  })

  test("F: pending applications, suspended/banned accounts and excluded groups cannot transfer", async () => {
    const admin = await account("admin"),
      recipient = await account(),
      groupId = await group()
    await fund(groupId, "10", "group")
    await connection.db.insert(translationGroupApplication).values({
      organizationId: groupId,
      userId: recipient,
      type: "join",
      status: "pending",
    })
    const transfer = () =>
      request(admin, `${groupPath(groupId)}/transfers`, "POST", {
        recipientUserId: recipient,
        amount: "1",
        operationId: randomUUID(),
      })
    expect((await transfer()).status).toBe(403)
    await join(groupId, recipient)
    await connection.db
      .update(userProfile)
      .set({
        status: "suspended",
        moderatedAt: time,
        moderationReason: "Coin test",
      })
      .where(eq(userProfile.userId, recipient))
    expect((await transfer()).status).toBe(403)
    await connection.db
      .update(userProfile)
      .set({ status: "active" })
      .where(eq(userProfile.userId, recipient))
    await connection.db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, admin))
    expect((await transfer()).status).toBe(403)
    expect((await request(admin, "/v1/me/coin-wallet")).status).toBe(403)
    await connection.db
      .update(user)
      .set({ banned: false })
      .where(eq(user.id, admin))
    excluded.push(groupId)
    expect((await transfer()).status).toBe(403)
    await assertBalance(groupId, "10", "group")
  })

  test("F: group without leader retains funds; transferring leadership changes access, not wallet", async () => {
    const groupId = await group(),
      first = await account(),
      second = await account()
    await fund(groupId, "4", "group")
    expect((await request(first, groupPath(groupId))).status).toBe(403)
    const firstMembership = await join(groupId, first, "owner")
    const secondMembership = await join(groupId, second)
    expect((await request(first, groupPath(groupId))).status).toBe(200)
    await connection.db.transaction(async (tx) => {
      await lockGroup(tx, groupId)
      await tx
        .update(member)
        .set({ role: "member" })
        .where(eq(member.id, firstMembership))
      await tx
        .update(member)
        .set({ role: "owner" })
        .where(eq(member.id, secondMembership))
    })
    expect((await request(first, groupPath(groupId))).status).toBe(403)
    expect(await (await request(second, groupPath(groupId))).json()).toEqual({
      balance: "4",
    })
    await assertBalance(groupId, "4", "group")
  })

  test("F: transfer rollback is atomic and membership removal winning the lock blocks transfer", async () => {
    const leader = await account(),
      recipient = await account(),
      groupId = await group()
    await join(groupId, leader, "owner")
    const membershipId = await join(groupId, recipient)
    await fund(groupId, "5", "group")
    const input = {
      recipientUserId: recipient,
      amount: "3",
      operationId: randomUUID(),
    }
    await failure(
      connection.db.transaction(async (tx) => {
        await transferGroupCoin(tx, coin, leader, groupId, input, [])
        throw new Error("outer failure")
      })
    )
    await assertBalance(groupId, "5", "group")
    await assertBalance(recipient, "0")
    let locked!: () => void, release!: () => void
    const ready = new Promise<void>((resolve) => {
        locked = resolve
      }),
      gate = new Promise<void>((resolve) => {
        release = resolve
      })
    const removal = connection.db.transaction(async (tx) => {
      await lockGroup(tx, groupId)
      await tx.delete(member).where(eq(member.id, membershipId))
      locked()
      await gate
    })
    await ready
    const transfer = request(
      leader,
      `${groupPath(groupId)}/transfers`,
      "POST",
      input
    )
    release()
    await removal
    expect((await transfer).status).toBe(403)
    await assertBalance(groupId, "5", "group")
    await assertBalance(recipient, "0")
  })

  test("F: competing transfers cannot overspend or partially credit recipients", async () => {
    const leader = await account(),
      groupId = await group()
    await join(groupId, leader, "owner")
    const recipients = [await account(), await account()]
    for (const id of recipients) await join(groupId, id)
    await fund(groupId, "5", "group")
    const results = await Promise.all(
      recipients.map((recipientUserId) =>
        request(leader, `${groupPath(groupId)}/transfers`, "POST", {
          recipientUserId,
          amount: "4",
          operationId: randomUUID(),
        })
      )
    )
    expect(results.map((row) => row.status).sort()).toEqual([200, 409])
    await assertBalance(groupId, "1", "group")
    for (const [index, id] of recipients.entries())
      await assertBalance(id, results[index]!.status === 200 ? "4" : "0")
  })

  test("F: role revocation or recipient restriction winning its lock prevents transfer", async () => {
    for (const change of ["leader", "admin", "recipient"] as const) {
      const actor = await account(change === "admin" ? "admin" : "user"),
        recipient = await account(),
        groupId = await group()
      const membershipId = await join(groupId, actor, "owner")
      await join(groupId, recipient)
      await fund(groupId, "3", "group")
      let locked!: () => void, release!: () => void
      const ready = new Promise<void>((resolve) => {
          locked = resolve
        }),
        gate = new Promise<void>((resolve) => {
          release = resolve
        })
      const mutation = connection.db.transaction(async (tx) => {
        if (change === "leader") {
          await lockGroup(tx, groupId)
          await tx
            .update(member)
            .set({ role: "member" })
            .where(eq(member.id, membershipId))
        } else if (change === "admin") {
          // Remove the owner's fallback before the admin role is revoked.
          await tx
            .update(member)
            .set({ role: "member" })
            .where(eq(member.id, membershipId))
          await tx.update(user).set({ role: "user" }).where(eq(user.id, actor))
        } else {
          await tx
            .update(userProfile)
            .set({
              status: "suspended",
              moderatedAt: time,
              moderationReason: "Coin race fixture",
            })
            .where(eq(userProfile.userId, recipient))
        }
        locked()
        await gate
      })
      await ready
      const transfer = request(
        actor,
        `${groupPath(groupId)}/transfers`,
        "POST",
        { recipientUserId: recipient, amount: "2", operationId: randomUUID() }
      )
      release()
      await mutation
      expect((await transfer).status).toBe(403)
      await assertBalance(groupId, "3", "group")
      await assertBalance(recipient, "0")
    }
  })

  test("H: comment/view/transfer share wallets under contention without losing coin or duplicating receipts", async () => {
    for (let round = 0; round < 3; round++) {
      const leader = await account(),
        author = await account(),
        manga = await story()
      const groupId = manga.groups[0]!
      await join(groupId, leader, "owner")
      await join(groupId, author)
      await fund(groupId, "100", "group")
      await fund(author, "10")
      await connection.db
        .update(coinWallet)
        .set({ viewRemainderTenths: 990 })
        .where(eq(coinWallet.groupId, groupId))
      const operationId = randomUUID()
      const comments = Array.from({ length: 6 }, () =>
        request(author, `/v1/manga/${manga.id}/comments`, "POST", {
          body: eligible,
          operationId,
        })
      )
      const transfers = Array.from({ length: 10 }, () =>
        request(leader, `${groupPath(groupId)}/transfers`, "POST", {
          recipientUserId: author,
          amount: "1",
          operationId: randomUUID(),
        })
      )
      const views = Array.from({ length: 25 }, (_, i) =>
        connection.db.transaction((tx) =>
          acceptCoinView(tx, coin, {
            sessionHash: i.toString(16).padStart(64, "0"),
            chapterId: manga.chapterId,
            mangaId: manga.id,
            now: time,
            excludedGroupIds: [],
          })
        )
      )
      const [commentResults, transferResults, viewResults] = await Promise.all([
        Promise.all(comments),
        Promise.all(transfers),
        Promise.all(views),
      ])
      expect(commentResults.every((r) => r.status === 201)).toBe(true)
      expect(transferResults.every((r) => r.status === 200)).toBe(true)
      expect(viewResults.every((r) => r.counted)).toBe(true)
      await assertBalance(author, "21")
      await assertBalance(groupId, "91", "group")
      const root = await commentResults[0]!.json()
      expect(
        (
          await request(author, `/v1/comments/${root.id}`, "DELETE", {
            expectedVersion: 1,
          })
        ).status
      ).toBe(200)
      await assertBalance(author, "18")
    }
    expect(await reconcileCoinDatabase(connection.db)).toMatchObject({
      matches: true,
      walletErrors: "0",
      receiptErrors: "0",
      transferErrors: "0",
      entryErrors: "0",
    })
  })

  test("H: off/on cutover carries the remaining Redis TTL into DB without rewarding or renewing it", async () => {
    const manga = await story(),
      locks = new Map<string, Date>()
    const legacyCache = {
      ...cache,
      status: "healthy",
      lockRemainingMilliseconds: async (key: string) =>
        Math.max(0, differenceInMilliseconds(locks.get(key) ?? time, time)),
      acquireLock: async (key: string, ttl: number) => {
        if (differenceInMilliseconds(locks.get(key) ?? time, time) > 0)
          return null
        locks.set(key, addSeconds(time, ttl))
        return async () => {
          locks.delete(key)
        }
      },
    } as unknown as BusinessCache
    const off = makeApp(false, legacyCache),
      on = makeApp(true, legacyCache)
    let cookie = ""
    const start = async (target: typeof app) => {
      const response = await target.request(
        `/v1/chapters/${manga.chapterId}/view-session`,
        { method: "POST", headers: cookie ? { cookie } : {} }
      )
      cookie ||= response.headers.get("set-cookie")!.split(";")[0]!
      return (await response.json()).token as string
    }
    const complete = async (target: typeof app, token: string) =>
      (
        await target.request(`/v1/chapters/${manga.chapterId}/view`, {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ token, seenPages: 1 }),
        })
      ).json()
    const initial = await start(off)
    time = addSeconds(time, 1)
    expect(await complete(off, initial)).toMatchObject({
      counted: true,
      viewCount: 1,
    })
    const expiresAt = addHours(time, 12)
    time = addHours(time, 6)
    const fresh = await start(on)
    time = addSeconds(time, 1)
    expect(await complete(on, fresh)).toMatchObject({
      counted: false,
      alreadyCounted: true,
      viewCount: 1,
    })
    const [receipt] = await connection.db
      .select()
      .from(coinViewReceipt)
      .where(eq(coinViewReceipt.chapterId, manga.chapterId))
    expect(receipt!.expiresAt).toEqual(expiresAt)
    expect(receipt!.allocations).toEqual([])
    locks.clear() // DB now owns the window even if Redis disappears or the flag is turned off.
    expect(await complete(off, fresh)).toMatchObject({
      counted: false,
      alreadyCounted: true,
    })
    expect(await complete(on, fresh)).toMatchObject({
      counted: false,
      alreadyCounted: true,
    })
    await assertBalance(manga.groups[0]!, "0", "group")
    time = expiresAt
    expect(await complete(on, fresh)).toMatchObject({
      counted: true,
      viewCount: 2,
    })
    expect(
      (
        await connection.db
          .select()
          .from(coinWallet)
          .where(eq(coinWallet.groupId, manga.groups[0]!))
      )[0]!.viewRemainderTenths
    ).toBe(10)
    expect(await complete(off, fresh)).toMatchObject({
      counted: false,
      alreadyCounted: true,
    })
  })

  test("flag off preserves comments and old view behavior without allocating coin; wallet API is gated", async () => {
    const author = await account(),
      manga = await story(),
      disabled = makeApp(false)
    const response = await request(
      author,
      `/v1/manga/${manga.id}/comments`,
      "POST",
      { body: eligible },
      disabled
    )
    expect(response.status).toBe(201)
    await assertBalance(author, "0")
    expect(
      (await request(author, "/v1/me/coin-wallet", "GET", undefined, disabled))
        .status
    ).toBe(503)
    const start = await disabled.request(
      `/v1/chapters/${manga.chapterId}/view-session`,
      { method: "POST" }
    )
    const cookie = start.headers.get("set-cookie")!.split(";")[0]!,
      session = await start.json()
    time = addSeconds(time, 1)
    const viewed = await disabled.request(
      `/v1/chapters/${manga.chapterId}/view`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ token: session.token, seenPages: 1 }),
      }
    )
    expect(await viewed.json()).toMatchObject({
      counted: false,
      trackingAvailable: false,
    })
    expect(
      await connection.db
        .select()
        .from(coinViewReceipt)
        .where(eq(coinViewReceipt.chapterId, manga.chapterId))
    ).toHaveLength(0)
  })
})
