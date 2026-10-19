import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { parseArgs } from "node:util"
import { createDatabase } from "../db/client.js"
import { maintenanceTarget } from "../shared/maintenance-target.js"
import { reconcileCoinDatabase } from "../features/coin/reconciliation.js"
import {
  applyCatalog,
  assertMaintenance,
  CatalogMaintenanceError,
  checkedAssets,
  exportCatalog,
  inspectCatalog,
  validateCatalog,
  verifyCatalogAssets,
} from "../features/shop/catalog-maintenance.js"
import { reconcileShopDatabase } from "../features/shop/reconciliation.js"
import { reconcileGachaDatabase } from "../features/shop/gacha-reconciliation.js"
import { BusinessCache } from "../shared/cache.js"
import { parseRuntimeEnv } from "../shared/env.js"
import { logger } from "../shared/logger.js"
import { createStorages } from "../shared/storage.js"

async function save(path: string, value: unknown, exclusive = false) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
    flag: exclusive ? "wx" : "w",
  })
}
async function main() {
  const { values, positionals } = parseArgs({
    options: {
      manifest: { type: "string", default: ".tmp/shop-catalog/active.json" },
      actor: { type: "string" },
      maintenance: { type: "boolean", default: false },
      "confirm-database": { type: "string" },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: true,
  })
  if (values.help) {
    console.log(`Shop catalog (repository root: bun run shop:catalog COMMAND)
  export       Read source DB; create immutable active/ready catalog manifest
  check        Read target DB, compare identities/metadata and verify S3/CDN bytes
  apply        Import that manifest; never upload assets or copy ownership/stock
  reconcile    Read-only purchase/stock/coin/gacha/pity audit

Mutations require --actor USER_ID --maintenance --confirm-database NAME and
SHOP_ENABLED=false. Stop/drain API, workers; back up target first.
--manifest PATH are relative to apps/api. Exportss
are never overwritten. Use SHOP_MAINTENANCE_DATABASE_URL for direct PostgreSQL
(5432 on VPS), otherwise DATABASE_URL. Target S3 needs only HeadObject/read access.
No backup, migration, deploy, asset upload/deletion or flag activation is performed.`)
    return
  }
  const mode = positionals[0] ?? "check"
  if (
    positionals.length > 1 ||
    !["export", "check", "apply", "reconcile"].includes(mode)
  )
    throw new CatalogMaintenanceError("INVALID_OPTIONS")
  const env = parseRuntimeEnv({
    ...process.env,
    DATABASE_URL:
      process.env.SHOP_MAINTENANCE_DATABASE_URL || process.env.DATABASE_URL,
  })
  const target = maintenanceTarget(env.DATABASE_URL),
    mutation = mode === "apply"
  if (mutation) {
    assertMaintenance(target, {
      maintenance: values.maintenance,
      confirmedDatabase: values["confirm-database"] ?? "",
      shopEnabled: env.SHOP_ENABLED,
    })
    if (!values.actor?.trim() || values.actor.length > 128)
      throw new CatalogMaintenanceError("ADMIN_ACTOR_REQUIRED")
  }
  const { db, pool } = createDatabase(env.DATABASE_URL)
  const progress = (completed: number, total: number) => {
    if (completed % 100 === 0 || completed === total)
      console.log(`Checked S3/CDN objects ${completed}/${total}`)
  }
  pool.on("error", () => {
    console.error(
      "Shop maintenance connection interrupted; rerun with the same manifest"
    )
    process.exitCode = 1
  })
  try {
    console.log(JSON.stringify({ mode, target }))
    const path = resolve(values.manifest)
    const reportPath = `${path}.${mode}.report.json`
    let report: unknown
    if (mode === "export") {
      const document = await exportCatalog(db, target)
      await save(path, document, true)
      report = {
        sha256: document.sha256,
        frames: document.snapshot.frames.length,
        topics: document.snapshot.topics.length,
        excluded: document.snapshot.excluded,
        manifest: path,
      }
    } else if (mode === "reconcile") {
      // One consistent read snapshot while writers may be running.
      report = await db.transaction(
        async (tx) => ({
          shop: await reconcileShopDatabase(tx),
          coin: await reconcileCoinDatabase(tx),
          gacha: await reconcileGachaDatabase(tx),
        }),
        { isolationLevel: "repeatable read", accessMode: "read only" }
      )
      const audit = report as {
        shop: { matches: boolean }
        coin: { matches: boolean }
        gacha: { matches: boolean }
      }
      if (!audit.shop.matches || !audit.coin.matches || !audit.gacha.matches)
        process.exitCode = 1
    } else {
      const document = validateCatalog(JSON.parse(await readFile(path, "utf8")))
      const diff = await inspectCatalog(db, document)
      const storage = createStorages(env).coverStorage
      if (!storage)
        throw new CatalogMaintenanceError("S3_READ_CONFIGURATION_REQUIRED")
      const assets = await verifyCatalogAssets(
        document,
        storage,
        env.ASSET_BASE_URL,
        fetch,
        progress
      )
      report = {
        manifestSha256: document.sha256,
        excluded: document.snapshot.excluded,
        diff,
        assets,
      }
      if (diff.conflicts.length || assets.errors.length) process.exitCode = 1
      else if (mode === "apply") {
        const applied = await applyCatalog(
          db,
          values.actor!,
          document,
          env.ASSET_BASE_URL,
          checkedAssets(document, env.ASSET_BASE_URL, assets)
        )
        console.log(
          "Catalog transaction committed; a rerun preserves existing metadata, prices and stock."
        )
        report = { ...(report as object), applied }
        const cache = new BusinessCache(env, logger)
        try {
          await cache.connect()
          await cache.invalidateCatalog()
        } finally {
          await cache.close()
        }
      }
    }
    await save(reportPath, report)
    console.log(JSON.stringify({ ...(report as object), reportPath }, null, 2))
  } finally {
    await pool.end()
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof CatalogMaintenanceError
      ? error.code
      : "Shop catalog maintenance failed; inspect target/env/schema and keep the same manifest. A lost COMMIT acknowledgement may mean it succeeded; check receipts/marker before retry. Raw errors/credentials are not logged."
  )
  process.exitCode = 1
})
