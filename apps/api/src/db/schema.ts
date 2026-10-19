import { sql, type SQL } from "drizzle-orm"
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { member, organization, user } from "./auth-schema.js"
import { coinOperation } from "./coin-schema.js"
import {
  NORMAL_GACHA_RULE,
  type NormalGachaRule,
} from "../features/shop/gacha-policy.js"

export * from "./auth-schema.js"
export * from "./coin-schema.js"

const timestamptz = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true })
const uuidv7 = (name: string) =>
  uuid(name).default(sql`public.uuid_generate_v7()`)

export const personRole = pgEnum("person_role", ["author", "artist"])
export const chapterNumberingMode = pgEnum("chapter_numbering_mode", [
  "global",
  "volume",
])
export const mangaStatus = pgEnum("manga_status", [
  "ongoing",
  "completed",
  "hiatus",
  "cancelled",
])
export const contentRating = pgEnum("content_rating", [
  "safe",
  "suggestive",
  "erotica",
  "pornographic",
])
export const publicationState = pgEnum("publication_state", [
  "draft",
  "published",
  "hidden",
])
export const libraryCategory = pgEnum("library_category", [
  "following",
  "reading",
  "plan",
  "completed",
])
export const accountStatus = pgEnum("account_status", [
  "active",
  "suspended",
  "banned",
])
export const membershipStatus = pgEnum("membership_status", [
  "pending",
  "approved",
  "rejected",
])
export const groupApplicationType = pgEnum("group_application_type", [
  "create",
  "join",
])
export const coverUploadState = pgEnum("cover_upload_state", [
  "pending",
  "attached",
  "cleaning",
  "cleaned",
])
export const chapterUploadMode = pgEnum("chapter_upload_mode", [
  "initial",
  "replacement",
])
export const chapterUploadState = pgEnum("chapter_upload_state", [
  "open",
  "finalizing",
  "completed",
  "cancelled",
  "cleaning",
  "cleaned",
])
export const chapterUploadPageState = pgEnum("chapter_upload_page_state", [
  "uploading",
  "ready",
  "deleting",
])
export const commentStatus = pgEnum("comment_status", ["visible", "hidden"])
export const notificationType = pgEnum("notification_type", [
  "manga_new_chapter",
  "group_join_requested",
  "group_join_approved",
  "group_join_rejected",
  "group_member_removed",
  "group_member_left",
  "group_approved",
  "group_rejected",
  "content_group_added",
  "group_leader_assigned",
])
export const reportStatus = pgEnum("report_status", [
  "open",
  "reviewing",
  "resolved",
  "rejected",
])
export const moderationTargetKind = pgEnum("moderation_target_kind", [
  "user",
  "manga",
  "volume",
  "chapter",
  "comment",
  "group",
  "person",
  "tag",
  "image_server2",
  "system_notice",
  "avatar_frame",
  "avatar_frame_topic",
  "shop_chest",
])

export const avatarFrameRarity = pgEnum("avatar_frame_rarity", [
  "R",
  "SR",
  "SSR",
])

export const avatarFrameTopic = pgTable(
  "avatar_frame_topic",
  {
    id: uuidv7("id").primaryKey(),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("avatar_frame_topic_name_unique").on(
      sql`lower(btrim(${table.name}))`
    ),
    check(
      "avatar_frame_topic_name_check",
      sql`length(btrim(${table.name})) BETWEEN 1 AND 160`
    ),
    check("avatar_frame_topic_version_check", sql`${table.version} > 0`),
  ]
)

export const avatarFrame = pgTable(
  "avatar_frame",
  {
    id: uuidv7("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    topicId: uuid("topic_id").references(() => avatarFrameTopic.id, {
      onDelete: "set null",
    }),
    rarity: avatarFrameRarity("rarity").notNull(),
    limited: boolean("limited").notNull().default(false),
    active: boolean("active").notNull().default(false),
    activatedAt: timestamptz("activated_at"),
    version: integer("version").notNull().default(1),
    assetKey: text("asset_key"),
    displayScale: integer("display_scale").notNull().default(125),
    offsetX: integer("offset_x").notNull().default(0),
    offsetY: integer("offset_y").notNull().default(0),
    shopPrice: bigint("shop_price", { mode: "bigint" }),
    shopStock: integer("shop_stock").notNull().default(0),
    shopVersion: integer("shop_version").notNull().default(1),
    previewKey: text("preview_key"),
    width: integer("width"),
    height: integer("height"),
    frameCount: integer("frame_count"),
    byteSize: integer("byte_size"),
    previewByteSize: integer("preview_byte_size"),
    sha256: text("sha256"),
    previewSha256: text("preview_sha256"),
    sourceSha256: text("source_sha256"),
    loop: integer("loop"),
    delays: jsonb("delays").$type<number[]>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("avatar_frame_catalog_idx").on(table.createdAt.desc(), table.id),
    index("avatar_frame_topic_idx").on(table.topicId),
    check(
      "avatar_frame_description_check",
      sql`length(${table.description}) <= 2000`
    ),
    check(
      "avatar_frame_limited_check",
      sql`NOT ${table.limited} OR ${table.rarity} = 'SSR'`
    ),
    check("avatar_frame_version_check", sql`${table.version} > 0`),
    check(
      "avatar_frame_display_scale_check",
      sql`${table.displayScale} BETWEEN 50 AND 200`
    ),
    check(
      "avatar_frame_offset_x_check",
      sql`${table.offsetX} BETWEEN -50 AND 50`
    ),
    check(
      "avatar_frame_offset_y_check",
      sql`${table.offsetY} BETWEEN -50 AND 50`
    ),
    check("avatar_frame_shop_price_check", sql`${table.shopPrice} > 0`),
    check("avatar_frame_shop_stock_check", sql`${table.shopStock} >= 0`),
    check("avatar_frame_shop_version_check", sql`${table.shopVersion} > 0`),
    check(
      "avatar_frame_name_check",
      sql`length(btrim(${table.name})) BETWEEN 1 AND 160`
    ),
    check(
      "avatar_frame_code_check",
      sql`${table.code} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${table.code}) <= 160`
    ),
    check(
      "avatar_frame_ready_check",
      sql`
    (NOT ${table.active} OR ${table.assetKey} IS NOT NULL) AND (
      (${table.assetKey} IS NULL AND num_nonnulls(${table.previewKey}, ${table.width}, ${table.height}, ${table.frameCount}, ${table.byteSize}, ${table.previewByteSize}, ${table.sha256}, ${table.previewSha256}, ${table.sourceSha256}, ${table.delays}, ${table.loop}) = 0)
      OR (${table.assetKey} IS NOT NULL AND ${table.previewKey} IS NOT NULL
        AND num_nonnulls(${table.previewKey}, ${table.width}, ${table.height}, ${table.frameCount}, ${table.byteSize}, ${table.previewByteSize}, ${table.sha256}, ${table.previewSha256}, ${table.sourceSha256}, ${table.delays}) = 10
        AND ${table.width} BETWEEN 1 AND 318 AND ${table.height} BETWEEN 1 AND 318
        AND ${table.frameCount} BETWEEN 1 AND 120
        AND ${table.byteSize} BETWEEN 1 AND CASE WHEN ${table.frameCount} > 1 THEN 5242880 ELSE 2000000 END
        AND ${table.previewByteSize} BETWEEN 1 AND 2000000
        AND ${table.sha256} ~ '^[0-9a-f]{64}$' AND ${table.previewSha256} ~ '^[0-9a-f]{64}$' AND ${table.sourceSha256} ~ '^[0-9a-f]{64}$'
        AND ${table.delays} IS NOT NULL)
    )`
    ),
  ]
)

export const shopPurchase = pgTable(
  "shop_purchase",
  {
    id: uuidv7("id").primaryKey(),
    // Immutable identity snapshot; the financial wallet already restricts deletion.
    actorUserId: text("actor_user_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    frameId: uuid("frame_id")
      .notNull()
      .references(() => avatarFrame.id, { onDelete: "restrict" }),
    frameCode: text("frame_code").notNull(),
    frameName: text("frame_name").notNull(),
    rarity: avatarFrameRarity("rarity").notNull(),
    price: bigint("price", { mode: "bigint" }).notNull(),
    frameVersion: integer("frame_version").notNull(),
    coinOperationKey: text("coin_operation_key")
      .notNull()
      .unique()
      .references(() => coinOperation.key, { onDelete: "restrict" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("shop_purchase_actor_operation_unique").on(
      table.actorUserId,
      table.operationId
    ),
    index("shop_purchase_actor_created_idx").on(
      table.actorUserId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    check(
      "shop_purchase_actor_check",
      sql`length(btrim(${table.actorUserId})) > 0`
    ),
    check(
      "shop_purchase_fingerprint_check",
      sql`${table.fingerprint} ~ '^[0-9a-f]{64}$'`
    ),
    check("shop_purchase_price_check", sql`${table.price} > 0`),
    check("shop_purchase_frame_version_check", sql`${table.frameVersion} > 0`),
    check(
      "shop_purchase_frame_name_check",
      sql`length(btrim(${table.frameName})) BETWEEN 1 AND 160`
    ),
    check(
      "shop_purchase_frame_code_check",
      sql`${table.frameCode} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${table.frameCode}) <= 160`
    ),
  ]
)

export const shopChest = pgTable(
  "shop_chest",
  {
    id: uuidv7("id").primaryKey(),
    kind: text("kind").$type<"common" | "topic">().notNull(),
    topicId: uuid("topic_id").references(() => avatarFrameTopic.id, {
      onDelete: "set null",
    }),
    // Last topic name survives deletion; null belongs only to the common chest.
    topicName: text("topic_name"),
    saleEnabled: boolean("sale_enabled").notNull().default(false),
    retiredAt: timestamptz("retired_at"),
    version: integer("version").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shop_chest_common_unique")
      .on(t.kind)
      .where(sql`${t.kind} = 'common'`),
    uniqueIndex("shop_chest_topic_unique").on(t.topicId),
    check("shop_chest_version_check", sql`${t.version} > 0`),
    check(
      "shop_chest_lifecycle_check",
      sql`(${t.kind} = 'common' AND ${t.topicId} IS NULL AND ${t.topicName} IS NULL AND ${t.retiredAt} IS NULL)
        OR (${t.kind} = 'topic' AND ${t.topicName} IS NOT NULL
          AND length(btrim(${t.topicName})) BETWEEN 1 AND 160
          AND ((${t.topicId} IS NOT NULL AND ${t.retiredAt} IS NULL)
            OR (${t.topicId} IS NULL AND ${t.retiredAt} IS NOT NULL AND NOT ${t.saleEnabled})))`
    ),
  ]
)

export const shopGachaState = pgTable(
  "shop_gacha_state",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "restrict" }),
    sinceSr: integer("since_sr").notNull().default(0),
    sinceSsr: integer("since_ssr").notNull().default(0),
    rollCount: bigint("roll_count", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "shop_gacha_state_counters_check",
      sql`${t.sinceSr} BETWEEN 0 AND 9 AND ${t.sinceSsr} BETWEEN 0 AND 49
        AND ${t.sinceSr} <= ${t.sinceSsr} AND ${t.rollCount} >= ${t.sinceSsr}`
    ),
  ]
)

export const shopGachaRoll = pgTable(
  "shop_gacha_roll",
  {
    id: uuidv7("id").primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    chestId: uuid("chest_id")
      .notNull()
      .references(() => shopChest.id, { onDelete: "restrict" }),
    chestKind: text("chest_kind").$type<"common" | "topic">().notNull(),
    chestName: text("chest_name").notNull(),
    // Historical ID, not a FK to a deletable catalog topic.
    topicId: uuid("topic_id"),
    chestVersion: integer("chest_version").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    ruleSnapshot: jsonb("rule_snapshot").$type<NormalGachaRule>().notNull(),
    poolDigest: text("pool_digest").notNull(),
    frameId: uuid("frame_id")
      .notNull()
      .references(() => avatarFrame.id, { onDelete: "restrict" }),
    frameCode: text("frame_code").notNull(),
    frameName: text("frame_name").notNull(),
    frameVersion: integer("frame_version").notNull(),
    rarity: avatarFrameRarity("rarity").notNull(),
    price: bigint("price", { mode: "bigint" }).notNull(),
    duplicate: boolean("duplicate").notNull(),
    refund: bigint("refund", { mode: "bigint" }).notNull(),
    rollSequence: bigint("roll_sequence", { mode: "bigint" }).notNull(),
    sinceSrBefore: integer("since_sr_before").notNull(),
    sinceSsrBefore: integer("since_ssr_before").notNull(),
    sinceSrAfter: integer("since_sr_after").notNull(),
    sinceSsrAfter: integer("since_ssr_after").notNull(),
    coinOperationKey: text("coin_operation_key")
      .notNull()
      .unique()
      .references(() => coinOperation.key, { onDelete: "restrict" }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("shop_gacha_roll_actor_operation_unique").on(
      t.actorUserId,
      t.operationId
    ),
    unique("shop_gacha_roll_actor_sequence_unique").on(
      t.actorUserId,
      t.rollSequence
    ),
    check(
      "shop_gacha_roll_actor_check",
      sql`length(btrim(${t.actorUserId})) > 0`
    ),
    check(
      "shop_gacha_roll_hash_check",
      sql`${t.fingerprint} ~ '^[0-9a-f]{64}$' AND ${t.poolDigest} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      "shop_gacha_roll_chest_check",
      sql`${t.chestVersion} > 0 AND length(btrim(${t.chestName})) BETWEEN 1 AND 180
        AND ((${t.chestKind} = 'common' AND ${t.topicId} IS NULL)
          OR (${t.chestKind} = 'topic' AND ${t.topicId} IS NOT NULL))`
    ),
    check(
      "shop_gacha_roll_frame_check",
      sql`${t.frameVersion} > 0 AND length(btrim(${t.frameName})) BETWEEN 1 AND 160
        AND ${t.frameCode} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${t.frameCode}) <= 160`
    ),
    check(
      "shop_gacha_roll_rule_check",
      sql`${t.ruleVersion} = 1 AND ${t.price} = 5
        AND ${t.ruleSnapshot} = ${JSON.stringify(NORMAL_GACHA_RULE)}::jsonb`.inlineParams()
    ),
    check(
      "shop_gacha_roll_refund_check",
      sql`(NOT ${t.duplicate} AND ${t.refund} = 0) OR (${t.duplicate} AND ${t.refund} =
        CASE ${t.rarity} WHEN 'R' THEN 1 WHEN 'SR' THEN 5 WHEN 'SSR' THEN 20 END)`
    ),
    check(
      "shop_gacha_roll_counters_check",
      sql`${t.rollSequence} > 0
        AND ${t.sinceSrBefore} BETWEEN 0 AND 9 AND ${t.sinceSsrBefore} BETWEEN 0 AND 49
        AND ${t.sinceSrBefore} <= ${t.sinceSsrBefore} AND ${t.sinceSsrBefore} < ${t.rollSequence}
        AND ${t.sinceSrAfter} BETWEEN 0 AND 9 AND ${t.sinceSsrAfter} BETWEEN 0 AND 49
        AND ${t.sinceSrAfter} <= ${t.sinceSsrAfter}
        AND ((${t.rarity} = 'SSR' AND ${t.sinceSrAfter} = 0 AND ${t.sinceSsrAfter} = 0)
          OR (${t.rarity} = 'SR' AND ${t.sinceSrAfter} = 0 AND ${t.sinceSsrAfter} = ${t.sinceSsrBefore} + 1)
          OR (${t.rarity} = 'R' AND ${t.sinceSrAfter} = ${t.sinceSrBefore} + 1 AND ${t.sinceSsrAfter} = ${t.sinceSsrBefore} + 1))`
    ),
  ]
)

export const userAvatarFrame = pgTable(
  "user_avatar_frame",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    frameId: uuid("frame_id")
      .notNull()
      .references(() => avatarFrame.id, { onDelete: "restrict" }),
    source: text("source").notNull().default("admin"),
    grantedAt: timestamptz("granted_at").notNull().defaultNow(),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamptz("revoked_at"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.frameId] }),
    index("user_avatar_frame_frame_user_idx").on(table.frameId, table.userId),
  ]
)

export const imageServer2Control = pgTable(
  "image_server2_control",
  {
    id: integer("id").primaryKey().default(1),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [check("image_server2_control_singleton", sql`${table.id} = 1`)]
)

export const manga = pgTable(
  "manga",
  {
    id: uuidv7("id").primaryKey(),
    numberingMode: chapterNumberingMode("numbering_mode")
      .notNull()
      .default("global"),
    ownerGroupId: text("owner_group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    alternativeTitles: jsonb("alternative_titles")
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    description: text("description"),
    searchTitle: text("search_title").notNull(),
    originalLanguage: text("original_language").notNull(),
    publicationDemographic: text("publication_demographic"),
    status: mangaStatus("status").notNull(),
    contentRating: contentRating("content_rating").notNull(),
    publicationState: publicationState("publication_state")
      .notNull()
      .default("published"),
    moderationHiddenAt: timestamptz("moderation_hidden_at"),
    version: integer("version").notNull().default(1),
    year: integer("year"),
    lastVolume: text("last_volume"),
    lastChapter: text("last_chapter"),
    links: jsonb("links").$type<Record<string, string>>().notNull().default({}),
    hasUsableChapters: boolean("has_usable_chapters").notNull().default(false),
    latestChapterPublishedAt: timestamptz("latest_chapter_published_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    publishedAt: timestamptz("published_at").defaultNow(),
    deletedAt: timestamptz("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deleteReason: text("delete_reason"),
  },
  (table) => [
    unique("manga_id_numbering_mode_unique").on(table.id, table.numberingMode),
    index("manga_catalog_idx").on(
      table.publicationState,
      table.moderationHiddenAt,
      table.deletedAt,
      table.hasUsableChapters,
      table.latestChapterPublishedAt,
      table.id
    ),
    index("manga_filters_idx").on(
      table.originalLanguage,
      table.contentRating,
      table.publicationDemographic,
      table.status,
      table.year
    ),
    index("manga_owner_group_idx").on(table.ownerGroupId, table.id),
    check("manga_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("manga_version_check", sql`${table.version} > 0`),
    check(
      "manga_published_at_check",
      sql`${table.publicationState} <> 'published' OR ${table.publishedAt} IS NOT NULL`
    ),
    check(
      "manga_delete_metadata_check",
      sql`${table.deletedAt} IS NOT NULL OR (${table.deletedByUserId} IS NULL AND ${table.deleteReason} IS NULL)`
    ),
  ]
)

export const mangaVolume = pgTable(
  "manga_volume",
  {
    id: uuidv7("id").primaryKey(),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    number: numeric("number", { precision: 10, scale: 3 }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    deletedAt: timestamptz("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deleteReason: text("delete_reason"),
  },
  (table) => [
    unique("manga_volume_id_manga_id_unique").on(table.id, table.mangaId),
    uniqueIndex("manga_volume_active_number_uidx")
      .on(table.mangaId, table.number)
      .where(sql`${table.deletedAt} IS NULL`),
    check(
      "manga_volume_delete_metadata_check",
      sql`${table.deletedAt} IS NOT NULL OR (${table.deletedByUserId} IS NULL AND ${table.deleteReason} IS NULL)`
    ),
  ]
)

export const person = pgTable(
  "person",
  {
    id: uuidv7("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    links: jsonb("links").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("person_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ]
)

export const mangaPerson = pgTable(
  "manga_person",
  {
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    role: personRole("role").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mangaId, table.personId, table.role] }),
    index("manga_person_person_idx").on(
      table.personId,
      table.role,
      table.mangaId
    ),
  ]
)

export const tag = pgTable(
  "tag",
  {
    id: uuidv7("id").primaryKey(),
    slug: text("slug").notNull(),
    group: text("group").notNull(),
    name: text("name").notNull(),
    moderationHiddenAt: timestamptz("moderation_hidden_at"),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("tag_slug_uidx").on(table.slug),
    uniqueIndex("tag_group_name_uidx").on(
      table.group,
      sql`lower(btrim(${table.name}))`
    ),
    check("tag_slug_check", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check(
      "tag_slug_length_check",
      sql`length(${table.slug}) between 1 and 160`
    ),
    check(
      "tag_name_check",
      sql`length(btrim(${table.name})) between 1 and 100`
    ),
    check(
      "tag_group_check",
      sql`${table.group} in ('content', 'format', 'genre', 'theme')`
    ),
    check("tag_version_check", sql`${table.version} > 0`),
  ]
)

export const mangaTag = pgTable(
  "manga_tag",
  {
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.mangaId, table.tagId] }),
    index("manga_tag_tag_idx").on(table.tagId, table.mangaId),
  ]
)

export const mangaLanguage = pgTable(
  "manga_language",
  {
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
  },
  (table) => [primaryKey({ columns: [table.mangaId, table.language] })]
)

export const translationGroupProfile = pgTable(
  "translation_group_profile",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    description: text("description"),
    bannerUrl: text("banner_url"),
    links: jsonb("links").$type<Record<string, string>>().notNull().default({}),
    inactive: boolean("inactive").notNull().default(false),
    approvalStatus: membershipStatus("approval_status")
      .notNull()
      .default("approved"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamptz("reviewed_at"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    publicationState: publicationState("publication_state")
      .notNull()
      .default("draft"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    deletedAt: timestamptz("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deleteReason: text("delete_reason"),
  },
  (table) => [
    check(
      "translation_group_profile_delete_metadata_check",
      sql`${table.deletedAt} IS NOT NULL OR (${table.deletedByUserId} IS NULL AND ${table.deleteReason} IS NULL)`
    ),
  ]
)

export const translationGroupMemberProfile = pgTable(
  "translation_group_member_profile",
  {
    memberId: text("member_id")
      .primaryKey()
      .references(() => member.id, { onDelete: "cascade" }),
    canAddManga: boolean("can_add_manga").notNull().default(false),
    canEditManga: boolean("can_edit_manga").notNull().default(false),
    canDeleteManga: boolean("can_delete_manga").notNull().default(false),
    canAddChapter: boolean("can_add_chapter").notNull().default(false),
    canEditChapter: boolean("can_edit_chapter").notNull().default(false),
    canDeleteChapter: boolean("can_delete_chapter").notNull().default(false),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  }
)

export const translationGroupApplication = pgTable(
  "translation_group_application",
  {
    id: uuidv7("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: groupApplicationType("type").notNull(),
    status: membershipStatus("status").notNull().default("pending"),
    reviewedAt: timestamptz("reviewed_at"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("translation_group_application_organization_user_uidx").on(
      table.organizationId,
      table.userId
    ),
    uniqueIndex("translation_group_application_pending_user_uidx")
      .on(table.userId)
      .where(sql`${table.status} = 'pending'`),
    index("translation_group_application_group_status_idx").on(
      table.organizationId,
      table.status,
      table.createdAt
    ),
  ]
)

export const mangaGroup = pgTable(
  "manga_group",
  {
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    isExplicit: boolean("is_explicit").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.mangaId, table.groupId] }),
    index("manga_group_group_idx").on(table.groupId, table.mangaId),
  ]
)

export const chapter = pgTable(
  "chapter",
  {
    id: uuidv7("id").primaryKey(),
    numberingMode: chapterNumberingMode("numbering_mode")
      .notNull()
      .default("global"),
    readingKey: text("reading_key")
      .notNull()
      .generatedAlwaysAs(
        (): SQL =>
          sql`CASE WHEN ${chapter.number} IS NULL OR (${chapter.numberingMode} = 'volume' AND ${chapter.volumeId} IS NULL) THEN 'id:' || ${chapter.id}::text WHEN ${chapter.numberingMode} = 'volume' THEN 'v:' || ${chapter.volumeId}::text || ':' || ${chapter.number}::text ELSE 'n:' || ${chapter.number}::text END`
      ),
    isDefault: boolean("is_default").notNull().default(false),
    ownerGroupId: text("owner_group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    uploaderUserId: text("uploader_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    volumeId: uuid("volume_id"),
    number: numeric("number", { precision: 10, scale: 3 }),
    title: text("title"),
    language: text("language").notNull(),
    pageCount: integer("page_count").notNull(),
    availablePageCount: integer("available_page_count").notNull(),
    pagesVersion: integer("pages_version").notNull().default(0),
    isFull: boolean("is_full").notNull(),
    publicationState: publicationState("publication_state")
      .notNull()
      .default("draft"),
    moderationHiddenAt: timestamptz("moderation_hidden_at"),
    version: integer("version").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    publishedAt: timestamptz("published_at"),
    deletedAt: timestamptz("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deleteReason: text("delete_reason"),
  },
  (table) => [
    unique("chapter_id_manga_id_unique").on(table.id, table.mangaId),
    uniqueIndex("chapter_default_slot_uidx")
      .on(table.mangaId, table.language, table.readingKey)
      .where(sql`${table.deletedAt} IS NULL AND ${table.isDefault}`),
    index("chapter_reading_slot_idx").on(
      table.mangaId,
      table.language,
      table.readingKey
    ),
    foreignKey({
      columns: [table.mangaId, table.numberingMode],
      foreignColumns: [manga.id, manga.numberingMode],
      name: "chapter_numbering_manga_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("chapter_manga_published_idx").on(
      table.mangaId,
      table.publicationState,
      table.moderationHiddenAt,
      table.deletedAt,
      table.publishedAt,
      table.id
    ),
    index("chapter_owner_group_idx").on(table.ownerGroupId, table.id),
    foreignKey({
      columns: [table.volumeId, table.mangaId],
      foreignColumns: [mangaVolume.id, mangaVolume.mangaId],
      name: "chapter_volume_manga_fk",
    }).onDelete("restrict"),
    check("chapter_page_count_check", sql`${table.pageCount} >= 0`),
    check("chapter_version_check", sql`${table.version} > 0`),
    check("chapter_pages_version_check", sql`${table.pagesVersion} >= 0`),
    index("chapter_replica_discovery_idx")
      .on(table.id)
      .where(
        sql`${table.pagesVersion} > 0 AND ${table.publicationState} = 'published' AND ${table.moderationHiddenAt} IS NULL AND ${table.deletedAt} IS NULL`
      ),
    check(
      "chapter_available_page_count_check",
      sql`${table.availablePageCount} >= 0 AND ${table.availablePageCount} <= ${table.pageCount}`
    ),
    check(
      "chapter_published_at_check",
      sql`${table.publicationState} <> 'published' OR ${table.publishedAt} IS NOT NULL`
    ),
    check(
      "chapter_delete_metadata_check",
      sql`${table.deletedAt} IS NOT NULL OR (${table.deletedByUserId} IS NULL AND ${table.deleteReason} IS NULL)`
    ),
  ]
)

export const chapterUploadSession = pgTable(
  "chapter_upload_session",
  {
    id: uuidv7("id").primaryKey(),
    chapterId: uuid("chapter_id").references(() => chapter.id, {
      onDelete: "cascade",
    }),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    groupId: text("group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    mode: chapterUploadMode("mode").notNull(),
    expectedChapterVersion: integer("expected_chapter_version"),
    state: chapterUploadState("state").notNull().default("open"),
    orderedPageIds: uuid("ordered_page_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    finalizeClaimToken: uuid("finalize_claim_token"),
    finalizeClaimExpiresAt: timestamptz("finalize_claim_expires_at"),
    finalizeError: text("finalize_error"),
    committedResult: jsonb("committed_result").$type<Record<string, unknown>>(),
    expiresAt: timestamptz("expires_at").notNull(),
    finalizedAt: timestamptz("finalized_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chapter_upload_session_active_chapter_uidx")
      .on(table.chapterId)
      .where(
        sql`${table.chapterId} IS NOT NULL AND ${table.state} IN ('open', 'finalizing')`
      ),
    uniqueIndex("chapter_upload_session_active_draft_uidx")
      .on(table.actorUserId, table.groupId, table.mangaId)
      .where(
        sql`${table.chapterId} IS NULL AND ${table.state} IN ('open', 'finalizing')`
      ),
    index("chapter_upload_session_cleanup_idx").on(
      table.state,
      table.expiresAt,
      table.id
    ),
    index("chapter_upload_session_actor_state_idx").on(
      table.actorUserId,
      table.state,
      table.expiresAt
    ),
    check(
      "chapter_upload_session_version_check",
      sql`(${table.chapterId} IS NULL AND ${table.mode} = 'initial' AND ${table.expectedChapterVersion} IS NULL) OR (${table.chapterId} IS NOT NULL AND ${table.expectedChapterVersion} > 0)`
    ),
    check(
      "chapter_upload_session_order_check",
      sql`cardinality(${table.orderedPageIds}) <= 220`
    ),
  ]
)

export const chapterUploadFinalObject = pgTable(
  "chapter_upload_final_object",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chapterUploadSession.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.objectKey] }),
    check(
      "chapter_upload_final_object_key_check",
      sql`${table.objectKey} <> '' AND ${table.objectKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.objectKey} !~ '^/'`
    ),
  ]
)

export const chapterUploadPage = pgTable(
  "chapter_upload_page",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chapterUploadSession.id, { onDelete: "cascade" }),
    state: chapterUploadPageState("state").notNull().default("uploading"),
    stagingKey: text("staging_key").unique(),
    publishedOriginalKey: text("published_original_key"),
    publishedOptimizedKey: text("published_optimized_key"),
    width: integer("width"),
    height: integer("height"),
    sourceByteSize: integer("source_byte_size"),
    storedByteSize: integer("stored_byte_size"),
    sha256: text("sha256"),
    publishedOptimizedWidth: integer("published_optimized_width"),
    publishedOptimizedHeight: integer("published_optimized_height"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("chapter_upload_page_session_state_idx").on(
      table.sessionId,
      table.state,
      table.createdAt
    ),
    check(
      "chapter_upload_page_key_check",
      sql`(${table.stagingKey} IS NOT NULL AND ${table.publishedOriginalKey} IS NULL) OR (${table.stagingKey} IS NULL AND ${table.publishedOriginalKey} IS NOT NULL)`
    ),
    check(
      "chapter_upload_page_staging_key_check",
      sql`${table.stagingKey} IS NULL OR (${table.stagingKey} <> '' AND ${table.stagingKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.stagingKey} !~ '^/')`
    ),
    check(
      "chapter_upload_page_published_key_check",
      sql`${table.publishedOriginalKey} IS NULL OR (${table.publishedOriginalKey} <> '' AND ${table.publishedOriginalKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.publishedOriginalKey} !~ '^/')`
    ),
    check(
      "chapter_upload_page_metadata_check",
      sql`${table.state} <> 'ready' OR (${table.width} > 0 AND ${table.height} > 0 AND (${table.publishedOriginalKey} IS NOT NULL OR (${table.sourceByteSize} > 0 AND ${table.storedByteSize} > 0 AND ${table.sha256} ~ '^[0-9a-f]{64}$')))`
    ),
    check(
      "chapter_upload_page_published_optimized_check",
      sql`(${table.publishedOptimizedKey} IS NULL OR (${table.publishedOriginalKey} IS NOT NULL AND ${table.publishedOptimizedKey} <> '' AND ${table.publishedOptimizedKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.publishedOptimizedKey} !~ '^/')) AND ((${table.publishedOptimizedWidth} IS NULL AND ${table.publishedOptimizedHeight} IS NULL) OR (${table.publishedOriginalKey} IS NOT NULL AND ${table.publishedOptimizedWidth} > 0 AND ${table.publishedOptimizedHeight} > 0))`
    ),
  ]
)

export const chapterPage = pgTable(
  "chapter_page",
  {
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapter.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    originalKey: text("original_key").notNull(),
    optimizedKey: text("optimized_key"),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    optimizedWidth: integer("optimized_width"),
    optimizedHeight: integer("optimized_height"),
  },
  (table) => [
    primaryKey({ columns: [table.chapterId, table.position] }),
    check("chapter_page_position_check", sql`${table.position} >= 0`),
    check(
      "chapter_page_dimensions_check",
      sql`${table.width} > 0 AND ${table.height} > 0`
    ),
    check(
      "chapter_page_optimized_dimensions_check",
      sql`(${table.optimizedWidth} IS NULL AND ${table.optimizedHeight} IS NULL) OR (${table.optimizedWidth} > 0 AND ${table.optimizedHeight} > 0)`
    ),
    check(
      "chapter_page_original_key_check",
      sql`${table.originalKey} <> '' AND ${table.originalKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.originalKey} !~ '^/'`
    ),
    check(
      "chapter_page_optimized_key_check",
      sql`${table.optimizedKey} IS NULL OR (${table.optimizedKey} <> '' AND ${table.optimizedKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.optimizedKey} !~ '^/')`
    ),
  ]
)

export type TikTokReplicaPage = {
  originalKey: string
  width: number
  height: number
  uri: string | null
  url: string | null
  format: string | null
  byteSize: number | null
  verifiedAt: string | null
}

export const chapterTikTokReplica = pgTable(
  "chapter_tiktok_replica",
  {
    chapterId: uuid("chapter_id")
      .primaryKey()
      .references(() => chapter.id, { onDelete: "cascade" }),
    sourceVersion: integer("source_version").notNull(),
    state: text("state", {
      enum: ["pending", "running", "retry_wait", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    totalPages: integer("total_pages").notNull(),
    pages: jsonb("pages").$type<Record<string, TikTokReplicaPage>>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: timestamptz("next_retry_at"),
    claimToken: uuid("claim_token"),
    claimExpiresAt: timestamptz("claim_expires_at"),
    lastErrorCode: text("last_error_code"),
    lastError: text("last_error"),
    readyAt: timestamptz("ready_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "chapter_tiktok_replica_version_check",
      sql`${table.sourceVersion} >= 0`
    ),
    check(
      "chapter_tiktok_replica_pages_check",
      sql`${table.totalPages} BETWEEN 1 AND 220 AND jsonb_typeof(${table.pages}) = 'object'`
    ),
    check(
      "chapter_tiktok_replica_state_check",
      sql`${table.state} IN ('pending', 'running', 'retry_wait', 'ready', 'failed')`
    ),
    check("chapter_tiktok_replica_attempts_check", sql`${table.attempts} >= 0`),
    check(
      "chapter_tiktok_replica_claim_check",
      sql`(${table.state} = 'running') = (${table.claimToken} IS NOT NULL AND ${table.claimExpiresAt} IS NOT NULL)`
    ),
    index("chapter_tiktok_replica_due_idx")
      .on(table.nextRetryAt, table.chapterId)
      .where(sql`${table.state} IN ('pending', 'retry_wait')`),
    index("chapter_tiktok_replica_expired_idx")
      .on(table.claimExpiresAt, table.chapterId)
      .where(sql`${table.state} = 'running'`),
  ]
)

export const cover = pgTable(
  "cover",
  {
    id: uuidv7("id").primaryKey(),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    volumeId: uuid("volume_id"),
    storageKey: text("storage_key").notNull(),
    language: text("language"),
    description: text("description"),
    width: integer("width"),
    height: integer("height"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("cover_manga_idx").on(table.mangaId),
    uniqueIndex("cover_primary_manga_uidx")
      .on(table.mangaId)
      .where(sql`${table.isPrimary}`),
    foreignKey({
      columns: [table.volumeId, table.mangaId],
      foreignColumns: [mangaVolume.id, mangaVolume.mangaId],
      name: "cover_volume_manga_fk",
    }).onDelete("restrict"),
    check(
      "cover_dimensions_check",
      sql`(${table.width} IS NULL AND ${table.height} IS NULL) OR (${table.width} > 0 AND ${table.height} > 0)`
    ),
    check(
      "cover_storage_key_check",
      sql`${table.storageKey} <> '' AND ${table.storageKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.storageKey} !~ '^/'`
    ),
  ]
)

export const coverUploadOperation = pgTable(
  "cover_upload_operation",
  {
    id: uuidv7("id").primaryKey(),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "restrict" }),
    groupId: text("group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    originalKey: text("original_key").notNull(),
    mediumKey: text("medium_key").notNull(),
    smallKey: text("small_key").notNull(),
    state: coverUploadState("state").notNull().default("pending"),
    expiresAt: timestamptz("expires_at").notNull(),
    attachedAt: timestamptz("attached_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("cover_upload_operation_cleanup_idx").on(
      table.state,
      table.expiresAt,
      table.id
    ),
    check(
      "cover_upload_operation_keys_check",
      sql`${table.originalKey} <> '' AND ${table.mediumKey} <> '' AND ${table.smallKey} <> '' AND ${table.originalKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.mediumKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.smallKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.originalKey} !~ '^/' AND ${table.mediumKey} !~ '^/' AND ${table.smallKey} !~ '^/'`
    ),
    check(
      "cover_upload_operation_attached_check",
      sql`(${table.state} = 'attached') = (${table.attachedAt} IS NOT NULL)`
    ),
  ]
)

export const coverUploadSession = pgTable(
  "cover_upload_session",
  {
    id: uuidv7("id").primaryKey(),
    mangaId: uuid("manga_id").references(() => manga.id, {
      onDelete: "restrict",
    }),
    groupId: text("group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "restrict" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createFlow: boolean("create_flow").notNull().default(false),
    originalStagingKey: text("original_staging_key").notNull(),
    mediumStagingKey: text("medium_staging_key").notNull(),
    smallStagingKey: text("small_staging_key").notNull(),
    originalSha256: text("original_sha256").notNull(),
    mediumSha256: text("medium_sha256").notNull(),
    smallSha256: text("small_sha256").notNull(),
    originalByteSize: integer("original_byte_size").notNull(),
    mediumByteSize: integer("medium_byte_size").notNull(),
    smallByteSize: integer("small_byte_size").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    state: coverUploadState("state").notNull().default("pending"),
    expiresAt: timestamptz("expires_at").notNull(),
    attachedAt: timestamptz("attached_at"),
    stagingCleanedAt: timestamptz("staging_cleaned_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("cover_upload_session_cleanup_idx").on(
      table.state,
      table.expiresAt,
      table.id
    ),
    index("cover_upload_session_actor_idx").on(
      table.actorUserId,
      table.groupId,
      table.state
    ),
    check(
      "cover_upload_session_keys_check",
      sql`${table.originalStagingKey} <> '' AND ${table.mediumStagingKey} <> '' AND ${table.smallStagingKey} <> '' AND ${table.originalStagingKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.mediumStagingKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.smallStagingKey} !~ '^[a-z][a-z0-9+.-]*://' AND ${table.originalStagingKey} !~ '^/' AND ${table.mediumStagingKey} !~ '^/' AND ${table.smallStagingKey} !~ '^/'`
    ),
    check(
      "cover_upload_session_hashes_check",
      sql`${table.originalSha256} ~ '^[0-9a-f]{64}$' AND ${table.mediumSha256} ~ '^[0-9a-f]{64}$' AND ${table.smallSha256} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      "cover_upload_session_dimensions_check",
      sql`${table.width} > 0 AND ${table.height} > 0 AND ${table.originalByteSize} > 0 AND ${table.mediumByteSize} > 0 AND ${table.smallByteSize} > 0`
    ),
    check(
      "cover_upload_session_attached_check",
      sql`(${table.state} = 'attached') = (${table.attachedAt} IS NOT NULL)`
    ),
  ]
)

export const chapterGroup = pgTable(
  "chapter_group",
  {
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapter.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.chapterId, table.groupId] }),
    index("chapter_group_group_idx").on(table.groupId, table.chapterId),
  ]
)

export const userProfile = pgTable(
  "user_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    bio: text("bio"),
    avatarFrameId: uuid("avatar_frame_id").references(() => avatarFrame.id, {
      onDelete: "restrict",
    }),
    isPublic: boolean("is_public").notNull().default(true),
    status: accountStatus("status").notNull().default("active"),
    version: integer("version").notNull().default(1),
    moderatedAt: timestamptz("moderated_at"),
    moderatedByUserId: text("moderated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    moderationReason: text("moderation_reason"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_profile_status_updated_user_idx").on(
      table.status,
      table.updatedAt.desc(),
      table.userId
    ),
    check("user_profile_version_check", sql`${table.version} > 0`),
    check(
      "user_profile_moderation_check",
      sql`${table.status} = 'active' OR (${table.moderatedAt} IS NOT NULL AND ${table.moderationReason} IS NOT NULL)`
    ),
  ]
)

export const libraryItem = pgTable(
  "library_item",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    category: libraryCategory("category").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mangaId] }),
    index("library_item_user_category_idx").on(
      table.userId,
      table.category,
      table.createdAt,
      table.mangaId
    ),
    index("library_item_following_manga_user_idx")
      .on(table.mangaId, table.userId)
      .where(sql`${table.category} = 'following'`),
  ]
)

export const readingHistory = pgTable(
  "reading_history",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id").notNull(),
    mangaId: uuid("manga_id").notNull(),
    readAt: timestamptz("read_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.chapterId] }),
    index("reading_history_user_read_idx").on(
      table.userId,
      table.readAt,
      table.chapterId
    ),
    index("reading_history_user_manga_idx").on(
      table.userId,
      table.mangaId,
      table.readAt
    ),
    foreignKey({
      columns: [table.chapterId, table.mangaId],
      foreignColumns: [chapter.id, chapter.mangaId],
      name: "reading_history_chapter_manga_fk",
    }).onDelete("cascade"),
  ]
)

export const comment = pgTable(
  "comment",
  {
    id: uuidv7("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "restrict" }),
    chapterId: uuid("chapter_id"),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    creationKey: uuid("creation_key"),
    creationFingerprint: text("creation_fingerprint"),
    status: commentStatus("status").notNull().default("visible"),
    version: integer("version").notNull().default(1),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    editedAt: timestamptz("edited_at"),
    deletedAt: timestamptz("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    deleteReason: text("delete_reason"),
  },
  (table) => [
    uniqueIndex("comment_creation_key_unique").on(
      table.userId,
      table.creationKey
    ),
    check(
      "comment_creation_receipt_check",
      sql`(${table.creationKey} IS NULL AND ${table.creationFingerprint} IS NULL) OR (${table.creationKey} IS NOT NULL AND ${table.creationFingerprint} IS NOT NULL AND ${table.creationFingerprint} ~ '^[0-9a-f]{64}$')`
    ),
    index("comment_manga_created_idx").on(
      table.mangaId,
      table.createdAt,
      table.id
    ),
    index("comment_user_created_idx").on(
      table.userId,
      table.createdAt,
      table.id
    ),
    index("comment_chapter_created_idx").on(
      table.chapterId,
      table.createdAt,
      table.id
    ),
    index("comment_admin_created_idx")
      .on(table.createdAt, table.id)
      .where(sql`${table.deletedAt} IS NULL`),
    foreignKey({
      columns: [table.chapterId, table.mangaId],
      foreignColumns: [chapter.id, chapter.mangaId],
      name: "comment_chapter_manga_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "comment_parent_fk",
    }).onDelete("restrict"),
    check("comment_body_check", sql`length(btrim(${table.body})) > 0`),
    check("comment_version_check", sql`${table.version} > 0`),
    check(
      "comment_delete_metadata_check",
      sql`${table.deletedAt} IS NOT NULL OR (${table.deletedByUserId} IS NULL AND ${table.deleteReason} IS NULL)`
    ),
  ]
)

export const forbiddenWord = pgTable(
  "forbidden_word",
  {
    id: uuidv7("id").primaryKey(),
    word: text("word").notNull(),
    normalizedWord: text("normalized_word").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("forbidden_word_normalized_idx").on(table.normalizedWord),
    check(
      "forbidden_word_word_check",
      sql`length(${table.word}) between 1 and 80`
    ),
    check(
      "forbidden_word_normalized_check",
      sql`length(${table.normalizedWord}) between 1 and 80`
    ),
  ]
)

export const notification = pgTable(
  "notification",
  {
    id: uuidv7("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    mangaId: uuid("manga_id").references(() => manga.id, {
      onDelete: "cascade",
    }),
    chapterId: uuid("chapter_id"),
    groupId: text("group_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    readAt: timestamptz("read_at"),
  },
  (table) => [
    uniqueIndex("notification_user_type_manga_uidx").on(
      table.userId,
      table.type,
      table.mangaId
    ),
    index("notification_user_created_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index("notification_user_unread_idx")
      .on(table.userId)
      .where(sql`${table.readAt} IS NULL`),
    foreignKey({
      columns: [table.chapterId, table.mangaId],
      foreignColumns: [chapter.id, chapter.mangaId],
      name: "notification_chapter_manga_fk",
    }).onDelete("cascade"),
    check(
      "notification_target_check",
      sql`(${table.type} = 'manga_new_chapter' AND ${table.mangaId} IS NOT NULL AND ${table.chapterId} IS NOT NULL AND ${table.groupId} IS NULL) OR (${table.type} <> 'manga_new_chapter' AND ${table.mangaId} IS NULL AND ${table.chapterId} IS NULL AND ${table.groupId} IS NOT NULL)`
    ),
  ]
)

export const systemNotice = pgTable(
  "system_notice",
  {
    id: uuidv7("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", {
      mode: "date",
      precision: 3,
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("system_notice_created_idx").on(
      table.createdAt.desc(),
      table.id.desc()
    ),
    check(
      "system_notice_title_check",
      sql`length(${table.title}) between 1 and 160`
    ),
    check(
      "system_notice_content_check",
      sql`length(${table.content}) between 1 and 10000`
    ),
  ]
)

export const systemNoticeState = pgTable("system_notice_state", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  readThroughCreatedAt: timestamp("read_through_created_at", {
    mode: "date",
    precision: 3,
    withTimezone: true,
  }).notNull(),
  readThroughId: uuid("read_through_id").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
})

export const mangaStats = pgTable(
  "manga_stats",
  {
    mangaId: uuid("manga_id")
      .primaryKey()
      .references(() => manga.id, { onDelete: "cascade" }),
    views: bigint("views", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    follows: bigint("follows", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    comments: bigint("comments", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "manga_stats_nonnegative_check",
      sql`${table.views} >= 0 AND ${table.follows} >= 0 AND ${table.comments} >= 0`
    ),
  ]
)

export const translationGroupMangaViewStats = pgTable(
  "translation_group_manga_view_stats",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    views: numeric("views", { precision: 14, scale: 1, mode: "number" })
      .notNull()
      .default(0),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.mangaId] }),
    index("translation_group_manga_view_stats_manga_idx").on(
      table.mangaId,
      table.groupId
    ),
    check(
      "translation_group_manga_view_stats_nonnegative_check",
      sql`${table.views} >= 0`
    ),
  ]
)

export const translationGroupMangaEngagementDaily = pgTable(
  "translation_group_manga_engagement_daily",
  {
    groupId: text("group_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    bucketDate: date("bucket_date", { mode: "string" }).notNull(),
    views: numeric("views", { precision: 14, scale: 1, mode: "number" })
      .notNull()
      .default(0),
    actualViews: bigint("actual_views", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.mangaId, table.bucketDate] }),
    index("translation_group_manga_engagement_daily_bucket_group_idx").on(
      table.bucketDate,
      table.groupId
    ),
    check(
      "translation_group_manga_engagement_daily_nonnegative_check",
      sql`${table.views} >= 0 AND ${table.actualViews} >= 0`
    ),
  ]
)

export const mangaEngagementDaily = pgTable(
  "manga_engagement_daily",
  {
    mangaId: uuid("manga_id")
      .notNull()
      .references(() => manga.id, { onDelete: "cascade" }),
    bucketDate: date("bucket_date", { mode: "string" }).notNull(),
    views: bigint("views", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    followAdds: bigint("follow_adds", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    followRemoves: bigint("follow_removes", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    comments: bigint("comments", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.mangaId, table.bucketDate] }),
    index("manga_engagement_daily_bucket_manga_idx").on(
      table.bucketDate,
      table.mangaId
    ),
    check(
      "manga_engagement_daily_nonnegative_check",
      sql`${table.views} >= 0 AND ${table.followAdds} >= 0 AND ${table.followRemoves} >= 0 AND ${table.comments} >= 0`
    ),
  ]
)

export const chapterStats = pgTable(
  "chapter_stats",
  {
    chapterId: uuid("chapter_id")
      .primaryKey()
      .references(() => chapter.id, { onDelete: "cascade" }),
    views: bigint("views", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("chapter_stats_nonnegative_check", sql`${table.views} >= 0`),
  ]
)

export const contentReport = pgTable(
  "content_report",
  {
    id: uuidv7("id").primaryKey(),
    reporterUserId: text("reporter_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    mangaId: uuid("manga_id").references(() => manga.id, {
      onDelete: "restrict",
    }),
    chapterId: uuid("chapter_id").references(() => chapter.id, {
      onDelete: "restrict",
    }),
    commentId: uuid("comment_id").references(() => comment.id, {
      onDelete: "restrict",
    }),
    groupId: text("group_id").references(() => organization.id, {
      onDelete: "restrict",
    }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    reviewerUserId: text("reviewer_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamptz("reviewed_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("content_report_status_created_idx").on(
      table.status,
      table.createdAt,
      table.id
    ),
    check(
      "content_report_single_target_check",
      sql`num_nonnulls(${table.mangaId}, ${table.chapterId}, ${table.commentId}, ${table.groupId}) = 1`
    ),
    check(
      "content_report_reason_check",
      sql`length(btrim(${table.reason})) > 0`
    ),
  ]
)

export const moderationAction = pgTable(
  "moderation_action",
  {
    id: uuidv7("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetKind: moderationTargetKind("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("moderation_action_timeline_idx").on(table.createdAt, table.id),
    index("moderation_action_target_idx").on(
      table.targetKind,
      table.targetId,
      table.createdAt,
      table.id
    ),
    check(
      "moderation_action_action_check",
      sql`length(btrim(${table.action})) > 0`
    ),
    check(
      "moderation_action_reason_check",
      sql`length(btrim(${table.reason})) > 0`
    ),
  ]
)
