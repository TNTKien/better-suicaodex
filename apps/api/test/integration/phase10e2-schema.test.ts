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
  coinLedger,
  coinOperation,
  coinWallet,
  shopPurchase,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import { CreateAvatarFrameSchema } from "../../src/features/avatar-frames/contract"
import {
  createAvatarFrame,
  updateAvatarFrame,
} from "../../src/features/avatar-frames/service"
import { MAX_COIN, type CoinOperation } from "../../src/features/coin/contract"
import { createCoinService } from "../../src/features/coin/service"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>
const coin = createCoinService({ enabled: true })
const migrations = fileURLToPath(new URL("../../drizzle", import.meta.url))

async function constraint(action: PromiseLike<unknown>, code = "23514") {
  const error = await Promise.resolve(action).then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).not.toBeNull()
  expect(
    (error as { cause?: { code: string }; code?: string }).cause?.code ??
      (error as { code?: string }).code
  ).toBe(code)
}
async function account(role?: string) {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, role, name: "Shop fixture", email: `shop-${id}@example.com` })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function frame() {
  const [row] = await connection.db
    .insert(avatarFrame)
    .values({
      code: `shop-${randomUUID()}`,
      name: "Shop frame",
      rarity: "SR",
    })
    .returning()
  return row!
}
async function purchase(
  override: Partial<typeof shopPurchase.$inferInsert> = {},
  financial: (operation: CoinOperation) => CoinOperation = (operation) =>
    operation
) {
  const actor = await account()
  const item = await frame()
  const operationId = randomUUID()
  const row = {
    id: randomUUID(),
    actorUserId: actor,
    operationId,
    fingerprint: "b".repeat(64),
    frameId: item.id,
    frameCode: item.code,
    frameName: item.name,
    rarity: item.rarity,
    price: 15n,
    frameVersion: item.version,
    coinOperationKey: `shop.purchase:${actor}:${operationId}`,
    ...override,
  }
  return connection.db.transaction(async (tx) => {
    await coin.apply(tx, {
      key: `fund:${actor}`,
      actorUserId: actor,
      sourceType: "test",
      sourceId: actor,
      entries: [
        { owner: { kind: "user", id: actor }, mode: "credit", amount: "100" },
      ],
    })
    await coin.apply(
      tx,
      financial({
        key: row.coinOperationKey,
        actorUserId: row.actorUserId,
        sourceType: "shop.purchase",
        sourceId: row.id,
        entries: [
          { owner: { kind: "user", id: actor }, mode: "debit", amount: "15" },
        ],
      })
    )
    const [receipt] = await tx.insert(shopPurchase).values(row).returning()
    return receipt!
  })
}

describe.serial(`10E.2B: Shop schema (fresh PostgreSQL)`, () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (
      !url ||
      url === process.env.DATABASE_URL ||
      !new URL(url).pathname.endsWith("_test")
    )
      throw new Error(
        "A separate database ending in _test is required; financial fixtures are retained"
      )
    connection = createDatabase(url)

    await migrate(connection.db, { migrationsFolder: migrations })
  })
  afterAll(async () => {
    await connection?.pool.end()
  })

  test("fresh migration or additive upgrade, then replay without creating/restocking data", async () => {
    const result = await connection.db.execute(sql`
        SELECT (SELECT count(*) FROM avatar_frame) AS frames, (SELECT count(*) FROM coin_wallet) AS wallets,
          (SELECT count(*) FROM coin_operation) AS operations, (SELECT count(*) FROM coin_ledger) AS ledger,
          (SELECT count(*) FROM shop_purchase) AS purchases,
          (SELECT count(*) FROM user_avatar_frame) AS ownership`)
    expect(result.rows[0]).toEqual({
      frames: "0",
      wallets: "0",
      operations: "0",
      ledger: "0",
      purchases: "0",
      ownership: "0",
    })
    const item = await frame()
    await connection.db
      .update(avatarFrame)
      .set({ shopPrice: 23n, shopStock: 3, shopVersion: 2 })
      .where(eq(avatarFrame.id, item.id))
    await migrate(connection.db, { migrationsFolder: migrations })
    const [replayed] = await connection.db
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, item.id))
    expect(replayed).toMatchObject({
      shopPrice: 23n,
      shopStock: 3,
      shopVersion: 2,
    })
  })

  test("price/stock/version boundaries are enforced by PostgreSQL, null price is safe", async () => {
    const item = await frame()
    expect(item).toMatchObject({
      shopPrice: null,
      shopStock: 0,
      shopVersion: 1,
    })
    for (const patch of [
      { shopPrice: 0n },
      { shopPrice: -1n },
      { shopStock: -1 },
      { shopVersion: 0 },
    ])
      await constraint(
        connection.db
          .update(avatarFrame)
          .set(patch)
          .where(eq(avatarFrame.id, item.id))
      )
    await constraint(
      connection.db
        .update(avatarFrame)
        .set({ shopPrice: MAX_COIN + 1n })
        .where(eq(avatarFrame.id, item.id)),
      "22003"
    )
    await constraint(
      connection.db
        .update(avatarFrame)
        .set({ shopStock: 2147483648 })
        .where(eq(avatarFrame.id, item.id)),
      "22003"
    )
    await constraint(
      connection.db
        .update(avatarFrame)
        .set({ shopVersion: 2147483648 })
        .where(eq(avatarFrame.id, item.id)),
      "22003"
    )
    await connection.db
      .update(avatarFrame)
      .set({
        shopPrice: MAX_COIN,
        shopStock: 2147483647,
        shopVersion: 2147483647,
      })
      .where(eq(avatarFrame.id, item.id))
    const [maximum] = await connection.db
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, item.id))
    expect(maximum?.shopPrice).toBe(MAX_COIN)
  })

  test("admin/importer create defaults price only once; rarity edits never change price or stock", async () => {
    const admin = await account("admin")
    for (const rarity of ["R", "SR", "SSR"] as const) {
      const row = await createAvatarFrame(
        connection.db,
        admin,
        CreateAvatarFrameSchema.parse({
          code: `created-${randomUUID()}`,
          name: "New frame",
          rarity,
        })
      )
      expect(row).toMatchObject({
        shopPrice: { R: 5n, SR: 15n, SSR: 100n }[rarity],
        shopStock: 0,
        shopVersion: 1,
      })
      const updated = await updateAvatarFrame(connection.db, admin, row.id, {
        expectedVersion: row.version,
        rarity: "R",
      })
      expect(updated.shopPrice).toBe(row.shopPrice)
      expect(updated.shopStock).toBe(0)
      expect(updated.shopVersion).toBe(1)
    }
  })

  test("receipt snapshots join exactly one debit and survive metadata/ownership changes", async () => {
    const receipt = await purchase()
    await connection.db
      .update(avatarFrame)
      .set({ name: "Renamed", rarity: "R" })
      .where(eq(avatarFrame.id, receipt.frameId))
    await connection.db.insert(userAvatarFrame).values({
      userId: receipt.actorUserId,
      frameId: receipt.frameId,
      source: "purchase",
    })
    await connection.db
      .delete(userAvatarFrame)
      .where(eq(userAvatarFrame.userId, receipt.actorUserId))
    const [preserved] = await connection.db
      .select()
      .from(shopPurchase)
      .where(eq(shopPurchase.id, receipt.id))
    expect(preserved).toEqual(receipt)
    const [ledger] = await connection.db
      .select()
      .from(coinLedger)
      .where(eq(coinLedger.operationKey, receipt.coinOperationKey))
    expect(ledger).toMatchObject({
      position: 0,
      mode: "debit",
      requestedAmount: 15n,
      delta: -15n,
      balanceAfter: 85n,
    })
    await constraint(
      connection.db
        .insert(shopPurchase)
        .values({ ...receipt, id: randomUUID() }),
      "23505"
    )
    await constraint(
      connection.db.insert(shopPurchase).values({
        ...receipt,
        id: randomUUID(),
        coinOperationKey: `unused:${randomUUID()}`,
      }),
      "23505"
    )
    await constraint(
      connection.db
        .delete(avatarFrame)
        .where(eq(avatarFrame.id, receipt.frameId)),
      "23503"
    )
    await constraint(
      connection.db.delete(user).where(eq(user.id, receipt.actorUserId)),
      "23503"
    )
    await constraint(
      connection.db
        .update(shopPurchase)
        .set({ frameName: "Rewritten" })
        .where(eq(shopPurchase.id, receipt.id))
    )
    await constraint(
      connection.db.delete(shopPurchase).where(eq(shopPurchase.id, receipt.id))
    )
    await constraint(connection.db.execute(sql`TRUNCATE shop_purchase`))
    await constraint(
      connection.db.insert(coinLedger).values({
        operationKey: receipt.coinOperationKey,
        position: 1,
        walletId: ledger!.walletId,
        sequence: ledger!.sequence + 1n,
        mode: "debit",
        requestedAmount: 1n,
        delta: -1n,
        balanceAfter: 84n,
      })
    )
  })

  test("invalid financial links and receipt values roll back the entire transaction", async () => {
    const other = await account()
    await connection.db.transaction((tx) =>
      coin.apply(tx, {
        key: `fund:${other}`,
        actorUserId: other,
        sourceType: "test",
        sourceId: other,
        entries: [
          {
            owner: { kind: "user", id: other },
            mode: "credit",
            amount: "100",
          },
        ],
      })
    )
    const before = await connection.db.select().from(coinLedger)
    for (const override of [
      { price: 16n },
      { fingerprint: "invalid" },
      { price: 0n },
      { frameVersion: 0 },
      { actorUserId: "another-buyer" },
      { coinOperationKey: `wrong:${randomUUID()}` },
    ])
      await constraint(purchase(override))
    for (const financial of [
      { actorUserId: null },
      { sourceType: "not-purchase" },
      { sourceId: randomUUID() },
      {
        entries: [
          {
            owner: { kind: "user" as const, id: other },
            mode: "debit" as const,
            amount: "15",
          },
        ],
      },
    ]) {
      await constraint(
        purchase({}, (operation) => ({ ...operation, ...financial }))
      )
    }
    for (const patch of [
      { mode: "credit" as const },
      { mode: "penalty" as const },
      { amount: "14" },
    ])
      await constraint(
        purchase({}, (operation) => ({
          ...operation,
          entries: [{ ...operation.entries[0]!, ...patch }],
        }))
      )
    await constraint(
      purchase({}, (operation) => ({
        ...operation,
        entries: [
          ...operation.entries,
          { ...operation.entries[0]!, amount: "1" },
        ],
      }))
    )
    await constraint(purchase({ frameId: randomUUID() }), "23503")
    const actor = await account()
    const item = await frame()
    await constraint(
      connection.db.insert(shopPurchase).values({
        actorUserId: actor,
        operationId: randomUUID(),
        fingerprint: "a".repeat(64),
        frameId: item.id,
        frameCode: item.code,
        frameName: item.name,
        rarity: "SR",
        price: 15n,
        frameVersion: 1,
        coinOperationKey: "missing-financial-operation",
      }),
      "23503"
    )
    expect(await connection.db.select().from(coinLedger)).toEqual(before)
    expect(
      await connection.db
        .select()
        .from(coinWallet)
        .where(eq(coinWallet.userId, actor))
    ).toEqual([])
    expect(
      await connection.db
        .select()
        .from(coinOperation)
        .where(eq(coinOperation.key, "missing-financial-operation"))
    ).toEqual([])
  })
})
