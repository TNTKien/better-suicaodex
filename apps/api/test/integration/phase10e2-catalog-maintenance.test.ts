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
import { eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { createDatabase } from "../../src/db/client"
import {
  avatarFrame,
  avatarFrameTopic,
  user,
  userProfile,
} from "../../src/db/schema"
import {
  createAvatarFrame,
  setFrameOwnership,
  updateAvatarFrame,
  updateAvatarFrameShop,
} from "../../src/features/avatar-frames/service"
import { maintenanceTarget } from "../../src/shared/maintenance-target"
import { reconcileCoinDatabase } from "../../src/features/coin/reconciliation"
import { createCoinService } from "../../src/features/coin/service"
import {
  applyCatalog,
  checkedAssets,
  exportCatalog,
  inspectCatalog,
  sealCatalog,
  type CatalogDocument,
} from "../../src/features/shop/catalog-maintenance"
import { reconcileShopDatabase } from "../../src/features/shop/reconciliation"
import { purchaseAvatarFrame } from "../../src/features/shop/service"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>, admin: string
const assetBaseUrl = "https://assets.example.com",
  coin = createCoinService({ enabled: true })
const target = () => maintenanceTarget(process.env.TEST_DATABASE_URL!)
function item(patch: Record<string, unknown> = {}) {
  const id = randomUUID()
  return {
    id,
    code: `catalog-${id}`,
    name: "Catalog fixture",
    description: "",
    topicId: null,
    rarity: "SR" as const,
    limited: false,
    displayScale: 135,
    offsetX: -4,
    offsetY: 6,
    assetKey: `avatar-frames/${id}/frame.webp`,
    previewKey: `avatar-frames/${id}/preview.webp`,
    width: 318,
    height: 318,
    frameCount: 1,
    byteSize: 1000,
    previewByteSize: 900,
    sha256: "a".repeat(64),
    previewSha256: "b".repeat(64),
    sourceSha256: "c".repeat(64),
    loop: null,
    delays: [],
    ...patch,
  }
}
function document(
  frames = [item()],
  topics: Array<{ id: string; name: string }> = []
): CatalogDocument {
  return sealCatalog({
    format: 2,
    source: { ...target(), database: "source_fixture_test" },
    capturedAt: "2026-10-05T00:00:00.000Z",
    excluded: { disabled: 2, notReady: 0 },
    frames,
    topics,
  })
}
async function account(role = "user") {
  const id = randomUUID()
  await connection.db
    .insert(user)
    .values({ id, role, name: "Catalog fixture", email: `${id}@example.com` })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
async function row(id: string) {
  const [row] = await connection.db
    .select()
    .from(avatarFrame)
    .where(eq(avatarFrame.id, id))
  return row!
}
function apply(input: CatalogDocument, actor = admin) {
  // Object transport/hash tests live in shop-catalog.test.ts; no real S3 access in fixtures.
  return applyCatalog(
    connection.db,
    actor,
    input,
    assetBaseUrl,
    checkedAssets(input, assetBaseUrl, {
      verified: input.snapshot.frames.length * 2,
      errors: [],
    })
  )
}
async function failure(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (error: unknown) => error
  )
  expect(error).toMatchObject({ code })
}
async function state() {
  const result = await connection.db.execute<{
    state: string
  }>(sql`SELECT jsonb_build_object(
    'frames', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM avatar_frame f),
    'topics', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM avatar_frame_topic t),
    'audit', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM moderation_action a),
    'ownership', (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.user_id, f.frame_id) FROM user_avatar_frame f),
    'wallet', (SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM coin_wallet w),
    'ledger', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM coin_ledger l),
    'purchases', (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM shop_purchase p)
  )::text AS state`)
  return result.rows[0]!.state
}
async function failAudits(work: () => Promise<void>) {
  await connection.db.execute(
    sql`CREATE FUNCTION shop_catalog_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$`
  )
  try {
    await connection.db.execute(
      sql`CREATE TRIGGER shop_catalog_test_failure BEFORE INSERT ON moderation_action FOR EACH ROW EXECUTE FUNCTION shop_catalog_test_failure()`
    )
    await work()
  } finally {
    await connection.db.execute(
      sql`DROP TRIGGER IF EXISTS shop_catalog_test_failure ON moderation_action`
    )
    await connection.db.execute(sql`DROP FUNCTION shop_catalog_test_failure()`)
  }
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.2F/G catalog and stock maintenance",
  () => {
    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!,
        parsed = new URL(url)
      if (
        !parsed.pathname.endsWith("_test") ||
        !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
        url === process.env.DATABASE_URL
      )
        throw new Error(
          "Use an isolated loopback database ending in _test; financial fixtures are retained"
        )
      connection = createDatabase(url)
      connection.pool.options.options =
        "-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=5000"
      await migrate(connection.db, {
        migrationsFolder: fileURLToPath(
          new URL("../../drizzle", import.meta.url)
        ),
      })
      admin = await account("admin")
    })
    afterAll(async () => {
      await connection?.pool.end()
    })

    test("read-only export/diff keep source-disabled frames and personal/financial state out of manifest", async () => {
      const [topic] = await connection.db
        .insert(avatarFrameTopic)
        .values({ name: `Source ${randomUUID()}` })
        .returning()
      const source = item({ topicId: topic!.id }),
        disabled = item()
      await connection.db.insert(avatarFrame).values([
        { ...source, active: true, shopPrice: 15n, shopStock: 0 },
        { ...disabled, active: false, shopPrice: 100n, shopStock: 0 },
      ])
      const before = await state(),
        snapshot = await exportCatalog(connection.db, target())
      expect(snapshot.snapshot.frames.map((r) => r.id)).toContain(source.id)
      expect(snapshot.snapshot.frames.map((r) => r.id)).not.toContain(
        disabled.id
      )
      expect(snapshot.snapshot.excluded.disabled).toBeGreaterThan(0)
      expect(snapshot.snapshot.topics).toContainEqual({
        id: topic!.id,
        name: topic!.name,
      })
      for (const forbidden of [
        "shopStock",
        "shopPrice",
        "userId",
        "wallet",
        "ownership",
        "secret",
        "appliedAt",
      ])
        expect(JSON.stringify(snapshot)).not.toContain(forbidden)
      expect((await inspectCatalog(connection.db, snapshot)).conflicts).toEqual(
        []
      )
      expect(await state()).toBe(before)
    })

    test("import preserves IDs/asset bytes and owner rarity/limited; rerun preserves admin commerce and creates no ownership", async () => {
      const topic = { id: randomUUID(), name: `Discord ${randomUUID()}` }
      const input = document(
        [
          item({ topicId: topic.id }),
          item({ rarity: "SSR", limited: true, topicId: topic.id }),
        ],
        [topic]
      )
      const diff = await inspectCatalog(connection.db, input)
      expect(diff.newFrames).toHaveLength(2)
      expect(diff.newTopics).toEqual([topic.id])
      await apply(input)
      for (const source of input.snapshot.frames) {
        const current = await row(source.id)
        expect(current).toMatchObject({
          ...source,
          active: true,
          shopStock: 0,
          shopVersion: 1,
        })
        expect(current.shopPrice).toBe(source.rarity === "SSR" ? 100n : 15n)
        expect(current.activatedAt).not.toBeNull()
      }
      const selected = await row(input.snapshot.frames[0]!.id)
      await updateAvatarFrameShop(connection.db, admin, selected.id, {
        expectedVersion: selected.version,
        expectedShopVersion: selected.shopVersion,
        price: "29",
      })
      const before = await state()
      const repeated = await apply(input)
      expect(repeated.newFrames).toEqual([])
      expect(repeated.matchingFrames).toHaveLength(2)
      expect(await state()).toBe(before)
      expect((await row(selected.id)).shopPrice).toBe(29n)
      const own = await connection.db.execute<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM user_avatar_frame`
      )
      expect(own.rows[0]!.count).toBe("0")
    })

    test("identity/metadata/topic conflicts never overwrite or partially import; exact missing price is initialized only once", async () => {
      const input = document(),
        original = input.snapshot.frames[0]!
      await apply(input)
      const conflicts = [
        document([{ ...original, name: "Changed source" }]),
        document([{ ...original, id: randomUUID() }]),
        document([{ ...original, code: "new-code" }]),
        document([
          { ...original, assetKey: "avatar-frames/changed/frame.webp" },
        ]),
      ]
      for (const conflict of conflicts) {
        const before = await state()
        expect(
          (await inspectCatalog(connection.db, conflict)).conflicts
        ).toHaveLength(1)
        await failure(apply(conflict), "CATALOG_CONFLICT")
        expect(await state()).toBe(before)
      }
      const [topic] = await connection.db
        .insert(avatarFrameTopic)
        .values({ name: `Conflict ${randomUUID()}` })
        .returning()
      const collision = { id: randomUUID(), name: topic!.name }
      const topicInput = document(
        [item({ topicId: collision.id })],
        [collision]
      )
      expect(
        (await inspectCatalog(connection.db, topicInput)).conflicts
      ).toEqual([`topic:${collision.id}`])
      await failure(apply(topicInput), "CATALOG_CONFLICT")
      await connection.db
        .update(avatarFrame)
        .set({ shopPrice: null })
        .where(eq(avatarFrame.id, original.id))
      const missing = await row(original.id)
      expect(
        (await inspectCatalog(connection.db, input)).missingPrices
      ).toEqual([original.id])
      await apply(input)
      expect(await row(original.id)).toMatchObject({
        shopPrice: 15n,
        version: missing.version + 1,
        shopVersion: missing.shopVersion + 1,
        shopStock: 0,
      })
      const before = await state()
      await apply(input)
      expect(await state()).toBe(before)
    })

    test("bad asset checks, restricted actors and failed audits leave the entire catalog unchanged", async () => {
      const input = document(),
        before = await state()
      const check = checkedAssets(input, assetBaseUrl, {
        verified: 2,
        errors: [],
      })
      await failure(
        applyCatalog(connection.db, admin, input, assetBaseUrl, {
          ...check,
          manifestSha256: "0".repeat(64),
        }),
        "ASSET_CHECK_MISMATCH"
      )
      await failure(
        applyCatalog(connection.db, admin, input, assetBaseUrl, {
          ...check,
          verified: 0,
        }),
        "ASSETS_NOT_VERIFIED"
      )
      await failure(apply(input, await account()), "FORBIDDEN")
      const blocked = await account("admin")
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, blocked))
      await failure(apply(input, blocked), "FORBIDDEN")
      expect(await state()).toBe(before)
      await failAudits(async () => {
        const error = await apply(input).then(
          () => null,
          (error: unknown) => error
        )
        expect(error).not.toBeNull()
        expect(await state()).toBe(before)
      })
      expect((await apply(input)).newFrames).toEqual([
        input.snapshot.frames[0]!.id,
      ])
    })
    test("purchase, revoke/rebuy and admin stock changes reconcile without reset; new frames stay stock zero and rarity preserves price", async () => {
      const [candidate] = await connection.db
        .select()
        .from(avatarFrame)
        .where(eq(avatarFrame.active, true))
        .limit(1)
      if (!candidate) throw new Error("Missing frame fixture")
      await updateAvatarFrameShop(connection.db, admin, candidate.id, {
        expectedVersion: candidate.version,
        expectedShopVersion: candidate.shopVersion,
        price: "15",
        stock: 10,
      })
      const selected = await row(candidate.id)
      const actor = await account()
      await connection.db.transaction((tx) =>
        coin.apply(tx, {
          key: `catalog-credit:${randomUUID()}`,
          actorUserId: actor,
          sourceType: "fixture.credit",
          sourceId: actor,
          entries: [
            {
              owner: { kind: "user", id: actor },
              mode: "credit",
              amount: "1000",
            },
          ],
        })
      )
      let invalidations = 0
      const deps = {
        database: connection.db,
        coin,
        shopEnabled: true,
        avatarFramesEnabled: true,
        assetBaseUrl,
        cache: {
          invalidateCatalog: async () => {
            invalidations++
            throw new Error("Redis unavailable")
          },
        },
      }
      const quote = {
        operationId: randomUUID(),
        frameId: selected.id,
        expectedFrameVersion: selected.version,
        expectedPrice: selected.shopPrice!.toString(),
      }
      const receipt = await purchaseAvatarFrame(deps, actor, quote)
      expect((await row(selected.id)).shopStock).toBe(9)
      await setFrameOwnership(
        connection.db,
        admin,
        actor,
        selected.id,
        false,
        "Fixture revoke"
      )
      await purchaseAvatarFrame(deps, actor, {
        ...quote,
        operationId: randomUUID(),
      })
      expect((await row(selected.id)).shopStock).toBe(8)
      expect(invalidations).toBe(0) // Purchase is no-store/DB-only, no post-payment cache dependency.
      expect(
        await purchaseAvatarFrame({ ...deps, shopEnabled: false }, actor, quote)
      ).toEqual(receipt)
      expect((await row(selected.id)).shopStock).toBe(8)
      let current = await row(selected.id)
      await updateAvatarFrameShop(connection.db, admin, current.id, {
        expectedVersion: current.version,
        expectedShopVersion: current.shopVersion,
        price: "41",
        stock: 3,
      })
      current = await row(selected.id)
      await updateAvatarFrame(connection.db, admin, current.id, {
        expectedVersion: current.version,
        rarity: "R",
      })
      expect((await row(selected.id)).shopPrice).toBe(41n)
      expect((await reconcileShopDatabase(connection.db)).matches).toBe(true)
      expect((await reconcileCoinDatabase(connection.db)).matches).toBe(true)
      expect((await row(selected.id)).shopStock).toBe(3)
      const created = await createAvatarFrame(connection.db, admin, {
        code: `late-${randomUUID()}`,
        name: "After launch",
        rarity: "R",
        limited: false,
        description: "",
        topicId: null,
      })
      expect(created).toMatchObject({ shopStock: 0, shopPrice: 5n })
      // Detect a raw stock write that bypasses the audit, then restore test-only state.
      current = await row(selected.id)
      await connection.db
        .update(avatarFrame)
        .set({ shopStock: 7 })
        .where(eq(avatarFrame.id, current.id))
      expect((await reconcileShopDatabase(connection.db)).stockErrors).not.toBe(
        "0"
      )
      await connection.db
        .update(avatarFrame)
        .set({ shopStock: current.shopStock })
        .where(eq(avatarFrame.id, current.id))
      expect((await reconcileShopDatabase(connection.db)).matches).toBe(true)
    })
  }
)
