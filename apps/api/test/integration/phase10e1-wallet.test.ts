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
import { parseISO } from "date-fns"
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createDatabase } from "../../src/db/client"
import {
  chapter,
  coinCommentReward,
  coinLedger,
  coinOperation,
  coinViewReceipt,
  coinWallet,
  comment,
  manga,
  mangaGroup,
  organization,
  translationGroupProfile,
  user,
} from "../../src/db/schema"
import {
  MAX_COIN,
  CoinReceiptSchema,
  type CoinOperation,
  type CoinOwner,
} from "../../src/features/coin/contract"
import { eligibleCoinGroups } from "../../src/features/coin/policy"
import {
  createCoinService,
  reconcileCoinWallet,
} from "../../src/features/coin/service"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>
const coin = createCoinService({ enabled: true })
const operation = (
  entries: CoinOperation["entries"],
  key = `test:${randomUUID()}`
): CoinOperation => ({
  key,
  entries,
  actorUserId: null,
  sourceType: "test",
  sourceId: key,
})
const apply = (input: CoinOperation) =>
  connection.db.transaction((tx) => coin.apply(tx, input))
async function account(): Promise<CoinOwner> {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, name: "Coin fixture", email: `coin-${id}@example.com` })
  return { kind: "user", id }
}
async function group(
  overrides: Partial<typeof translationGroupProfile.$inferInsert> = {}
): Promise<CoinOwner> {
  const id = randomUUID()
  await connection.db.insert(organization).values({
    id,
    name: "Coin group",
    slug: `coin-${id}`,
    createdAt: new Date(),
  })
  await connection.db.insert(translationGroupProfile).values({
    organizationId: id,
    approvalStatus: "approved",
    publicationState: "published",
    ...overrides,
  })
  return { kind: "group", id }
}
async function balance(owner: CoinOwner, amount: string) {
  expect(await reconcileCoinWallet(connection.db, owner)).toMatchObject({
    balance: amount,
    ledgerBalance: amount,
    matches: true,
  })
}
async function constraint(action: PromiseLike<unknown>, code = "23514") {
  try {
    await action
  } catch (error) {
    expect(
      (error as { cause?: { code: string } }).cause?.code ??
        (error as { code: string }).code
    ).toBe(code)
    return
  }
  throw new Error(`Expected PostgreSQL constraint ${code}`)
}
async function failure(action: Promise<unknown>) {
  // Await PostgreSQL I/O before invoking matchers (Bun/Windows can otherwise stall).
  const error = await action.then(
    () => null,
    (reason: unknown) => reason
  )
  expect(error).toBeInstanceOf(Error)
  return error
}

describe("10E.1 A-C: coin foundation (PostgreSQL)", () => {
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
    await migrate(connection.db, {
      migrationsFolder: fileURLToPath(
        new URL("../../drizzle", import.meta.url)
      ),
    })
  })
  // Never bypass append-only guards to clean up. Use a disposable test database.
  afterAll(async () => {
    await connection?.pool.end()
  })

  test("lazy wallet creation is serialized; simultaneous distinct credits are all retained", async () => {
    const owner = await account()
    await balance(owner, "0")
    await Promise.all(
      Array.from({ length: 20 }, () =>
        apply(operation([{ owner, mode: "credit", amount: "1" }]))
      )
    )
    await balance(owner, "20")
    expect((await reconcileCoinWallet(connection.db, owner)).sequence).toBe(
      "20"
    )
  })

  test("concurrent same-key retry and replay after commit return the original receipt", async () => {
    const owner = await account()
    const input = operation([{ owner, mode: "credit", amount: "5" }])
    const results = await Promise.all(
      Array.from({ length: 12 }, () => apply(input))
    )
    for (const result of results) expect(result).toEqual(results[0])
    expect(CoinReceiptSchema.parse(results[0])).toEqual(results[0])
    expect(await apply(input)).toEqual(results[0])
    await balance(owner, "5")
    for (const conflicting of [
      { ...input, entries: [{ owner, mode: "credit" as const, amount: "6" }] },
      { ...input, actorUserId: owner.id },
    ]) {
      const result = await failure(apply(conflicting))
      expect(result).toMatchObject({ code: "COIN_IDEMPOTENCY_CONFLICT" })
    }
    await balance(owner, "5")
  })

  test("competing debits cannot overdraw, and failure rolls back lazy-created wallets", async () => {
    const owner = await account()
    await apply(operation([{ owner, mode: "credit", amount: "5" }]))
    const result = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        apply(operation([{ owner, mode: "debit", amount: "4" }]))
      )
    )
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(result.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "COIN_INSUFFICIENT_BALANCE" },
    })
    await balance(owner, "1")
    const empty = await account()
    await connection.db.transaction(async (tx) => {
      expect(
        await failure(
          coin.apply(
            tx,
            operation([{ owner: empty, mode: "debit", amount: "1" }])
          )
        )
      ).toMatchObject({ code: "COIN_INSUFFICIENT_BALANCE" })
      expect(
        await tx
          .select()
          .from(coinWallet)
          .where(eq(coinWallet.userId, empty.id))
      ).toHaveLength(0)
    })
  })

  test("bounded penalties record actual 0/1/2/3 debits; never debt", async () => {
    for (const initial of [0, 1, 2, 3, 4]) {
      const owner = await account()
      if (initial)
        await apply(
          operation([{ owner, mode: "credit", amount: String(initial) }])
        )
      const receipt = await apply(
        operation([{ owner, mode: "penalty", amount: "3" }])
      )
      expect(receipt.entries[0]).toMatchObject({
        requestedAmount: "3",
        delta: String(-Math.min(initial, 3)),
      })
      await balance(owner, String(Math.max(initial - 3, 0)))
    }
  })

  test("BIGINT stays exact above Number.MAX_SAFE_INTEGER; overflow is atomic", async () => {
    const owner = await account()
    await apply(
      operation([{ owner, mode: "credit", amount: "9007199254740993" }])
    )
    await balance(owner, "9007199254740993")
    await apply(
      operation([
        { owner, mode: "credit", amount: String(MAX_COIN - 9007199254740993n) },
      ])
    )
    await balance(owner, String(MAX_COIN))
    expect(
      await failure(apply(operation([{ owner, mode: "credit", amount: "1" }])))
    ).toMatchObject({ code: "COIN_AMOUNT_OVERFLOW" })
    await balance(owner, String(MAX_COIN))
  })

  test("group/user multi-wallet operation conserves coin; opposite input orders do not deadlock", async () => {
    const sender = await group({ inactive: true })
    const recipient = await account()
    await apply(
      operation([
        { owner: sender, mode: "credit", amount: "100" },
        { owner: recipient, mode: "credit", amount: "100" },
      ])
    )
    const receipts = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        apply(
          operation([
            {
              owner: index % 2 ? recipient : sender,
              mode: "debit",
              amount: "1",
            },
            {
              owner: index % 2 ? sender : recipient,
              mode: "credit",
              amount: "1",
            },
          ])
        )
      )
    )
    for (const receipt of receipts)
      expect(
        receipt.entries.reduce((sum, entry) => sum + BigInt(entry.delta), 0n)
      ).toBe(0n)
    await balance(sender, "100")
    await balance(recipient, "100")
  })

  test("same-wallet debit/refund is sequential; future refund cannot fund the debit", async () => {
    const owner = await account()
    const input = operation([
      { owner, mode: "debit", amount: "5" },
      { owner, mode: "credit", amount: "1" },
    ])
    expect(await failure(apply(input))).toMatchObject({
      code: "COIN_INSUFFICIENT_BALANCE",
    })
    await apply(operation([{ owner, mode: "credit", amount: "5" }]))
    expect((await apply(input)).entries.map((e) => e.balanceAfter)).toEqual([
      "0",
      "1",
    ])
    await balance(owner, "1")
  })

  test("outer business failure rolls back balance, ledger and receipt; retry succeeds", async () => {
    const owner = await account()
    const input = operation([{ owner, mode: "credit", amount: "10" }])
    expect(
      await failure(
        connection.db.transaction(async (tx) => {
          await tx
            .update(user)
            .set({ name: "Must roll back" })
            .where(eq(user.id, owner.id))
          await coin.apply(tx, input)
          throw new Error("business failure")
        })
      )
    ).toMatchObject({ message: "business failure" })
    expect(
      (await connection.db.select().from(user).where(eq(user.id, owner.id)))[0]
        ?.name
    ).toBe("Coin fixture")
    expect(
      await connection.db
        .select()
        .from(coinOperation)
        .where(eq(coinOperation.key, input.key))
    ).toHaveLength(0)
    await balance(owner, "0")
    await apply(input)
    await balance(owner, "10")
  })

  test("injected SQL failure at receipt / ledger / balance leaves no partial writes", async () => {
    for (const [table, action] of [
      ["coin_operation", "INSERT"],
      ["coin_ledger", "INSERT"],
      ["coin_wallet", "UPDATE"],
    ]) {
      const owner = await account()
      await apply(operation([{ owner, mode: "credit", amount: "2" }]))
      const input = operation([{ owner, mode: "credit", amount: "8" }])
      const error = await failure(
        connection.db.transaction(async (tx) => {
          await tx.execute(
            sql`CREATE FUNCTION pg_temp.coin_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected coin failure'; END $$`
          )
          await tx.execute(
            sql.raw(
              `CREATE TRIGGER coin_test_failure BEFORE ${action} ON ${table} FOR EACH ROW EXECUTE FUNCTION pg_temp.coin_test_failure()`
            )
          )
          await coin.apply(tx, input)
        })
      )
      expect(error).toMatchObject({
        cause: { message: "injected coin failure" },
      })
      expect(
        await connection.db
          .select()
          .from(coinOperation)
          .where(eq(coinOperation.key, input.key))
      ).toHaveLength(0)
      expect(
        await connection.db
          .select()
          .from(coinLedger)
          .where(eq(coinLedger.operationKey, input.key))
      ).toHaveLength(0)
      await balance(owner, "2")
      await apply(input)
      await balance(owner, "10")
    }
  })

  test("corrections reference original entries; cross-wallet references are rejected", async () => {
    const owner = await account()
    const original = await apply(
      operation([{ owner, mode: "credit", amount: "2" }])
    )
    const referenceLedgerId = original.entries[0]!.id
    await apply(
      operation([{ owner, mode: "debit", amount: "2", referenceLedgerId }])
    )
    await balance(owner, "0")
    expect(
      await failure(
        apply(
          operation([
            {
              owner: await account(),
              mode: "credit",
              amount: "2",
              referenceLedgerId,
            },
          ])
        )
      )
    ).toMatchObject({ code: "COIN_REFERENCE_INVALID" })
  })

  test("DB enforces owners, balances and immutable history; reconciliation detects corruption", async () => {
    const owner = await account()
    const receipt = await apply(
      operation([{ owner, mode: "credit", amount: "2" }])
    )
    const walletId = receipt.entries[0]!.walletId
    await constraint(
      connection.db.insert(coinWallet).values({ userId: owner.id }),
      "23505"
    )
    await constraint(connection.db.insert(coinWallet).values({}))
    await constraint(
      connection.db
        .insert(coinWallet)
        .values({ userId: (await account()).id, groupId: (await group()).id })
    )
    await constraint(
      connection.db
        .update(coinWallet)
        .set({ balance: -1n })
        .where(eq(coinWallet.id, walletId))
    )
    await constraint(
      connection.db
        .update(coinWallet)
        .set({ viewRemainderTenths: 1 })
        .where(eq(coinWallet.id, walletId))
    )
    await constraint(
      connection.db
        .update(coinWallet)
        .set({ userId: (await account()).id })
        .where(eq(coinWallet.id, walletId))
    )
    await constraint(
      connection.db.delete(user).where(eq(user.id, owner.id)),
      "23503"
    )
    await constraint(
      connection.db
        .update(coinLedger)
        .set({ delta: 1n })
        .where(eq(coinLedger.id, receipt.entries[0]!.id))
    )
    await constraint(
      connection.db
        .delete(coinLedger)
        .where(eq(coinLedger.id, receipt.entries[0]!.id))
    )
    await constraint(
      connection.db
        .update(coinOperation)
        .set({ sourceId: "changed" })
        .where(eq(coinOperation.key, receipt.operationKey))
    )
    await constraint(
      connection.db
        .delete(coinOperation)
        .where(eq(coinOperation.key, receipt.operationKey))
    )
    // TRUNCATE is rolled back regardless of outcome and targets only financial tables.
    await constraint(
      connection.db.transaction(async (tx) => {
        await tx.execute(sql`TRUNCATE coin_ledger`)
        throw new Error("truncate unexpectedly allowed")
      })
    )
    await connection.db.transaction(async (tx) => {
      await tx
        .update(coinWallet)
        .set({ balance: 3n })
        .where(eq(coinWallet.id, walletId))
      expect((await reconcileCoinWallet(tx, owner)).matches).toBe(false)
      await tx
        .update(coinWallet)
        .set({ balance: 2n })
        .where(eq(coinWallet.id, walletId))
    })
    await balance(owner, "2")
  })

  test("group policy uses manga attribution, not leadership or inactive; exact exclusions survive rename", async () => {
    const approved = await group()
    const inactive = await group({ inactive: true })
    const pending = await group({ approvalStatus: "pending" })
    const hidden = await group({ publicationState: "draft" })
    const deleted = await group({ deletedAt: new Date() })
    const excluded = await group()
    const unlinked = await group()
    const [system] = await connection.db
      .select()
      .from(organization)
      .where(eq(organization.slug, "system"))
    expect(system).toBeDefined()
    const [story] = await connection.db
      .insert(manga)
      .values({
        ownerGroupId: approved.id,
        slug: `coin-${randomUUID()}`,
        title: "Coin fixture",
        searchTitle: "coin fixture",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
      })
      .returning()
    await connection.db
      .insert(mangaGroup)
      .values(
        [
          approved,
          inactive,
          pending,
          hidden,
          deleted,
          excluded,
          { id: system!.id },
        ].map((g) => ({ mangaId: story!.id, groupId: g.id }))
      )
    await connection.db
      .update(organization)
      .set({ name: "Not an uploader name" })
      .where(eq(organization.id, excluded.id))
    const ids = (
      await eligibleCoinGroups(connection.db, story!.id, [excluded.id])
    ).map((g) => g.groupId)
    expect(ids).toEqual([approved.id, inactive.id].sort())
    expect(ids).not.toContain(unlinked.id)
  })
  test("comment state and rolling-view receipts have database constraints", async () => {
    const owner = await account()
    const team = await group()
    const receipt = await apply(
      operation([{ owner, mode: "credit", amount: "1" }])
    )
    const walletId = receipt.entries[0]!.walletId
    const [story] = await connection.db
      .insert(manga)
      .values({
        ownerGroupId: team.id,
        slug: `coin-${randomUUID()}`,
        title: "Coin states",
        searchTitle: "coin states",
        originalLanguage: "ja",
        status: "ongoing",
        contentRating: "safe",
      })
      .returning()
    const [part] = await connection.db
      .insert(chapter)
      .values({
        ownerGroupId: team.id,
        mangaId: story!.id,
        language: "vi",
        pageCount: 1,
        availablePageCount: 1,
        isFull: true,
      })
      .returning()
    const [root] = await connection.db
      .insert(comment)
      .values({
        userId: owner.id,
        mangaId: story!.id,
        chapterId: part!.id,
        body: "Root on chapter",
      })
      .returning()
    await connection.db
      .insert(coinCommentReward)
      .values({ commentId: root!.id, walletId, rewardedAmount: 1 })
    await constraint(
      connection.db
        .update(coinCommentReward)
        .set({ reversalAmount: 1 })
        .where(eq(coinCommentReward.commentId, root!.id))
    )
    const view = {
      sessionHash: "a".repeat(64),
      chapterId: part!.id,
      mangaId: story!.id,
      acceptedAt: parseISO("2026-10-05T00:00:00Z"),
      expiresAt: parseISO("2026-10-05T12:00:00Z"),
    }
    await connection.db.insert(coinViewReceipt).values(view)
    await constraint(
      connection.db.insert(coinViewReceipt).values(view),
      "23505"
    )
    await constraint(
      connection.db
        .update(coinViewReceipt)
        .set({ expiresAt: view.acceptedAt })
        .where(eq(coinViewReceipt.chapterId, part!.id))
    )
  })
})
