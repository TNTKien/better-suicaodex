import { eq } from "drizzle-orm"
import { createHash } from "node:crypto"
import sharp from "sharp"
import { z } from "zod"
import type { Database } from "../../db/client.js"
import { avatarFrame, avatarFrameTopic, user } from "../../db/schema.js"
import { frameLimits } from "../../shared/avatar-frame-media.js"
import { stableHash } from "../../shared/cache.js"
import { AvatarFrameAlignmentSchema } from "../../shared/contract.js"
import {
  MaintenanceTargetSchema,
  type MaintenanceTarget,
} from "../../shared/maintenance-target.js"
import type { MediaStorage } from "../../shared/storage.js"
import { formatTimestamp } from "../../shared/timestamp.js"
import { CreateAvatarFrameSchema } from "../avatar-frames/contract.js"
import { audit } from "../avatar-frames/service.js"
import { resolveAssetUrl } from "../catalog/routes.js"
import { requireGroupAdmin, type GroupTransaction } from "../groups/service.js"
import { lockGachaCatalog, syncTopicChest } from "./gacha-catalog.js"

const id = z.uuid().transform((value) => value.toLowerCase())
const hash = z.string().regex(/^[a-f0-9]{64}$/)
// Only immutable frame objects, never URLs or keys in another media namespace.
const key = z
  .string()
  .max(1024)
  .regex(/^avatar-frames\/[a-zA-Z0-9/_-]+\.webp$/)
const topicSchema = z
  .object({ id, name: z.string().trim().min(1).max(160) })
  .strict()
const frameSchema = z
  .object({
    ...CreateAvatarFrameSchema.shape,
    ...AvatarFrameAlignmentSchema.shape,
    id,
    topicId: id.nullable(),
    assetKey: key,
    previewKey: key,
    width: z.number().int().min(1).max(frameLimits.referenceSide),
    height: z.number().int().min(1).max(frameLimits.referenceSide),
    frameCount: z.number().int().min(1).max(frameLimits.frames),
    byteSize: z.number().int().positive().max(frameLimits.animatedOutputBytes),
    previewByteSize: z.number().int().positive().max(frameLimits.outputBytes),
    sha256: hash,
    previewSha256: hash,
    sourceSha256: hash,
    loop: z.number().int().min(0).max(65535).nullable(),
    delays: z.array(z.number().int().min(0).max(65535)).max(frameLimits.frames),
  })
  .strict()
  .refine((row) => !row.limited || row.rarity === "SSR")
  .refine(
    (row) => row.frameCount > 1 || row.byteSize <= frameLimits.outputBytes
  )
  .refine((row) => row.frameCount === 1 || row.delays.length === row.frameCount)
const catalogSchema = z
  .object({
    format: z.literal(2),
    source: MaintenanceTargetSchema,
    capturedAt: z.iso.datetime(),
    excluded: z
      .object({
        disabled: z.number().int().nonnegative(),
        notReady: z.number().int().nonnegative(),
      })
      .strict(),
    topics: z.array(topicSchema).max(10_000),
    frames: z.array(frameSchema).min(1).max(10_000),
  })
  .strict()
export type CatalogSnapshot = z.infer<typeof catalogSchema>
export type CatalogDocument = { snapshot: CatalogSnapshot; sha256: string }
type Frame = typeof avatarFrame.$inferSelect
type Topic = typeof avatarFrameTopic.$inferSelect
type Reader = Pick<Database, "select">
const price = (rarity: Frame["rarity"]) =>
  ({ R: 5n, SR: 15n, SSR: 100n })[rarity]

export class CatalogMaintenanceError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}
function fail(code: string): never {
  throw new CatalogMaintenanceError(code)
}
const sortIds = <T extends { id: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
function unique(values: string[]) {
  if (new Set(values).size !== values.length)
    fail("DUPLICATE_SNAPSHOT_IDENTITY")
}
function frameSnapshot(row: Frame): CatalogSnapshot["frames"][number] {
  return frameSchema.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    topicId: row.topicId,
    rarity: row.rarity,
    limited: row.limited,
    displayScale: row.displayScale,
    offsetX: row.offsetX,
    offsetY: row.offsetY,
    assetKey: row.assetKey,
    previewKey: row.previewKey,
    width: row.width,
    height: row.height,
    frameCount: row.frameCount,
    byteSize: row.byteSize,
    previewByteSize: row.previewByteSize,
    sha256: row.sha256,
    previewSha256: row.previewSha256,
    sourceSha256: row.sourceSha256,
    loop: row.loop,
    delays: row.delays,
  })
}
export function sealCatalog(input: unknown): CatalogDocument {
  const parsed = catalogSchema.safeParse(input)
  if (!parsed.success) fail("INVALID_CATALOG")
  const snapshot = {
    ...parsed.data,
    frames: sortIds(parsed.data.frames),
    topics: sortIds(parsed.data.topics),
  }
  unique(snapshot.frames.map((row) => row.id))
  unique(snapshot.frames.map((row) => row.code))
  unique(snapshot.topics.map((row) => row.id))
  unique(snapshot.topics.map((row) => row.name.toLowerCase()))
  const topics = new Set(snapshot.topics.map((row) => row.id))
  if (snapshot.frames.some((row) => row.topicId && !topics.has(row.topicId)))
    fail("MISSING_SNAPSHOT_TOPIC")
  return { snapshot, sha256: stableHash(snapshot) }
}
export function validateCatalog(input: unknown) {
  const parsed = z
    .object({ snapshot: catalogSchema, sha256: hash })
    .strict()
    .safeParse(input)
  if (!parsed.success) fail("INVALID_CATALOG")
  const sealed = sealCatalog(parsed.data.snapshot)
  if (sealed.sha256 !== parsed.data.sha256) fail("CATALOG_HASH_MISMATCH")
  return sealed
}
export async function exportCatalog(
  database: Database,
  source: MaintenanceTarget
) {
  return database.transaction(
    async (tx) => {
      const frames = await tx.select().from(avatarFrame)
      const topics = await tx.select().from(avatarFrameTopic)
      const selected: CatalogSnapshot["frames"] = []
      const excluded = { disabled: 0, notReady: 0 }
      for (const row of frames) {
        if (!row.active) {
          excluded.disabled++
          continue
        }
        try {
          selected.push(frameSnapshot(row))
        } catch {
          excluded.notReady++
        }
      }
      const selectedTopics = new Set(selected.map((row) => row.topicId))
      return sealCatalog({
        format: 2,
        source,
        capturedAt: formatTimestamp(new Date()),
        excluded,
        frames: selected,
        topics: topics
          .filter((row) => selectedTopics.has(row.id))
          .map(({ id, name }) => ({ id, name })),
      })
    },
    { isolationLevel: "repeatable read", accessMode: "read only" }
  )
}
function catalogDiff(
  document: CatalogDocument,
  frames: Frame[],
  topics: Topic[]
) {
  const result = {
    newFrames: [] as string[],
    matchingFrames: [] as string[],
    missingPrices: [] as string[],
    newTopics: [] as string[],
    conflicts: [] as string[],
  }
  const byId = new Map(frames.map((row) => [row.id, row]))
  const byCode = new Map(frames.map((row) => [row.code, row]))
  const topicsById = new Map(topics.map((row) => [row.id, row]))
  const topicsByName = new Map(
    topics.map((row) => [row.name.trim().toLowerCase(), row])
  )
  for (const topic of document.snapshot.topics) {
    const existing =
      topicsById.get(topic.id) ?? topicsByName.get(topic.name.toLowerCase())
    if (!existing) result.newTopics.push(topic.id)
    else if (existing.id !== topic.id || existing.name !== topic.name)
      result.conflicts.push(`topic:${topic.id}`)
  }
  for (const item of document.snapshot.frames) {
    const existing = byId.get(item.id) ?? byCode.get(item.code)
    if (!existing) {
      result.newFrames.push(item.id)
      continue
    }
    let matches = false
    try {
      matches =
        existing.active &&
        stableHash(frameSnapshot(existing)) === stableHash(item)
    } catch {
      /* Conflict, never repair an existing asset implicitly. */
    }
    if (!matches || byCode.get(item.code)?.id !== item.id)
      result.conflicts.push(`frame:${item.id}`)
    else {
      result.matchingFrames.push(item.id)
      if (existing.shopPrice === null) result.missingPrices.push(item.id)
    }
  }
  return result
}
export async function inspectCatalog(database: Reader, input: unknown) {
  const document = validateCatalog(input)
  const [frames, topics] = await Promise.all([
    database.select().from(avatarFrame),
    database.select().from(avatarFrameTopic),
  ])
  return catalogDiff(document, frames, topics)
}

// One object at a time; bounded buffers, no re-encoding, upload or object deletion.
export async function verifyCatalogAssets(
  input: unknown,
  storage: Pick<MediaStorage, "head">,
  baseUrl: string,
  fetcher = fetch,
  onProgress?: (completed: number, total: number) => void
) {
  const document = validateCatalog(input)
  const url = new URL(baseUrl)
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    fail("INVALID_ASSET_BASE_URL")
  const errors: Array<{
    frameId: string
    kind: "asset" | "preview"
    code: string
  }> = []
  let verified = 0
  for (const frame of document.snapshot.frames)
    for (const kind of ["asset", "preview"] as const) {
      const objectKey = kind === "asset" ? frame.assetKey : frame.previewKey
      const bytes = kind === "asset" ? frame.byteSize : frame.previewByteSize
      const sha256 = kind === "asset" ? frame.sha256 : frame.previewSha256
      try {
        const object = await storage.head(objectKey)
        if (
          object.contentLength !== bytes ||
          object.contentType?.split(";")[0] !== "image/webp"
        )
          fail("S3_METADATA_MISMATCH")
        const response = await fetcher(resolveAssetUrl(baseUrl, objectKey), {
          signal: AbortSignal.timeout(60_000),
          redirect: "error",
        })
        if (
          !response.ok ||
          !response.body ||
          response.headers.get("content-type")?.split(";")[0] !== "image/webp"
        ) {
          await response.body?.cancel()
          fail("DELIVERY_UNAVAILABLE")
        }
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = []
        let size = 0
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > bytes) fail("OBJECT_SIZE_MISMATCH")
            chunks.push(value)
          }
        } finally {
          await reader.cancel()
        }
        const buffer = Buffer.concat(chunks)
        if (
          size !== bytes ||
          createHash("sha256").update(buffer).digest("hex") !== sha256
        )
          fail("OBJECT_HASH_MISMATCH")
        const metadata = await sharp(buffer, {
          animated: true,
          limitInputPixels: frameLimits.sourcePixels,
        }).metadata()
        if (
          metadata.format !== "webp" ||
          metadata.width !== frame.width ||
          (metadata.pageHeight ?? metadata.height) !== frame.height ||
          (metadata.pages ?? 1) !== (kind === "asset" ? frame.frameCount : 1)
        )
          fail("IMAGE_METADATA_MISMATCH")
        if (
          kind === "asset" &&
          frame.frameCount > 1 &&
          (metadata.loop !== frame.loop ||
            stableHash(metadata.delay) !== stableHash(frame.delays))
        )
          fail("ANIMATION_MISMATCH")
        verified++
      } catch (error) {
        errors.push({
          frameId: frame.id,
          kind,
          code:
            error instanceof CatalogMaintenanceError
              ? error.code
              : "OBJECT_UNAVAILABLE",
        })
      }
      onProgress?.(
        verified + errors.length,
        document.snapshot.frames.length * 2
      )
    }
  return { verified, errors }
}
export type CatalogAssetCheck = Awaited<
  ReturnType<typeof verifyCatalogAssets>
> & { manifestSha256: string; assetBaseUrl: string }
export function checkedAssets(
  document: CatalogDocument,
  baseUrl: string,
  check: Awaited<ReturnType<typeof verifyCatalogAssets>>
): CatalogAssetCheck {
  if (
    check.errors.length ||
    check.verified !== document.snapshot.frames.length * 2
  )
    fail("ASSETS_NOT_VERIFIED")
  return { ...check, manifestSha256: document.sha256, assetBaseUrl: baseUrl }
}
async function admin(tx: GroupTransaction, actor: string) {
  await tx
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, actor))
    .for("update")
  await requireGroupAdmin(tx, actor)
}
export function assertMaintenance(
  target: MaintenanceTarget,
  options: {
    maintenance: boolean
    confirmedDatabase: string
    shopEnabled: boolean
  }
) {
  if (
    !options.maintenance ||
    options.confirmedDatabase !== target.database ||
    options.shopEnabled
  )
    fail("MAINTENANCE_REQUIRED")
}
export async function applyCatalog(
  database: Database,
  actor: string,
  input: unknown,
  baseUrl: string,
  assets: CatalogAssetCheck
) {
  const document = validateCatalog(input)
  if (
    assets.manifestSha256 !== document.sha256 ||
    assets.assetBaseUrl !== baseUrl
  )
    fail("ASSET_CHECK_MISMATCH")
  checkedAssets(document, baseUrl, assets)
  return database.transaction(async (tx) => {
    await admin(tx, actor)
    await lockGachaCatalog(tx)
    // ponytail: maintenance catalog is small; lock existing topics/frames in ID order.
    // Replace with selected-key locks only if operator catalogs outgrow 10k frames.
    const topics = await tx
      .select()
      .from(avatarFrameTopic)
      .orderBy(avatarFrameTopic.id)
      .for("update")
    let diff = catalogDiff(
      document,
      await tx.select().from(avatarFrame),
      topics
    )
    if (diff.conflicts.length) fail("CATALOG_CONFLICT")
    for (const item of document.snapshot.topics.filter((row) =>
      diff.newTopics.includes(row.id)
    )) {
      await tx.insert(avatarFrameTopic).values(item)
      await audit(
        tx,
        actor,
        "imported",
        item,
        "Shared S3 catalog import",
        null,
        { ...item, manifestSha256: document.sha256 },
        "avatar_frame_topic"
      )
    }
    // Includes matching topics on retry without resetting sale state or revisions.
    for (const item of document.snapshot.topics) await syncTopicChest(tx, item)
    // Lock topics/chests before frames. Commerce writers skip the catalog lock,
    // so recheck the locked rows before initializing a previously missing price.
    const frames = await tx
      .select()
      .from(avatarFrame)
      .orderBy(avatarFrame.id)
      .for("update")
    diff = catalogDiff(document, frames, topics)
    if (diff.conflicts.length) fail("CATALOG_CONFLICT")
    for (const item of document.snapshot.frames) {
      if (diff.newFrames.includes(item.id)) {
        await tx.insert(avatarFrame).values({
          ...item,
          active: true,
          activatedAt: new Date(),
          shopPrice: price(item.rarity),
          shopStock: 0,
        })
        await audit(
          tx,
          actor,
          "imported",
          item,
          "Shared S3 catalog import; no assets uploaded",
          null,
          {
            manifestSha256: document.sha256,
            code: item.code,
            sha256: item.sha256,
            stock: 0,
            shopVersion: 1,
          }
        )
      } else if (diff.missingPrices.includes(item.id)) {
        const row = frames.find((row) => row.id === item.id)!
        if (row.version === 2_147_483_647 || row.shopVersion === 2_147_483_647)
          fail("REVISION_LIMIT")
        const after = {
          price: String(price(row.rarity)),
          stock: row.shopStock,
          version: row.version + 1,
          shopVersion: row.shopVersion + 1,
        }
        await tx
          .update(avatarFrame)
          .set({
            shopPrice: price(row.rarity),
            version: after.version,
            shopVersion: after.shopVersion,
            updatedAt: new Date(),
          })
          .where(eq(avatarFrame.id, row.id))
        await audit(
          tx,
          actor,
          "shop_updated",
          row,
          "Initialize missing Shop price from rarity",
          {
            price: null,
            stock: row.shopStock,
            version: row.version,
            shopVersion: row.shopVersion,
          },
          after
        )
      }
    }
    return diff
  })
}
