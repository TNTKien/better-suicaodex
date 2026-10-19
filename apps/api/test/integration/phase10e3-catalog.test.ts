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
import { and, eq, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import sharp from "sharp"
import { createDatabase } from "../../src/db/client"
import {
  avatarFrame,
  avatarFrameTopic,
  moderationAction,
  shopChest,
  user,
  userAvatarFrame,
  userProfile,
} from "../../src/db/schema"
import {
  createAvatarFrame,
  deleteFrameTopic,
  publishAvatarFrame,
  saveFrameTopic,
  setFrameOwnership,
  updateAvatarFrame,
  updateAvatarFrameShop,
} from "../../src/features/avatar-frames/service"
import { CreateAvatarFrameSchema } from "../../src/features/avatar-frames/contract"
import { normalizeFrame } from "../../src/shared/avatar-frame-media"
import {
  applyCatalog,
  checkedAssets,
  sealCatalog,
  type CatalogDocument,
} from "../../src/features/shop/catalog-maintenance"
import {
  lockGachaCatalog,
  syncTopicChest,
} from "../../src/features/shop/gacha-catalog"
import {
  getShopChest,
  getShopChestPool,
  listAdminChests,
  listShopChests,
  updateShopChest,
  type GachaDependencies,
} from "../../src/features/shop/gacha-chests"
import { maintenanceTarget } from "../../src/shared/maintenance-target"

setDefaultTimeout(60_000)
let connection: ReturnType<typeof createDatabase>, admin: string, reader: string
const assetBaseUrl = "https://assets.example.com"
const deps = (): GachaDependencies => ({
  database: connection.db,
  assetBaseUrl,
  gachaEnabled: false,
  shopEnabled: false,
  coinEnabled: false,
  avatarFramesEnabled: false,
})
const page = { page: 1, limit: 100 }
async function account(role = "user") {
  const id = randomUUID()
  await connection.db.insert(user).values({
    id,
    role,
    name: "Gacha catalog fixture",
    email: `${id}@example.com`,
  })
  await connection.db.insert(userProfile).values({ userId: id })
  return id
}
function asset(patch: Partial<typeof avatarFrame.$inferInsert> = {}) {
  const id = randomUUID()
  return {
    id,
    code: `frame-${id}`,
    name: "Fixture",
    description: "",
    topicId: null,
    rarity: "SR" as const,
    limited: false,
    displayScale: 125,
    offsetX: 0,
    offsetY: 0,
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
async function frame(patch: Partial<typeof avatarFrame.$inferInsert> = {}) {
  const [row] = await connection.db
    .insert(avatarFrame)
    .values({ ...asset(patch), active: true, shopPrice: null, shopStock: 0 })
    .returning()
  return row!
}
async function topic(name = `New game ${randomUUID()}`) {
  return (await saveFrameTopic(connection.db, admin, { name })).data
}
async function chestFor(id: string) {
  return (
    await connection.db
      .select()
      .from(shopChest)
      .where(eq(shopChest.topicId, id))
  )[0]!
}
async function members(topicId: string) {
  return Promise.all(
    (["R", "SR", "SSR"] as const).map((rarity) => frame({ topicId, rarity }))
  )
}
function document(): CatalogDocument {
  const t = { id: randomUUID(), name: `Imported game ${randomUUID()}` }
  return sealCatalog({
    format: 2,
    source: {
      ...maintenanceTarget(process.env.TEST_DATABASE_URL!),
      database: "source_test",
    },
    capturedAt: "2026-10-06T00:00:00.000Z",
    excluded: { disabled: 0, notReady: 0 },
    topics: [t],
    frames: (["R", "SR", "SSR"] as const).map((rarity) =>
      asset({ topicId: t.id, rarity })
    ),
  })
}
function apply(input: CatalogDocument) {
  return applyCatalog(
    connection.db,
    admin,
    input,
    assetBaseUrl,
    checkedAssets(input, assetBaseUrl, {
      verified: input.snapshot.frames.length * 2,
      errors: [],
    })
  )
}
async function failure(work: Promise<unknown>, code: string) {
  const error = await work.then(
    () => null,
    (error: unknown) => error
  )
  expect(error).not.toBeNull()
  expect(
    (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code
  ).toBe(code)
}
async function failInserts(
  table: "shop_chest" | "moderation_action",
  work: () => Promise<void>
) {
  await connection.db.execute(
    sql`CREATE FUNCTION gacha_catalog_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$`
  )
  await connection.db.execute(
    sql.raw(
      `CREATE TRIGGER gacha_catalog_test_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION gacha_catalog_test_failure()`
    )
  )
  try {
    await work()
  } finally {
    await connection.db.execute(
      sql.raw(`DROP TRIGGER gacha_catalog_test_failure ON ${table}`)
    )
    await connection.db.execute(sql`DROP FUNCTION gacha_catalog_test_failure()`)
  }
}
function barrier() {
  let signal!: () => void
  const promise = new Promise<void>((resolve) => {
    signal = resolve
  })
  return { promise, signal }
}
async function blockedByPoolReader(work: () => Promise<unknown>) {
  const locked = barrier(),
    release = barrier()
  const holder = connection.db.transaction(async (tx) => {
    await lockGachaCatalog(tx, "share")
    locked.signal()
    await release.promise
  })
  await locked.promise
  const writer = work()
  let waiting = false
  try {
    for (let n = 0; n < 100; n++) {
      const result = await connection.db.execute(
        sql`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted AND database=(SELECT oid FROM pg_database WHERE datname=current_database())) AS waiting`
      )
      if (result.rows[0]!.waiting) {
        waiting = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    expect(waiting).toBe(true)
  } finally {
    release.signal()
    await holder
  }
  return writer
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "Phase 10E.3C dynamic chest catalog",
  () => {
    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!,
        target = new URL(url)
      if (
        !target.pathname.endsWith("_test") ||
        !["127.0.0.1", "localhost"].includes(target.hostname) ||
        url === process.env.DATABASE_URL
      )
        throw new Error(
          "Use an isolated loopback DB ending in _test; history is retained"
        )
      connection = createDatabase(url)
      connection.pool.options.options =
        "-c timezone=UTC -c statement_timeout=15000 -c lock_timeout=5000"
      await migrate(connection.db, {
        migrationsFolder: fileURLToPath(
          new URL("../../drizzle", import.meta.url)
        ),
      })
      admin = await account("admin")
      reader = await account()
    })
    afterAll(async () => {
      await connection?.pool.end()
    })

    test("new arbitrary topics atomically create one closed chest; retries/races do not reset it", async () => {
      const t = await topic(),
        c = await chestFor(t.id)
      expect(c).toMatchObject({
        kind: "topic",
        topicName: t.name,
        saleEnabled: false,
        version: 1,
        retiredAt: null,
      })
      await connection.db.transaction(async (tx) => {
        await lockGachaCatalog(tx)
        await syncTopicChest(tx, t)
        await syncTopicChest(tx, t)
      })
      expect(await chestFor(t.id)).toEqual(c)
      const name = `Raced ${randomUUID()}`
      const result = await Promise.allSettled([topic(name), topic(name)])
      expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1)
      expect(result.filter((r) => r.status === "rejected")).toHaveLength(1)
      const rows = await connection.db
        .select()
        .from(avatarFrameTopic)
        .where(eq(avatarFrameTopic.name, name))
      expect(rows).toHaveLength(1)
      expect(await chestFor(rows[0]!.id)).toMatchObject({
        saleEnabled: false,
        version: 1,
      })
      const resultList = await listShopChests(deps(), page)
      expect(
        resultList.data.some(
          (row) => row.id === c.id && !row.ready && !row.saleEnabled
        )
      ).toBe(true)
      expect(resultList.rollEnabled).toBe(false)
    })
    test("failure creating a chest rolls back admin topic and catalog import, including audit/frames", async () => {
      const name = `Rollback ${randomUUID()}`,
        input = document()
      await failInserts("shop_chest", async () => {
        await failure(topic(name), "P0001")
        await failure(apply(input), "P0001")
      })
      expect(
        await connection.db
          .select()
          .from(avatarFrameTopic)
          .where(eq(avatarFrameTopic.name, name))
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(avatarFrameTopic)
          .where(eq(avatarFrameTopic.id, input.snapshot.topics[0]!.id))
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(avatarFrame)
          .where(eq(avatarFrame.id, input.snapshot.frames[0]!.id))
      ).toEqual([])
      expect(
        await connection.db
          .select()
          .from(moderationAction)
          .where(eq(moderationAction.targetId, input.snapshot.topics[0]!.id))
      ).toEqual([])
    })
    test("catalog import creates closed chests and replay preserves an admin-open chest", async () => {
      const input = document()
      await apply(input)
      const c = await chestFor(input.snapshot.topics[0]!.id)
      expect(c).toMatchObject({ saleEnabled: false, version: 1 })
      const opened = await updateShopChest(deps(), admin, c.id, {
        expectedVersion: 1,
        saleEnabled: true,
      })
      expect(opened.data).toMatchObject({
        ready: true,
        saleEnabled: true,
        version: 2,
      })
      await apply(input)
      expect(await chestFor(input.snapshot.topics[0]!.id)).toMatchObject({
        id: c.id,
        saleEnabled: true,
        version: 2,
      })
      expect((await getShopChestPool(deps(), c.id, page)).meta.total).toBe(3)
    })
    test("pool filters current metadata, not ownership, prices or stock; common includes Khác and new games", async () => {
      const t = await topic(),
        c = await chestFor(t.id),
        good = await members(t.id)
      await setFrameOwnership(
        connection.db,
        admin,
        reader,
        good[0]!.id,
        true,
        "Fixture"
      )
      const elsewhere = await frame({ rarity: "SSR" }),
        invalid = [
          await frame({ topicId: t.id, limited: true, rarity: "SSR" }),
          await frame({ topicId: t.id, previewKey: "" }),
          await frame({ topicId: t.id, assetKey: "../escape.webp" }),
          await frame({
            topicId: t.id,
            assetKey: "https://untrusted.test/frame.webp",
          }),
          await frame({ topicId: t.id, assetKey: "\\escape.webp" }),
        ]
      const inactive = await frame({ topicId: t.id })
      await updateAvatarFrame(connection.db, admin, inactive.id, {
        expectedVersion: inactive.version,
        active: false,
      })
      invalid.push(inactive)
      const detail = (await getShopChest(deps(), c.id)).data
      expect(detail).toMatchObject({
        ready: true,
        saleEnabled: false,
        pool: { R: 1, SR: 1, SSR: 1, total: 3 },
      })
      const full = await getShopChestPool(deps(), c.id, page)
      expect(full.data.map((r) => r.frame.id).sort()).toEqual(
        good.map((r) => r.id).sort()
      )
      const filtered = await getShopChestPool(deps(), c.id, {
        page: 1,
        limit: 1,
        rarity: "SSR",
      })
      expect(filtered.meta).toEqual({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      })
      expect(filtered.poolDigest).toBe(full.poolDigest)
      expect(
        (await getShopChestPool(deps(), c.id, { page: 2, limit: 2 })).data
      ).toHaveLength(1)
      const common = (await listShopChests(deps(), page)).data.find(
        (r) => r.kind === "common"
      )!
      const commonPool = await getShopChestPool(deps(), common.id, page)
      expect(commonPool.data.map((r) => r.frame.id)).toContain(elsewhere.id)
      for (const row of good)
        expect(commonPool.data.map((r) => r.frame.id)).toContain(row.id)
      for (const row of invalid)
        expect(commonPool.data.map((r) => r.frame.id)).not.toContain(row.id)
      for (const forbidden of [
        "balance",
        "owned",
        "pity",
        "stock",
        "assetKey",
        "sha256",
      ])
        expect(JSON.stringify({ detail, full })).not.toContain(`"${forbidden}"`)
      expect(
        (await getShopChest({ ...deps(), assetBaseUrl: undefined }, c.id)).data
          .ready
      ).toBe(false)
    })
    test("digest ignores presentation, commerce and ownership; relevant pool changes invalidate it", async () => {
      const t = await topic(),
        c = await chestFor(t.id),
        [r] = await members(t.id)
      const digest = async () =>
        (await getShopChest(deps(), c.id)).data.pool.digest
      const original = await digest()
      await updateAvatarFrameShop(connection.db, admin, r!.id, {
        expectedVersion: r!.version,
        expectedShopVersion: r!.shopVersion,
        stock: 9,
        price: "7",
      })
      const [current] = await connection.db
        .select()
        .from(avatarFrame)
        .where(eq(avatarFrame.id, r!.id))
      await updateAvatarFrame(connection.db, admin, r!.id, {
        expectedVersion: current!.version,
        name: "Renamed",
        description: "Presentation only",
        offsetX: 3,
      })
      await setFrameOwnership(
        connection.db,
        admin,
        reader,
        r!.id,
        true,
        "Fixture"
      )
      expect(await digest()).toBe(original)
      await connection.db
        .update(avatarFrame)
        .set({ rarity: "SR" })
        .where(eq(avatarFrame.id, r!.id))
      expect(await digest()).not.toBe(original)
      await connection.db
        .update(avatarFrame)
        .set({ rarity: "R", sha256: "d".repeat(64) })
        .where(eq(avatarFrame.id, r!.id))
      expect(await digest()).not.toBe(original)
      await connection.db
        .update(avatarFrame)
        .set({ sha256: "a".repeat(64) })
        .where(eq(avatarFrame.id, r!.id))
      expect(await digest()).toBe(original)
      const extra = await frame({ topicId: t.id, rarity: "R" })
      expect(await digest()).not.toBe(original)
      await connection.db
        .update(avatarFrame)
        .set({ active: false })
        .where(eq(avatarFrame.id, extra.id))
      expect(await digest()).toBe(original)
    })
    test("rename retains identity/sale and delete retires without turning into common; recreate is closed", async () => {
      const t = await topic(),
        c = await chestFor(t.id),
        [owned] = await members(t.id)
      await setFrameOwnership(
        connection.db,
        admin,
        reader,
        owned!.id,
        true,
        "Fixture"
      )
      const ownership = await connection.db
        .select()
        .from(userAvatarFrame)
        .where(
          and(
            eq(userAvatarFrame.userId, reader),
            eq(userAvatarFrame.frameId, owned!.id)
          )
        )
      await updateShopChest(deps(), admin, c.id, {
        expectedVersion: c.version,
        saleEnabled: true,
      })
      const renamed = await saveFrameTopic(
        connection.db,
        admin,
        { name: `Renamed ${randomUUID()}` },
        { id: t.id, expectedVersion: t.version }
      )
      expect(await chestFor(t.id)).toMatchObject({
        id: c.id,
        topicName: renamed.data.name,
        saleEnabled: true,
        version: 3,
      })
      await deleteFrameTopic(connection.db, admin, t.id, renamed.data.version)
      const [retired] = await connection.db
        .select()
        .from(shopChest)
        .where(eq(shopChest.id, c.id))
      expect(retired).toMatchObject({
        kind: "topic",
        topicId: null,
        topicName: renamed.data.name,
        saleEnabled: false,
        version: 4,
      })
      expect(retired!.retiredAt).not.toBeNull()
      const [retained] = await connection.db
        .select()
        .from(avatarFrame)
        .where(eq(avatarFrame.id, owned!.id))
      expect(retained).toMatchObject({
        topicId: null,
        assetKey: owned!.assetKey,
        shopStock: 0,
      })
      expect(
        await connection.db
          .select()
          .from(userAvatarFrame)
          .where(
            and(
              eq(userAvatarFrame.userId, reader),
              eq(userAvatarFrame.frameId, owned!.id)
            )
          )
      ).toEqual(ownership)
      await failure(getShopChest(deps(), c.id), "NOT_FOUND")
      await failure(
        updateShopChest(deps(), admin, c.id, {
          expectedVersion: 4,
          saleEnabled: true,
        }),
        "NOT_FOUND"
      )
      expect(
        (await listShopChests(deps(), page)).data.some((r) => r.id === c.id)
      ).toBe(false)
      expect(
        (await listAdminChests(deps(), admin, page)).data.find(
          (r) => r.id === c.id
        )
      ).toMatchObject({ blockReason: "retired", topic: { id: null } })
      const again = await topic(renamed.data.name),
        replacement = await chestFor(again.id)
      expect(replacement.id).not.toBe(c.id)
      expect(replacement).toMatchObject({ saleEnabled: false, version: 1 })
    })
    test("admin sale changes validate pool/version/account; no-op and failed audit leave sale intact", async () => {
      const t = await topic(),
        c = await chestFor(t.id)
      await failure(
        updateShopChest(deps(), admin, c.id, {
          expectedVersion: 1,
          saleEnabled: true,
        }),
        "GACHA_POOL_UNAVAILABLE"
      )
      const good = await members(t.id)
      await failure(
        updateShopChest(deps(), reader, c.id, {
          expectedVersion: 1,
          saleEnabled: true,
        }),
        "FORBIDDEN"
      )
      await failure(listAdminChests(deps(), reader, page), "FORBIDDEN")
      const banned = await account("admin")
      await connection.db
        .update(user)
        .set({ banned: true })
        .where(eq(user.id, banned))
      await failure(
        updateShopChest(deps(), banned, c.id, {
          expectedVersion: 1,
          saleEnabled: true,
        }),
        "ACCOUNT_RESTRICTED"
      )
      await failure(
        updateShopChest(deps(), admin, c.id, {
          expectedVersion: 2,
          saleEnabled: true,
        }),
        "GACHA_VERSION_CONFLICT"
      )
      await failInserts("moderation_action", async () => {
        await failure(
          updateShopChest(deps(), admin, c.id, {
            expectedVersion: 1,
            saleEnabled: true,
          }),
          "P0001"
        )
      })
      expect(await chestFor(t.id)).toMatchObject({
        version: 1,
        saleEnabled: false,
      })
      await updateShopChest(deps(), admin, c.id, {
        expectedVersion: 1,
        saleEnabled: true,
      })
      await updateShopChest(deps(), admin, c.id, {
        expectedVersion: 2,
        saleEnabled: true,
      })
      expect(await chestFor(t.id)).toMatchObject({
        version: 2,
        saleEnabled: true,
      })
      expect(
        await connection.db
          .select()
          .from(moderationAction)
          .where(eq(moderationAction.targetId, c.id))
      ).toHaveLength(1)
      await updateAvatarFrame(connection.db, admin, good[2]!.id, {
        expectedVersion: good[2]!.version,
        active: false,
      })
      expect((await getShopChest(deps(), c.id)).data).toMatchObject({
        ready: false,
        saleEnabled: true,
      })
      await failure(
        updateShopChest(deps(), admin, c.id, {
          expectedVersion: 2,
          saleEnabled: true,
        }),
        "GACHA_POOL_UNAVAILABLE"
      )
      await updateShopChest(deps(), admin, c.id, {
        expectedVersion: 2,
        saleEnabled: false,
      })
      expect(await chestFor(t.id)).toMatchObject({
        version: 3,
        saleEnabled: false,
      })
      const [maxTopic] = await connection.db
        .insert(avatarFrameTopic)
        .values({ name: `Max revision ${randomUUID()}` })
        .returning()
      const [maxChest] = await connection.db
        .insert(shopChest)
        .values({
          kind: "topic",
          topicId: maxTopic!.id,
          topicName: maxTopic!.name,
          version: 2147483647,
        })
        .returning()
      await members(maxTopic!.id)
      await failure(
        updateShopChest(deps(), admin, maxChest!.id, {
          expectedVersion: 2147483647,
          saleEnabled: true,
        }),
        "GACHA_VERSION_CONFLICT"
      )
      expect(await chestFor(maxTopic!.id)).toMatchObject({
        saleEnabled: false,
        version: 2147483647,
      })
    })
    test("shared catalog readers coexist; every pool writer waits before touching catalog", async () => {
      const held = barrier(),
        release = barrier()
      const first = connection.db.transaction(async (tx) => {
        await lockGachaCatalog(tx, "share")
        held.signal()
        await release.promise
      })
      await held.promise
      try {
        await connection.db.transaction((tx) => lockGachaCatalog(tx, "share"))
      } finally {
        release.signal()
        await first
      }
      const t = await topic(),
        c = await chestFor(t.id),
        good = await members(t.id)
      await blockedByPoolReader(() =>
        createAvatarFrame(
          connection.db,
          admin,
          CreateAvatarFrameSchema.parse({
            code: `locked-${randomUUID()}`,
            name: "Locked",
            rarity: "R",
          })
        )
      )
      await blockedByPoolReader(() =>
        updateAvatarFrame(connection.db, admin, good[0]!.id, {
          expectedVersion: good[0]!.version,
          name: "Locked change",
        })
      )
      await blockedByPoolReader(() => topic())
      const image = await normalizeFrame(
        await sharp({
          create: {
            width: 16,
            height: 16,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 0.5 },
          },
        })
          .webp()
          .toBuffer()
      )
      await blockedByPoolReader(() =>
        publishAvatarFrame(
          connection.db,
          admin,
          good[1]!.id,
          good[1]!.version,
          {
            asset: `avatar-frames/${good[1]!.id}/new.webp`,
            preview: `avatar-frames/${good[1]!.id}/new-preview.webp`,
          },
          image
        )
      )
      await blockedByPoolReader(() => apply(document()))
      await blockedByPoolReader(() =>
        updateShopChest(deps(), admin, c.id, {
          expectedVersion: 1,
          saleEnabled: true,
        })
      )
      await blockedByPoolReader(() =>
        deleteFrameTopic(connection.db, admin, t.id, t.version)
      )
      const result = await connection.db.execute(
        sql`SELECT (SELECT count(*) FROM coin_wallet)::int AS wallets, (SELECT count(*) FROM coin_ledger)::int AS ledger, (SELECT count(*) FROM shop_gacha_state)::int AS states, (SELECT count(*) FROM shop_gacha_roll)::int AS rolls`
      )
      expect(result.rows[0]).toEqual({
        wallets: 0,
        ledger: 0,
        states: 0,
        rolls: 0,
      })
    })
  }
)
