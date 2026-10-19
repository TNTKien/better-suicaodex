import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { createDatabase } from "../../src/db/client"
import {
  avatarFrame,
  avatarFrameTopic,
  coinLedger,
  coinWallet,
  shopChest,
  shopGachaRoll,
  shopGachaState,
  user,
  userProfile,
} from "../../src/db/schema"
import { MAX_COIN, type CoinOperation } from "../../src/features/coin/contract"
import { createCoinService } from "../../src/features/coin/service"
import { NORMAL_GACHA_RULE } from "../../src/features/shop/gacha-policy"

setDefaultTimeout(60_000)
const migrations = fileURLToPath(new URL("../../drizzle", import.meta.url))
const coin = createCoinService({ enabled: true })
let connection: ReturnType<typeof createDatabase>

async function constraint(
  action: PromiseLike<unknown>,
  code: string | string[] = "23514"
) {
  const error = await Promise.resolve(action).then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).not.toBeNull()
  expect(typeof code === "string" ? [code] : code).toContain(
    (error as { cause?: { code: string }; code?: string }).cause?.code ??
      (error as { code?: string }).code
  )
}
async function account() {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, name: "Gacha fixture", email: `${id}@example.com` })
  await connection.db.insert(userProfile).values({ userId: id })
  await connection.db.transaction((tx) =>
    coin.apply(tx, {
      key: `fund:${id}`,
      actorUserId: id,
      sourceType: "test",
      sourceId: id,
      entries: [{ owner: { kind: "user", id }, mode: "credit", amount: "100" }],
    })
  )
  return id
}
async function draft(rarity: "R" | "SR" | "SSR" = "SR", duplicate = false) {
  const actor = await account()
  const [frame] = await connection.db
    .insert(avatarFrame)
    .values({
      code: `gacha-${randomUUID()}`,
      name: "Snapshot frame",
      rarity,
    })
    .returning()
  const [chest] = await connection.db
    .select()
    .from(shopChest)
    .where(eq(shopChest.kind, "common"))
  const operationId = randomUUID()
  return {
    id: randomUUID(),
    actorUserId: actor,
    operationId,
    fingerprint: "b".repeat(64),
    chestId: chest!.id,
    chestKind: "common" as const,
    chestName: "Rương thường",
    topicId: null,
    chestVersion: chest!.version,
    ruleVersion: 1,
    ruleSnapshot: NORMAL_GACHA_RULE,
    poolDigest: "c".repeat(64),
    frameId: frame!.id,
    frameCode: frame!.code,
    frameName: frame!.name,
    frameVersion: frame!.version,
    rarity,
    price: 5n,
    duplicate,
    refund: duplicate ? BigInt(NORMAL_GACHA_RULE.duplicateRefund[rarity]) : 0n,
    rollSequence: 1n,
    sinceSrBefore: 0,
    sinceSsrBefore: 0,
    sinceSrAfter: rarity === "R" ? 1 : 0,
    sinceSsrAfter: rarity === "SSR" ? 0 : 1,
    coinOperationKey: `shop.gacha:${actor}:${operationId}`,
  }
}
async function commitRoll(
  row: typeof shopGachaRoll.$inferInsert,
  transform: (input: CoinOperation) => CoinOperation = (input) => input
) {
  return connection.db.transaction(async (tx) => {
    await coin.apply(
      tx,
      transform({
        key: row.coinOperationKey,
        actorUserId: row.actorUserId,
        sourceType: "shop.gacha",
        sourceId: row.id!,
        entries: [
          {
            owner: { kind: "user", id: row.actorUserId },
            mode: "debit",
            amount: "5",
          },
          ...(row.duplicate
            ? [
                {
                  owner: { kind: "user" as const, id: row.actorUserId },
                  mode: "credit" as const,
                  amount: NORMAL_GACHA_RULE.duplicateRefund[row.rarity],
                },
              ]
            : []),
        ],
      })
    )
    const [receipt] = await tx.insert(shopGachaRoll).values(row).returning()
    return receipt!
  })
}

describe.serial(`10E.3B schema (fresh PostgreSQL)`, () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (
      !url ||
      url === process.env.DATABASE_URL ||
      !["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname) ||
      !new URL(url).pathname.endsWith("_test")
    )
      throw new Error("A dedicated loopback DB ending in _test is required")
    connection = createDatabase(url)

    await migrate(connection.db, { migrationsFolder: migrations })
  })
  afterAll(async () => {
    await connection?.pool.end()
  })

  test("fresh migration creates only closed chests, rerun never resets settings", async () => {
    const result = await connection.db.execute(sql`SELECT
        (SELECT count(*) FROM avatar_frame) AS frames, (SELECT count(*) FROM coin_wallet) AS wallets,
        (SELECT count(*) FROM coin_ledger) AS ledger, (SELECT count(*) FROM user_avatar_frame) AS ownership`)
    expect(result.rows[0]).toEqual({
      frames: "0",
      wallets: "0",
      ledger: "0",
      ownership: "0",
    })
    const topics = await connection.db.select().from(avatarFrameTopic)
    const chests = await connection.db.select().from(shopChest)
    expect(chests).toHaveLength(topics.length + 1)
    expect(
      chests.every(
        (row) => !row.saleEnabled && row.version === 1 && row.retiredAt === null
      )
    ).toBe(true)
    expect(
      chests
        .filter((row) => row.kind === "topic")
        .map((row) => row.topicId)
        .sort()
    ).toEqual(topics.map((row) => row.id).sort())
    expect(await connection.db.select().from(shopGachaState)).toEqual([])
    expect(await connection.db.select().from(shopGachaRoll)).toEqual([])
    const common = chests.find((row) => row.kind === "common")!
    await connection.db
      .update(shopChest)
      .set({ saleEnabled: true, version: 2 })
      .where(eq(shopChest.id, common.id))
    await migrate(connection.db, { migrationsFolder: migrations })
    await migrate(connection.db, { migrationsFolder: migrations })
    await migrate(connection.db, { migrationsFolder: migrations })
    expect(
      (await connection.db.select().from(shopChest)).find(
        (row) => row.id === common.id
      )
    ).toMatchObject({ saleEnabled: true, version: 2 })
    expect(await connection.db.select().from(shopChest)).toHaveLength(
      chests.length
    )
  })

  test("chests enforce unique identities and retirement cannot turn a topic into common", async () => {
    await constraint(
      connection.db.insert(shopChest).values({ kind: "common" }),
      "23505"
    )
    for (const invalid of [
      { kind: "topic" as const },
      { kind: "common" as const, topicName: "Not a topic" },
      { kind: "topic" as const, topicName: "", topicId: randomUUID() },
      {
        kind: "topic" as const,
        topicName: "Archived",
        retiredAt: new Date(),
        saleEnabled: true,
      },
    ])
      await constraint(connection.db.insert(shopChest).values(invalid))
    const [topic] = await connection.db
      .insert(avatarFrameTopic)
      .values({ name: `New topic ${randomUUID()}` })
      .returning()
    await connection.db
      .insert(shopChest)
      .values({ kind: "topic", topicId: topic!.id, topicName: topic!.name })
    const [chest] = await connection.db
      .select()
      .from(shopChest)
      .where(eq(shopChest.topicId, topic!.id))
    expect(chest).toMatchObject({
      saleEnabled: false,
      kind: "topic",
      version: 1,
    })
    await constraint(
      connection.db.insert(shopChest).values({
        kind: "topic",
        topicId: topic!.id,
        topicName: topic!.name,
      }),
      "23505"
    )
    await constraint(
      connection.db
        .update(shopChest)
        .set({ saleEnabled: true })
        .where(eq(shopChest.id, chest!.id))
    )
    await connection.db
      .update(shopChest)
      .set({ saleEnabled: true, version: 2 })
      .where(eq(shopChest.id, chest!.id))
    await constraint(
      connection.db
        .update(shopChest)
        .set({ kind: "common", topicId: null, topicName: null, version: 3 })
        .where(eq(shopChest.id, chest!.id))
    )
    await connection.db
      .delete(avatarFrameTopic)
      .where(eq(avatarFrameTopic.id, topic!.id))
    const [retired] = await connection.db
      .select()
      .from(shopChest)
      .where(eq(shopChest.id, chest!.id))
    expect(retired).toMatchObject({
      kind: "topic",
      topicId: null,
      topicName: topic!.name,
      saleEnabled: false,
      version: 3,
    })
    expect(retired!.retiredAt).not.toBeNull()
    await constraint(
      connection.db
        .update(shopChest)
        .set({ saleEnabled: true, version: 4 })
        .where(eq(shopChest.id, chest!.id))
    )
    await constraint(
      connection.db.delete(shopChest).where(eq(shopChest.id, chest!.id))
    )
    await constraint(connection.db.execute(sql`TRUNCATE shop_chest CASCADE`))
  })

  test("pity starts empty and enforces counters and BIGINT boundaries", async () => {
    const actor = await account()
    const [state] = await connection.db
      .insert(shopGachaState)
      .values({ userId: actor })
      .returning()
    expect(state).toMatchObject({ sinceSr: 0, sinceSsr: 0, rollCount: 0n })
    for (const patch of [
      { sinceSr: -1 },
      { sinceSr: 10 },
      { sinceSsr: 50 },
      { sinceSr: 1 },
      { rollCount: -1n },
    ])
      await constraint(
        connection.db
          .update(shopGachaState)
          .set(patch)
          .where(eq(shopGachaState.userId, actor))
      )
    await constraint(
      connection.db.insert(shopGachaState).values({ userId: actor }),
      "23505"
    )
    await constraint(
      connection.db
        .update(shopGachaState)
        .set({ rollCount: MAX_COIN + 1n })
        .where(eq(shopGachaState.userId, actor)),
      "22003"
    )
    await connection.db
      .update(shopGachaState)
      .set({ sinceSr: 9, sinceSsr: 49, rollCount: MAX_COIN })
      .where(eq(shopGachaState.userId, actor))
    expect(
      (
        await connection.db
          .select()
          .from(shopGachaState)
          .where(eq(shopGachaState.userId, actor))
      )[0]!.rollCount
    ).toBe(MAX_COIN)
  })

  test("all rarities accept debit then exact duplicate refund, new frames have no refund", async () => {
    for (const rarity of ["R", "SR", "SSR"] as const)
      for (const duplicate of [false, true]) {
        const row = await draft(rarity, duplicate)
        const receipt = await commitRoll(row)
        expect(receipt.ruleSnapshot).toEqual(NORMAL_GACHA_RULE)
        const entries = await connection.db
          .select()
          .from(coinLedger)
          .where(eq(coinLedger.operationKey, row.coinOperationKey))
          .orderBy(coinLedger.position)
        expect(entries).toHaveLength(duplicate ? 2 : 1)
        expect(entries[0]).toMatchObject({
          mode: "debit",
          delta: -5n,
          balanceAfter: 95n,
        })
        if (duplicate)
          expect(entries[1]).toMatchObject({
            mode: "credit",
            delta: row.refund,
            balanceAfter: 95n + row.refund,
          })
        const [wallet] = await connection.db
          .select()
          .from(coinWallet)
          .where(eq(coinWallet.userId, row.actorUserId))
        expect(wallet!.balance).toBe(95n + row.refund)
      }
  })

  test("invalid rule, refund, counters, quote snapshots and FK roll back money", async () => {
    const row = await draft()
    for (const patch of [
      { fingerprint: "bad" },
      { poolDigest: "bad" },
      { price: 0n },
      { price: 6n },
      { ruleVersion: 2 },
      { ruleSnapshot: { ...NORMAL_GACHA_RULE, price: "6" } },
      { refund: 5n },
      { duplicate: true, refund: 1n },
      { frameVersion: 0 },
      { chestVersion: 0 },
      { rollSequence: 0n },
      { sinceSrBefore: 1 },
      { sinceSsrAfter: 0 },
      { chestKind: "topic", topicId: null },
    ])
      await constraint(
        commitRoll({ ...row, ...patch } as typeof shopGachaRoll.$inferInsert)
      )
    for (const patch of [{ chestId: randomUUID() }, { frameId: randomUUID() }])
      await constraint(commitRoll({ ...row, ...patch }), "23503")
    const [wallet] = await connection.db
      .select()
      .from(coinWallet)
      .where(eq(coinWallet.userId, row.actorUserId))
    expect(wallet).toMatchObject({ balance: 100n, sequence: 1n })
    expect(
      await connection.db
        .select()
        .from(shopGachaRoll)
        .where(eq(shopGachaRoll.actorUserId, row.actorUserId))
    ).toEqual([])
  })

  test("financial link rejects wrong actor/source/wallet/amount/order and orphan operations at COMMIT", async () => {
    const row = await draft("SSR", true),
      other = await account()
    for (const patch of [
      { actorUserId: null },
      { sourceType: "not-gacha" },
      { sourceId: randomUUID() },
    ])
      await constraint(commitRoll(row, (input) => ({ ...input, ...patch })))
    await constraint(
      commitRoll(row, (input) => ({
        ...input,
        entries: input.entries.map((entry) => ({
          ...entry,
          owner: { kind: "user", id: other },
        })),
      }))
    )
    await constraint(
      commitRoll(row, (input) => ({
        ...input,
        entries: [...input.entries].reverse(),
      }))
    )
    await constraint(
      commitRoll(row, (input) => ({
        ...input,
        entries: input.entries.slice(0, 1),
      }))
    )
    await constraint(
      commitRoll(row, (input) => ({
        ...input,
        entries: [...input.entries, input.entries[0]!],
      }))
    )
    for (const position of [0, 1])
      await constraint(
        commitRoll(row, (input) => ({
          ...input,
          entries: input.entries.map((entry, index) =>
            index === position ? { ...entry, amount: "4" } : entry
          ),
        }))
      )
    await constraint(
      connection.db.transaction((tx) =>
        coin.apply(tx, {
          key: row.coinOperationKey,
          actorUserId: row.actorUserId,
          sourceType: "shop.gacha",
          sourceId: row.id,
          entries: [
            {
              owner: { kind: "user", id: row.actorUserId },
              mode: "debit",
              amount: "5",
            },
          ],
        })
      )
    )
    const [wallet] = await connection.db
      .select()
      .from(coinWallet)
      .where(eq(coinWallet.userId, row.actorUserId))
    expect(wallet).toMatchObject({ balance: 100n, sequence: 1n })
  })

  test("a concurrent extra ledger entry cannot attach to an in-flight receipt", async () => {
    const row = await draft("SSR", true)
    const [wallet] = await connection.db
      .select()
      .from(coinWallet)
      .where(eq(coinWallet.userId, row.actorUserId))
    let release!: () => void, ready!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const prepared = new Promise<void>((resolve) => {
      ready = resolve
    })
    const winner = connection.db.transaction(async (tx) => {
      await coin.apply(tx, {
        key: row.coinOperationKey,
        actorUserId: row.actorUserId,
        sourceType: "shop.gacha",
        sourceId: row.id,
        entries: [
          {
            owner: { kind: "user", id: row.actorUserId },
            mode: "debit",
            amount: "5",
          },
          {
            owner: { kind: "user", id: row.actorUserId },
            mode: "credit",
            amount: "20",
          },
        ],
      })
      await tx.insert(shopGachaRoll).values(row)
      ready()
      await gate
    })
    await Promise.race([prepared, winner])
    let settled = false
    const rejected = constraint(
      connection.db.insert(coinLedger).values({
        operationKey: row.coinOperationKey,
        walletId: wallet!.id,
        position: 2,
        sequence: 4n,
        mode: "credit",
        requestedAmount: 1n,
        delta: 1n,
        balanceAfter: 116n,
      }),
      ["23503", "23514"]
    ).finally(() => {
      settled = true
    })
    try {
      let blocked = false
      for (let attempt = 0; attempt < 100 && !blocked && !settled; attempt++) {
        const pending = await connection.pool.query<{ blocked: boolean }>(`
            SELECT EXISTS (SELECT 1 FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'
                AND query ILIKE 'insert into "coin_ledger"%') AS blocked`)
        blocked = pending.rows[0]!.blocked
        if (!blocked) await new Promise((resolve) => setTimeout(resolve, 10))
      }
      // The FK can reject an uncommitted operation immediately, or wait for it.
      expect(blocked || settled).toBe(true)
    } finally {
      release()
      await winner
      await rejected
    }
    expect(
      await connection.db
        .select()
        .from(coinLedger)
        .where(eq(coinLedger.operationKey, row.coinOperationKey))
    ).toHaveLength(2)
  })

  test("receipt is append-only, operation unique, later metadata or topic deletion cannot rewrite it", async () => {
    const row = await draft("SSR", true)
    const [topic] = await connection.db
      .insert(avatarFrameTopic)
      .values({ name: `Historical topic ${randomUUID()}` })
      .returning()
    await connection.db
      .insert(shopChest)
      .values({ kind: "topic", topicId: topic!.id, topicName: topic!.name })
    const [chest] = await connection.db
      .select()
      .from(shopChest)
      .where(eq(shopChest.topicId, topic!.id))
    const receipt = await commitRoll({
      ...row,
      chestId: chest!.id,
      chestKind: "topic",
      chestName: topic!.name,
      topicId: topic!.id,
    })
    await connection.db
      .update(avatarFrame)
      .set({ name: "Renamed", rarity: "R" })
      .where(eq(avatarFrame.id, row.frameId))
    await connection.db
      .delete(avatarFrameTopic)
      .where(eq(avatarFrameTopic.id, topic!.id))
    expect(
      (
        await connection.db
          .select()
          .from(shopGachaRoll)
          .where(eq(shopGachaRoll.id, receipt.id))
      )[0]
    ).toEqual(receipt)
    await constraint(
      connection.db
        .insert(shopGachaRoll)
        .values({ ...receipt, id: randomUUID() }),
      "23505"
    )
    await constraint(
      connection.db
        .update(shopGachaRoll)
        .set({ refund: 0n })
        .where(eq(shopGachaRoll.id, receipt.id))
    )
    await constraint(
      connection.db
        .delete(shopGachaRoll)
        .where(eq(shopGachaRoll.id, receipt.id))
    )
    await constraint(connection.db.execute(sql`TRUNCATE shop_gacha_roll`))
    await constraint(
      connection.db
        .delete(avatarFrame)
        .where(eq(avatarFrame.id, receipt.frameId)),
      "23503"
    )
    const [entry] = await connection.db
      .select()
      .from(coinLedger)
      .where(eq(coinLedger.operationKey, row.coinOperationKey))
      .orderBy(coinLedger.position)
    await constraint(
      connection.db.insert(coinLedger).values({
        operationKey: row.coinOperationKey,
        walletId: entry!.walletId,
        position: 2,
        sequence: entry!.sequence + 2n,
        mode: "credit",
        requestedAmount: 1n,
        delta: 1n,
        balanceAfter: 116n,
      })
    )
  })
})
