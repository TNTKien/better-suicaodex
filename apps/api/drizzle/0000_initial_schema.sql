CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."uuid_generate_v7"()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
	result bytea;
BEGIN
	result := substring(
		int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)
		FROM 3
	) || gen_random_bytes(10);
	result := set_byte(result, 6, (get_byte(result, 6) & 15) | 112);
	result := set_byte(result, 8, (get_byte(result, 8) & 63) | 128);
	RETURN encode(result, 'hex')::uuid;
END
$$;

--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'suspended', 'banned');--> statement-breakpoint
CREATE TYPE "public"."avatar_frame_rarity" AS ENUM('R', 'SR', 'SSR');--> statement-breakpoint
CREATE TYPE "public"."chapter_numbering_mode" AS ENUM('global', 'volume');--> statement-breakpoint
CREATE TYPE "public"."chapter_upload_mode" AS ENUM('initial', 'replacement');--> statement-breakpoint
CREATE TYPE "public"."chapter_upload_page_state" AS ENUM('uploading', 'ready', 'deleting');--> statement-breakpoint
CREATE TYPE "public"."chapter_upload_state" AS ENUM('open', 'finalizing', 'completed', 'cancelled', 'cleaning', 'cleaned');--> statement-breakpoint
CREATE TYPE "public"."comment_status" AS ENUM('visible', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."content_rating" AS ENUM('safe', 'suggestive', 'erotica', 'pornographic');--> statement-breakpoint
CREATE TYPE "public"."cover_upload_state" AS ENUM('pending', 'attached', 'cleaning', 'cleaned');--> statement-breakpoint
CREATE TYPE "public"."group_application_type" AS ENUM('create', 'join');--> statement-breakpoint
CREATE TYPE "public"."library_category" AS ENUM('following', 'reading', 'plan', 'completed');--> statement-breakpoint
CREATE TYPE "public"."manga_status" AS ENUM('ongoing', 'completed', 'hiatus', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."moderation_target_kind" AS ENUM('user', 'manga', 'volume', 'chapter', 'comment', 'group', 'person', 'tag', 'image_server2', 'system_notice', 'avatar_frame', 'avatar_frame_topic', 'shop_chest');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('manga_new_chapter', 'group_join_requested', 'group_join_approved', 'group_join_rejected', 'group_member_removed', 'group_member_left', 'group_approved', 'group_rejected', 'content_group_added', 'group_leader_assigned');--> statement-breakpoint
CREATE TYPE "public"."person_role" AS ENUM('author', 'artist');--> statement-breakpoint
CREATE TYPE "public"."publication_state" AS ENUM('draft', 'published', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewing', 'resolved', 'rejected');--> statement-breakpoint
CREATE TABLE "avatar_frame" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"topic_id" uuid,
	"rarity" "avatar_frame_rarity" NOT NULL,
	"limited" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"asset_key" text,
	"display_scale" integer DEFAULT 125 NOT NULL,
	"offset_x" integer DEFAULT 0 NOT NULL,
	"offset_y" integer DEFAULT 0 NOT NULL,
	"shop_price" bigint,
	"shop_stock" integer DEFAULT 0 NOT NULL,
	"shop_version" integer DEFAULT 1 NOT NULL,
	"preview_key" text,
	"width" integer,
	"height" integer,
	"frame_count" integer,
	"byte_size" integer,
	"preview_byte_size" integer,
	"sha256" text,
	"preview_sha256" text,
	"source_sha256" text,
	"loop" integer,
	"delays" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_frame_code_unique" UNIQUE("code"),
	CONSTRAINT "avatar_frame_description_check" CHECK (length("avatar_frame"."description") <= 2000),
	CONSTRAINT "avatar_frame_limited_check" CHECK (NOT "avatar_frame"."limited" OR "avatar_frame"."rarity" = 'SSR'),
	CONSTRAINT "avatar_frame_version_check" CHECK ("avatar_frame"."version" > 0),
	CONSTRAINT "avatar_frame_display_scale_check" CHECK ("avatar_frame"."display_scale" BETWEEN 50 AND 200),
	CONSTRAINT "avatar_frame_offset_x_check" CHECK ("avatar_frame"."offset_x" BETWEEN -50 AND 50),
	CONSTRAINT "avatar_frame_offset_y_check" CHECK ("avatar_frame"."offset_y" BETWEEN -50 AND 50),
	CONSTRAINT "avatar_frame_shop_price_check" CHECK ("avatar_frame"."shop_price" > 0),
	CONSTRAINT "avatar_frame_shop_stock_check" CHECK ("avatar_frame"."shop_stock" >= 0),
	CONSTRAINT "avatar_frame_shop_version_check" CHECK ("avatar_frame"."shop_version" > 0),
	CONSTRAINT "avatar_frame_name_check" CHECK (length(btrim("avatar_frame"."name")) BETWEEN 1 AND 160),
	CONSTRAINT "avatar_frame_code_check" CHECK ("avatar_frame"."code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("avatar_frame"."code") <= 160),
	CONSTRAINT "avatar_frame_ready_check" CHECK (
    (NOT "avatar_frame"."active" OR "avatar_frame"."asset_key" IS NOT NULL) AND (
      ("avatar_frame"."asset_key" IS NULL AND num_nonnulls("avatar_frame"."preview_key", "avatar_frame"."width", "avatar_frame"."height", "avatar_frame"."frame_count", "avatar_frame"."byte_size", "avatar_frame"."preview_byte_size", "avatar_frame"."sha256", "avatar_frame"."preview_sha256", "avatar_frame"."source_sha256", "avatar_frame"."delays", "avatar_frame"."loop") = 0)
      OR ("avatar_frame"."asset_key" IS NOT NULL AND "avatar_frame"."preview_key" IS NOT NULL
        AND num_nonnulls("avatar_frame"."preview_key", "avatar_frame"."width", "avatar_frame"."height", "avatar_frame"."frame_count", "avatar_frame"."byte_size", "avatar_frame"."preview_byte_size", "avatar_frame"."sha256", "avatar_frame"."preview_sha256", "avatar_frame"."source_sha256", "avatar_frame"."delays") = 10
        AND "avatar_frame"."width" BETWEEN 1 AND 318 AND "avatar_frame"."height" BETWEEN 1 AND 318
        AND "avatar_frame"."frame_count" BETWEEN 1 AND 120
        AND "avatar_frame"."byte_size" BETWEEN 1 AND CASE WHEN "avatar_frame"."frame_count" > 1 THEN 5242880 ELSE 2000000 END
        AND "avatar_frame"."preview_byte_size" BETWEEN 1 AND 2000000
        AND "avatar_frame"."sha256" ~ '^[0-9a-f]{64}$' AND "avatar_frame"."preview_sha256" ~ '^[0-9a-f]{64}$' AND "avatar_frame"."source_sha256" ~ '^[0-9a-f]{64}$'
        AND "avatar_frame"."delays" IS NOT NULL)
    ))
);
--> statement-breakpoint
CREATE TABLE "avatar_frame_topic" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avatar_frame_topic_name_check" CHECK (length(btrim("avatar_frame_topic"."name")) BETWEEN 1 AND 160),
	CONSTRAINT "avatar_frame_topic_version_check" CHECK ("avatar_frame_topic"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "chapter" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"numbering_mode" "chapter_numbering_mode" DEFAULT 'global' NOT NULL,
	"reading_key" text GENERATED ALWAYS AS (CASE WHEN "chapter"."number" IS NULL OR ("chapter"."numbering_mode" = 'volume' AND "chapter"."volume_id" IS NULL) THEN 'id:' || "chapter"."id"::text WHEN "chapter"."numbering_mode" = 'volume' THEN 'v:' || "chapter"."volume_id"::text || ':' || "chapter"."number"::text ELSE 'n:' || "chapter"."number"::text END) STORED NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"owner_group_id" text NOT NULL,
	"manga_id" uuid NOT NULL,
	"uploader_user_id" text,
	"volume_id" uuid,
	"number" numeric(10, 3),
	"title" text,
	"language" text NOT NULL,
	"page_count" integer NOT NULL,
	"available_page_count" integer NOT NULL,
	"pages_version" integer DEFAULT 0 NOT NULL,
	"is_full" boolean NOT NULL,
	"publication_state" "publication_state" DEFAULT 'draft' NOT NULL,
	"moderation_hidden_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"delete_reason" text,
	CONSTRAINT "chapter_id_manga_id_unique" UNIQUE("id","manga_id"),
	CONSTRAINT "chapter_page_count_check" CHECK ("chapter"."page_count" >= 0),
	CONSTRAINT "chapter_version_check" CHECK ("chapter"."version" > 0),
	CONSTRAINT "chapter_pages_version_check" CHECK ("chapter"."pages_version" >= 0),
	CONSTRAINT "chapter_available_page_count_check" CHECK ("chapter"."available_page_count" >= 0 AND "chapter"."available_page_count" <= "chapter"."page_count"),
	CONSTRAINT "chapter_published_at_check" CHECK ("chapter"."publication_state" <> 'published' OR "chapter"."published_at" IS NOT NULL),
	CONSTRAINT "chapter_delete_metadata_check" CHECK ("chapter"."deleted_at" IS NOT NULL OR ("chapter"."deleted_by_user_id" IS NULL AND "chapter"."delete_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "chapter_group" (
	"chapter_id" uuid NOT NULL,
	"group_id" text NOT NULL,
	CONSTRAINT "chapter_group_chapter_id_group_id_pk" PRIMARY KEY("chapter_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "chapter_page" (
	"chapter_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"original_key" text NOT NULL,
	"optimized_key" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"optimized_width" integer,
	"optimized_height" integer,
	CONSTRAINT "chapter_page_chapter_id_position_pk" PRIMARY KEY("chapter_id","position"),
	CONSTRAINT "chapter_page_position_check" CHECK ("chapter_page"."position" >= 0),
	CONSTRAINT "chapter_page_dimensions_check" CHECK ("chapter_page"."width" > 0 AND "chapter_page"."height" > 0),
	CONSTRAINT "chapter_page_optimized_dimensions_check" CHECK (("chapter_page"."optimized_width" IS NULL AND "chapter_page"."optimized_height" IS NULL) OR ("chapter_page"."optimized_width" > 0 AND "chapter_page"."optimized_height" > 0)),
	CONSTRAINT "chapter_page_original_key_check" CHECK ("chapter_page"."original_key" <> '' AND "chapter_page"."original_key" !~ '^[a-z][a-z0-9+.-]*://' AND "chapter_page"."original_key" !~ '^/'),
	CONSTRAINT "chapter_page_optimized_key_check" CHECK ("chapter_page"."optimized_key" IS NULL OR ("chapter_page"."optimized_key" <> '' AND "chapter_page"."optimized_key" !~ '^[a-z][a-z0-9+.-]*://' AND "chapter_page"."optimized_key" !~ '^/'))
);
--> statement-breakpoint
CREATE TABLE "chapter_stats" (
	"chapter_id" uuid PRIMARY KEY NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_stats_nonnegative_check" CHECK ("chapter_stats"."views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chapter_tiktok_replica" (
	"chapter_id" uuid PRIMARY KEY NOT NULL,
	"source_version" integer NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"total_pages" integer NOT NULL,
	"pages" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"claim_token" uuid,
	"claim_expires_at" timestamp with time zone,
	"last_error_code" text,
	"last_error" text,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_tiktok_replica_version_check" CHECK ("chapter_tiktok_replica"."source_version" >= 0),
	CONSTRAINT "chapter_tiktok_replica_pages_check" CHECK ("chapter_tiktok_replica"."total_pages" BETWEEN 1 AND 220 AND jsonb_typeof("chapter_tiktok_replica"."pages") = 'object'),
	CONSTRAINT "chapter_tiktok_replica_state_check" CHECK ("chapter_tiktok_replica"."state" IN ('pending', 'running', 'retry_wait', 'ready', 'failed')),
	CONSTRAINT "chapter_tiktok_replica_attempts_check" CHECK ("chapter_tiktok_replica"."attempts" >= 0),
	CONSTRAINT "chapter_tiktok_replica_claim_check" CHECK (("chapter_tiktok_replica"."state" = 'running') = ("chapter_tiktok_replica"."claim_token" IS NOT NULL AND "chapter_tiktok_replica"."claim_expires_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "chapter_upload_final_object" (
	"session_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	CONSTRAINT "chapter_upload_final_object_session_id_object_key_pk" PRIMARY KEY("session_id","object_key"),
	CONSTRAINT "chapter_upload_final_object_key_check" CHECK ("chapter_upload_final_object"."object_key" <> '' AND "chapter_upload_final_object"."object_key" !~ '^[a-z][a-z0-9+.-]*://' AND "chapter_upload_final_object"."object_key" !~ '^/')
);
--> statement-breakpoint
CREATE TABLE "chapter_upload_page" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"state" "chapter_upload_page_state" DEFAULT 'uploading' NOT NULL,
	"staging_key" text,
	"published_original_key" text,
	"published_optimized_key" text,
	"width" integer,
	"height" integer,
	"source_byte_size" integer,
	"stored_byte_size" integer,
	"sha256" text,
	"published_optimized_width" integer,
	"published_optimized_height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_upload_page_staging_key_unique" UNIQUE("staging_key"),
	CONSTRAINT "chapter_upload_page_key_check" CHECK (("chapter_upload_page"."staging_key" IS NOT NULL AND "chapter_upload_page"."published_original_key" IS NULL) OR ("chapter_upload_page"."staging_key" IS NULL AND "chapter_upload_page"."published_original_key" IS NOT NULL)),
	CONSTRAINT "chapter_upload_page_staging_key_check" CHECK ("chapter_upload_page"."staging_key" IS NULL OR ("chapter_upload_page"."staging_key" <> '' AND "chapter_upload_page"."staging_key" !~ '^[a-z][a-z0-9+.-]*://' AND "chapter_upload_page"."staging_key" !~ '^/')),
	CONSTRAINT "chapter_upload_page_published_key_check" CHECK ("chapter_upload_page"."published_original_key" IS NULL OR ("chapter_upload_page"."published_original_key" <> '' AND "chapter_upload_page"."published_original_key" !~ '^[a-z][a-z0-9+.-]*://' AND "chapter_upload_page"."published_original_key" !~ '^/')),
	CONSTRAINT "chapter_upload_page_metadata_check" CHECK ("chapter_upload_page"."state" <> 'ready' OR ("chapter_upload_page"."width" > 0 AND "chapter_upload_page"."height" > 0 AND ("chapter_upload_page"."published_original_key" IS NOT NULL OR ("chapter_upload_page"."source_byte_size" > 0 AND "chapter_upload_page"."stored_byte_size" > 0 AND "chapter_upload_page"."sha256" ~ '^[0-9a-f]{64}$')))),
	CONSTRAINT "chapter_upload_page_published_optimized_check" CHECK (("chapter_upload_page"."published_optimized_key" IS NULL OR ("chapter_upload_page"."published_original_key" IS NOT NULL AND "chapter_upload_page"."published_optimized_key" <> '' AND "chapter_upload_page"."published_optimized_key" !~ '^[a-z][a-z0-9+.-]*://' AND "chapter_upload_page"."published_optimized_key" !~ '^/')) AND (("chapter_upload_page"."published_optimized_width" IS NULL AND "chapter_upload_page"."published_optimized_height" IS NULL) OR ("chapter_upload_page"."published_original_key" IS NOT NULL AND "chapter_upload_page"."published_optimized_width" > 0 AND "chapter_upload_page"."published_optimized_height" > 0)))
);
--> statement-breakpoint
CREATE TABLE "chapter_upload_session" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"chapter_id" uuid,
	"manga_id" uuid NOT NULL,
	"actor_user_id" text,
	"group_id" text NOT NULL,
	"mode" "chapter_upload_mode" NOT NULL,
	"expected_chapter_version" integer,
	"state" "chapter_upload_state" DEFAULT 'open' NOT NULL,
	"ordered_page_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"finalize_claim_token" uuid,
	"finalize_claim_expires_at" timestamp with time zone,
	"finalize_error" text,
	"committed_result" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_upload_session_version_check" CHECK (("chapter_upload_session"."chapter_id" IS NULL AND "chapter_upload_session"."mode" = 'initial' AND "chapter_upload_session"."expected_chapter_version" IS NULL) OR ("chapter_upload_session"."chapter_id" IS NOT NULL AND "chapter_upload_session"."expected_chapter_version" > 0)),
	CONSTRAINT "chapter_upload_session_order_check" CHECK (cardinality("chapter_upload_session"."ordered_page_ids") <= 220)
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"user_id" text NOT NULL,
	"manga_id" uuid NOT NULL,
	"chapter_id" uuid,
	"parent_id" uuid,
	"body" text NOT NULL,
	"creation_key" uuid,
	"creation_fingerprint" text,
	"status" "comment_status" DEFAULT 'visible' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"delete_reason" text,
	CONSTRAINT "comment_creation_receipt_check" CHECK (("comment"."creation_key" IS NULL AND "comment"."creation_fingerprint" IS NULL) OR ("comment"."creation_key" IS NOT NULL AND "comment"."creation_fingerprint" IS NOT NULL AND "comment"."creation_fingerprint" ~ '^[0-9a-f]{64}$')),
	CONSTRAINT "comment_body_check" CHECK (length(btrim("comment"."body")) > 0),
	CONSTRAINT "comment_version_check" CHECK ("comment"."version" > 0),
	CONSTRAINT "comment_delete_metadata_check" CHECK ("comment"."deleted_at" IS NOT NULL OR ("comment"."deleted_by_user_id" IS NULL AND "comment"."delete_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "content_report" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"reporter_user_id" text,
	"manga_id" uuid,
	"chapter_id" uuid,
	"comment_id" uuid,
	"group_id" text,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"reviewer_user_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_report_single_target_check" CHECK (num_nonnulls("content_report"."manga_id", "content_report"."chapter_id", "content_report"."comment_id", "content_report"."group_id") = 1),
	CONSTRAINT "content_report_reason_check" CHECK (length(btrim("content_report"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "cover" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"manga_id" uuid NOT NULL,
	"volume_id" uuid,
	"storage_key" text NOT NULL,
	"language" text,
	"description" text,
	"width" integer,
	"height" integer,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cover_dimensions_check" CHECK (("cover"."width" IS NULL AND "cover"."height" IS NULL) OR ("cover"."width" > 0 AND "cover"."height" > 0)),
	CONSTRAINT "cover_storage_key_check" CHECK ("cover"."storage_key" <> '' AND "cover"."storage_key" !~ '^[a-z][a-z0-9+.-]*://' AND "cover"."storage_key" !~ '^/')
);
--> statement-breakpoint
CREATE TABLE "cover_upload_operation" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"manga_id" uuid NOT NULL,
	"group_id" text NOT NULL,
	"actor_user_id" text,
	"original_key" text NOT NULL,
	"medium_key" text NOT NULL,
	"small_key" text NOT NULL,
	"state" "cover_upload_state" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cover_upload_operation_keys_check" CHECK ("cover_upload_operation"."original_key" <> '' AND "cover_upload_operation"."medium_key" <> '' AND "cover_upload_operation"."small_key" <> '' AND "cover_upload_operation"."original_key" !~ '^[a-z][a-z0-9+.-]*://' AND "cover_upload_operation"."medium_key" !~ '^[a-z][a-z0-9+.-]*://' AND "cover_upload_operation"."small_key" !~ '^[a-z][a-z0-9+.-]*://' AND "cover_upload_operation"."original_key" !~ '^/' AND "cover_upload_operation"."medium_key" !~ '^/' AND "cover_upload_operation"."small_key" !~ '^/'),
	CONSTRAINT "cover_upload_operation_attached_check" CHECK (("cover_upload_operation"."state" = 'attached') = ("cover_upload_operation"."attached_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "cover_upload_session" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"manga_id" uuid,
	"group_id" text NOT NULL,
	"actor_user_id" text,
	"create_flow" boolean DEFAULT false NOT NULL,
	"original_staging_key" text NOT NULL,
	"medium_staging_key" text NOT NULL,
	"small_staging_key" text NOT NULL,
	"original_sha256" text NOT NULL,
	"medium_sha256" text NOT NULL,
	"small_sha256" text NOT NULL,
	"original_byte_size" integer NOT NULL,
	"medium_byte_size" integer NOT NULL,
	"small_byte_size" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"state" "cover_upload_state" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attached_at" timestamp with time zone,
	"staging_cleaned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cover_upload_session_keys_check" CHECK ("cover_upload_session"."original_staging_key" <> '' AND "cover_upload_session"."medium_staging_key" <> '' AND "cover_upload_session"."small_staging_key" <> '' AND "cover_upload_session"."original_staging_key" !~ '^[a-z][a-z0-9+.-]*://' AND "cover_upload_session"."medium_staging_key" !~ '^[a-z][a-z0-9+.-]*://' AND "cover_upload_session"."small_staging_key" !~ '^[a-z][a-z0-9+.-]*://' AND "cover_upload_session"."original_staging_key" !~ '^/' AND "cover_upload_session"."medium_staging_key" !~ '^/' AND "cover_upload_session"."small_staging_key" !~ '^/'),
	CONSTRAINT "cover_upload_session_hashes_check" CHECK ("cover_upload_session"."original_sha256" ~ '^[0-9a-f]{64}$' AND "cover_upload_session"."medium_sha256" ~ '^[0-9a-f]{64}$' AND "cover_upload_session"."small_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "cover_upload_session_dimensions_check" CHECK ("cover_upload_session"."width" > 0 AND "cover_upload_session"."height" > 0 AND "cover_upload_session"."original_byte_size" > 0 AND "cover_upload_session"."medium_byte_size" > 0 AND "cover_upload_session"."small_byte_size" > 0),
	CONSTRAINT "cover_upload_session_attached_check" CHECK (("cover_upload_session"."state" = 'attached') = ("cover_upload_session"."attached_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "forbidden_word" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"word" text NOT NULL,
	"normalized_word" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forbidden_word_word_check" CHECK (length("forbidden_word"."word") between 1 and 80),
	CONSTRAINT "forbidden_word_normalized_check" CHECK (length("forbidden_word"."normalized_word") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "image_server2_control" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_server2_control_singleton" CHECK ("image_server2_control"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "library_item" (
	"user_id" text NOT NULL,
	"manga_id" uuid NOT NULL,
	"category" "library_category" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_item_user_id_manga_id_pk" PRIMARY KEY("user_id","manga_id")
);
--> statement-breakpoint
CREATE TABLE "manga" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"numbering_mode" "chapter_numbering_mode" DEFAULT 'global' NOT NULL,
	"owner_group_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"alternative_titles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"search_title" text NOT NULL,
	"original_language" text NOT NULL,
	"publication_demographic" text,
	"status" "manga_status" NOT NULL,
	"content_rating" "content_rating" NOT NULL,
	"publication_state" "publication_state" DEFAULT 'published' NOT NULL,
	"moderation_hidden_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"year" integer,
	"last_volume" text,
	"last_chapter" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"has_usable_chapters" boolean DEFAULT false NOT NULL,
	"latest_chapter_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone DEFAULT now(),
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"delete_reason" text,
	CONSTRAINT "manga_id_numbering_mode_unique" UNIQUE("id","numbering_mode"),
	CONSTRAINT "manga_slug_check" CHECK ("manga"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "manga_version_check" CHECK ("manga"."version" > 0),
	CONSTRAINT "manga_published_at_check" CHECK ("manga"."publication_state" <> 'published' OR "manga"."published_at" IS NOT NULL),
	CONSTRAINT "manga_delete_metadata_check" CHECK ("manga"."deleted_at" IS NOT NULL OR ("manga"."deleted_by_user_id" IS NULL AND "manga"."delete_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "manga_engagement_daily" (
	"manga_id" uuid NOT NULL,
	"bucket_date" date NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"follow_adds" bigint DEFAULT 0 NOT NULL,
	"follow_removes" bigint DEFAULT 0 NOT NULL,
	"comments" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manga_engagement_daily_manga_id_bucket_date_pk" PRIMARY KEY("manga_id","bucket_date"),
	CONSTRAINT "manga_engagement_daily_nonnegative_check" CHECK ("manga_engagement_daily"."views" >= 0 AND "manga_engagement_daily"."follow_adds" >= 0 AND "manga_engagement_daily"."follow_removes" >= 0 AND "manga_engagement_daily"."comments" >= 0)
);
--> statement-breakpoint
CREATE TABLE "manga_group" (
	"manga_id" uuid NOT NULL,
	"group_id" text NOT NULL,
	"is_explicit" boolean DEFAULT false NOT NULL,
	CONSTRAINT "manga_group_manga_id_group_id_pk" PRIMARY KEY("manga_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "manga_language" (
	"manga_id" uuid NOT NULL,
	"language" text NOT NULL,
	CONSTRAINT "manga_language_manga_id_language_pk" PRIMARY KEY("manga_id","language")
);
--> statement-breakpoint
CREATE TABLE "manga_person" (
	"manga_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "person_role" NOT NULL,
	CONSTRAINT "manga_person_manga_id_person_id_role_pk" PRIMARY KEY("manga_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "manga_stats" (
	"manga_id" uuid PRIMARY KEY NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"follows" bigint DEFAULT 0 NOT NULL,
	"comments" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manga_stats_nonnegative_check" CHECK ("manga_stats"."views" >= 0 AND "manga_stats"."follows" >= 0 AND "manga_stats"."comments" >= 0)
);
--> statement-breakpoint
CREATE TABLE "manga_tag" (
	"manga_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "manga_tag_manga_id_tag_id_pk" PRIMARY KEY("manga_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "manga_volume" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"manga_id" uuid NOT NULL,
	"number" numeric(10, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"delete_reason" text,
	CONSTRAINT "manga_volume_id_manga_id_unique" UNIQUE("id","manga_id"),
	CONSTRAINT "manga_volume_delete_metadata_check" CHECK ("manga_volume"."deleted_at" IS NOT NULL OR ("manga_volume"."deleted_by_user_id" IS NULL AND "manga_volume"."delete_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "moderation_action" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"target_kind" "moderation_target_kind" NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_action_action_check" CHECK (length(btrim("moderation_action"."action")) > 0),
	CONSTRAINT "moderation_action_reason_check" CHECK (length(btrim("moderation_action"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"manga_id" uuid,
	"chapter_id" uuid,
	"group_id" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notification_target_check" CHECK (("notification"."type" = 'manga_new_chapter' AND "notification"."manga_id" IS NOT NULL AND "notification"."chapter_id" IS NOT NULL AND "notification"."group_id" IS NULL) OR ("notification"."type" <> 'manga_new_chapter' AND "notification"."manga_id" IS NULL AND "notification"."chapter_id" IS NULL AND "notification"."group_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_slug_check" CHECK ("person"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "reading_history" (
	"user_id" text NOT NULL,
	"chapter_id" uuid NOT NULL,
	"manga_id" uuid NOT NULL,
	"read_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_history_user_id_chapter_id_pk" PRIMARY KEY("user_id","chapter_id")
);
--> statement-breakpoint
CREATE TABLE "shop_chest" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"kind" text NOT NULL,
	"topic_id" uuid,
	"topic_name" text,
	"sale_enabled" boolean DEFAULT false NOT NULL,
	"retired_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_chest_version_check" CHECK ("shop_chest"."version" > 0),
	CONSTRAINT "shop_chest_lifecycle_check" CHECK (("shop_chest"."kind" = 'common' AND "shop_chest"."topic_id" IS NULL AND "shop_chest"."topic_name" IS NULL AND "shop_chest"."retired_at" IS NULL)
        OR ("shop_chest"."kind" = 'topic' AND "shop_chest"."topic_name" IS NOT NULL
          AND length(btrim("shop_chest"."topic_name")) BETWEEN 1 AND 160
          AND (("shop_chest"."topic_id" IS NOT NULL AND "shop_chest"."retired_at" IS NULL)
            OR ("shop_chest"."topic_id" IS NULL AND "shop_chest"."retired_at" IS NOT NULL AND NOT "shop_chest"."sale_enabled"))))
);
--> statement-breakpoint
CREATE TABLE "shop_gacha_roll" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"actor_user_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"chest_id" uuid NOT NULL,
	"chest_kind" text NOT NULL,
	"chest_name" text NOT NULL,
	"topic_id" uuid,
	"chest_version" integer NOT NULL,
	"rule_version" integer NOT NULL,
	"rule_snapshot" jsonb NOT NULL,
	"pool_digest" text NOT NULL,
	"frame_id" uuid NOT NULL,
	"frame_code" text NOT NULL,
	"frame_name" text NOT NULL,
	"frame_version" integer NOT NULL,
	"rarity" "avatar_frame_rarity" NOT NULL,
	"price" bigint NOT NULL,
	"duplicate" boolean NOT NULL,
	"refund" bigint NOT NULL,
	"roll_sequence" bigint NOT NULL,
	"since_sr_before" integer NOT NULL,
	"since_ssr_before" integer NOT NULL,
	"since_sr_after" integer NOT NULL,
	"since_ssr_after" integer NOT NULL,
	"coin_operation_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_gacha_roll_coin_operation_key_unique" UNIQUE("coin_operation_key"),
	CONSTRAINT "shop_gacha_roll_actor_operation_unique" UNIQUE("actor_user_id","operation_id"),
	CONSTRAINT "shop_gacha_roll_actor_sequence_unique" UNIQUE("actor_user_id","roll_sequence"),
	CONSTRAINT "shop_gacha_roll_actor_check" CHECK (length(btrim("shop_gacha_roll"."actor_user_id")) > 0),
	CONSTRAINT "shop_gacha_roll_hash_check" CHECK ("shop_gacha_roll"."fingerprint" ~ '^[0-9a-f]{64}$' AND "shop_gacha_roll"."pool_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shop_gacha_roll_chest_check" CHECK ("shop_gacha_roll"."chest_version" > 0 AND length(btrim("shop_gacha_roll"."chest_name")) BETWEEN 1 AND 180
        AND (("shop_gacha_roll"."chest_kind" = 'common' AND "shop_gacha_roll"."topic_id" IS NULL)
          OR ("shop_gacha_roll"."chest_kind" = 'topic' AND "shop_gacha_roll"."topic_id" IS NOT NULL))),
	CONSTRAINT "shop_gacha_roll_frame_check" CHECK ("shop_gacha_roll"."frame_version" > 0 AND length(btrim("shop_gacha_roll"."frame_name")) BETWEEN 1 AND 160
        AND "shop_gacha_roll"."frame_code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("shop_gacha_roll"."frame_code") <= 160),
	CONSTRAINT "shop_gacha_roll_rule_check" CHECK ("shop_gacha_roll"."rule_version" = 1 AND "shop_gacha_roll"."price" = 5
        AND "shop_gacha_roll"."rule_snapshot" = '{"version":1,"price":"5","rateDenominator":10000,"rates":{"R":8750,"SR":1000,"SSR":250},"duplicateRefund":{"R":"1","SR":"5","SSR":"20"},"srPity":10,"ssrPity":50}'::jsonb),
	CONSTRAINT "shop_gacha_roll_refund_check" CHECK ((NOT "shop_gacha_roll"."duplicate" AND "shop_gacha_roll"."refund" = 0) OR ("shop_gacha_roll"."duplicate" AND "shop_gacha_roll"."refund" =
        CASE "shop_gacha_roll"."rarity" WHEN 'R' THEN 1 WHEN 'SR' THEN 5 WHEN 'SSR' THEN 20 END)),
	CONSTRAINT "shop_gacha_roll_counters_check" CHECK ("shop_gacha_roll"."roll_sequence" > 0
        AND "shop_gacha_roll"."since_sr_before" BETWEEN 0 AND 9 AND "shop_gacha_roll"."since_ssr_before" BETWEEN 0 AND 49
        AND "shop_gacha_roll"."since_sr_before" <= "shop_gacha_roll"."since_ssr_before" AND "shop_gacha_roll"."since_ssr_before" < "shop_gacha_roll"."roll_sequence"
        AND "shop_gacha_roll"."since_sr_after" BETWEEN 0 AND 9 AND "shop_gacha_roll"."since_ssr_after" BETWEEN 0 AND 49
        AND "shop_gacha_roll"."since_sr_after" <= "shop_gacha_roll"."since_ssr_after"
        AND (("shop_gacha_roll"."rarity" = 'SSR' AND "shop_gacha_roll"."since_sr_after" = 0 AND "shop_gacha_roll"."since_ssr_after" = 0)
          OR ("shop_gacha_roll"."rarity" = 'SR' AND "shop_gacha_roll"."since_sr_after" = 0 AND "shop_gacha_roll"."since_ssr_after" = "shop_gacha_roll"."since_ssr_before" + 1)
          OR ("shop_gacha_roll"."rarity" = 'R' AND "shop_gacha_roll"."since_sr_after" = "shop_gacha_roll"."since_sr_before" + 1 AND "shop_gacha_roll"."since_ssr_after" = "shop_gacha_roll"."since_ssr_before" + 1)))
);
--> statement-breakpoint
CREATE TABLE "shop_gacha_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"since_sr" integer DEFAULT 0 NOT NULL,
	"since_ssr" integer DEFAULT 0 NOT NULL,
	"roll_count" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_gacha_state_counters_check" CHECK ("shop_gacha_state"."since_sr" BETWEEN 0 AND 9 AND "shop_gacha_state"."since_ssr" BETWEEN 0 AND 49
        AND "shop_gacha_state"."since_sr" <= "shop_gacha_state"."since_ssr" AND "shop_gacha_state"."roll_count" >= "shop_gacha_state"."since_ssr")
);
--> statement-breakpoint
CREATE TABLE "shop_purchase" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"actor_user_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"frame_id" uuid NOT NULL,
	"frame_code" text NOT NULL,
	"frame_name" text NOT NULL,
	"rarity" "avatar_frame_rarity" NOT NULL,
	"price" bigint NOT NULL,
	"frame_version" integer NOT NULL,
	"coin_operation_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_purchase_coin_operation_key_unique" UNIQUE("coin_operation_key"),
	CONSTRAINT "shop_purchase_actor_operation_unique" UNIQUE("actor_user_id","operation_id"),
	CONSTRAINT "shop_purchase_actor_check" CHECK (length(btrim("shop_purchase"."actor_user_id")) > 0),
	CONSTRAINT "shop_purchase_fingerprint_check" CHECK ("shop_purchase"."fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shop_purchase_price_check" CHECK ("shop_purchase"."price" > 0),
	CONSTRAINT "shop_purchase_frame_version_check" CHECK ("shop_purchase"."frame_version" > 0),
	CONSTRAINT "shop_purchase_frame_name_check" CHECK (length(btrim("shop_purchase"."frame_name")) BETWEEN 1 AND 160),
	CONSTRAINT "shop_purchase_frame_code_check" CHECK ("shop_purchase"."frame_code" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("shop_purchase"."frame_code") <= 160)
);
--> statement-breakpoint
CREATE TABLE "system_notice" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_notice_title_check" CHECK (length("system_notice"."title") between 1 and 160),
	CONSTRAINT "system_notice_content_check" CHECK (length("system_notice"."content") between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "system_notice_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"read_through_created_at" timestamp (3) with time zone NOT NULL,
	"read_through_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"slug" text NOT NULL,
	"group" text NOT NULL,
	"name" text NOT NULL,
	"moderation_hidden_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "tag_slug_check" CHECK ("tag"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "tag_slug_length_check" CHECK (length("tag"."slug") between 1 and 160),
	CONSTRAINT "tag_name_check" CHECK (length(btrim("tag"."name")) between 1 and 100),
	CONSTRAINT "tag_group_check" CHECK ("tag"."group" in ('content', 'format', 'genre', 'theme')),
	CONSTRAINT "tag_version_check" CHECK ("tag"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "translation_group_application" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" "group_application_type" NOT NULL,
	"status" "membership_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_group_application_organization_user_uidx" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "translation_group_manga_engagement_daily" (
	"group_id" text NOT NULL,
	"manga_id" uuid NOT NULL,
	"bucket_date" date NOT NULL,
	"views" numeric(14, 1) DEFAULT 0 NOT NULL,
	"actual_views" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_group_manga_engagement_daily_group_id_manga_id_bucket_date_pk" PRIMARY KEY("group_id","manga_id","bucket_date"),
	CONSTRAINT "translation_group_manga_engagement_daily_nonnegative_check" CHECK ("translation_group_manga_engagement_daily"."views" >= 0 AND "translation_group_manga_engagement_daily"."actual_views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "translation_group_manga_view_stats" (
	"group_id" text NOT NULL,
	"manga_id" uuid NOT NULL,
	"views" numeric(14, 1) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_group_manga_view_stats_group_id_manga_id_pk" PRIMARY KEY("group_id","manga_id"),
	CONSTRAINT "translation_group_manga_view_stats_nonnegative_check" CHECK ("translation_group_manga_view_stats"."views" >= 0)
);
--> statement-breakpoint
CREATE TABLE "translation_group_member_profile" (
	"member_id" text PRIMARY KEY NOT NULL,
	"can_add_manga" boolean DEFAULT false NOT NULL,
	"can_edit_manga" boolean DEFAULT false NOT NULL,
	"can_delete_manga" boolean DEFAULT false NOT NULL,
	"can_add_chapter" boolean DEFAULT false NOT NULL,
	"can_edit_chapter" boolean DEFAULT false NOT NULL,
	"can_delete_chapter" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_group_profile" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"description" text,
	"banner_url" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"inactive" boolean DEFAULT false NOT NULL,
	"approval_status" "membership_status" DEFAULT 'approved' NOT NULL,
	"created_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"rejection_reason" text,
	"publication_state" "publication_state" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" text,
	"delete_reason" text,
	CONSTRAINT "translation_group_profile_delete_metadata_check" CHECK ("translation_group_profile"."deleted_at" IS NOT NULL OR ("translation_group_profile"."deleted_by_user_id" IS NULL AND "translation_group_profile"."delete_reason" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "user_avatar_frame" (
	"user_id" text NOT NULL,
	"frame_id" uuid NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by_user_id" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "user_avatar_frame_user_id_frame_id_pk" PRIMARY KEY("user_id","frame_id")
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"bio" text,
	"avatar_frame_id" uuid,
	"is_public" boolean DEFAULT true NOT NULL,
	"status" "account_status" DEFAULT 'active' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"moderated_at" timestamp with time zone,
	"moderated_by_user_id" text,
	"moderation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_version_check" CHECK ("user_profile"."version" > 0),
	CONSTRAINT "user_profile_moderation_check" CHECK ("user_profile"."status" = 'active' OR ("user_profile"."moderated_at" IS NOT NULL AND "user_profile"."moderation_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coin_comment_reward" (
	"comment_id" uuid PRIMARY KEY NOT NULL,
	"wallet_id" uuid NOT NULL,
	"qualifying" boolean DEFAULT false NOT NULL,
	"rewarded_amount" integer DEFAULT 0 NOT NULL,
	"reversal_amount" integer DEFAULT 0 NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_comment_reward_state_check" CHECK ("coin_comment_reward"."rewarded_amount" BETWEEN 0 AND 1 AND "coin_comment_reward"."reversal_amount" BETWEEN 0 AND 1 AND "coin_comment_reward"."rewarded_amount" + "coin_comment_reward"."reversal_amount" <= 1 AND "coin_comment_reward"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "coin_ledger" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"operation_key" text NOT NULL,
	"position" integer NOT NULL,
	"wallet_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"mode" text NOT NULL,
	"requested_amount" bigint NOT NULL,
	"delta" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reference_ledger_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_ledger_operation_position_unique" UNIQUE("operation_key","position"),
	CONSTRAINT "coin_ledger_wallet_sequence_unique" UNIQUE("wallet_id","sequence"),
	CONSTRAINT "coin_ledger_amount_check" CHECK ("coin_ledger"."requested_amount" > 0 AND "coin_ledger"."balance_after" >= 0 AND "coin_ledger"."sequence" > 0 AND "coin_ledger"."position" >= 0),
	CONSTRAINT "coin_ledger_delta_check" CHECK (("coin_ledger"."mode" = 'credit' AND "coin_ledger"."delta" = "coin_ledger"."requested_amount") OR ("coin_ledger"."mode" = 'debit' AND "coin_ledger"."delta" = -"coin_ledger"."requested_amount") OR ("coin_ledger"."mode" = 'penalty' AND "coin_ledger"."delta" BETWEEN -"coin_ledger"."requested_amount" AND 0))
);
--> statement-breakpoint
CREATE TABLE "coin_operation" (
	"key" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"transaction_group" uuid NOT NULL,
	"actor_user_id" text,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_operation_transaction_group_unique" UNIQUE("transaction_group"),
	CONSTRAINT "coin_operation_fingerprint_check" CHECK ("coin_operation"."fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coin_operation_key_check" CHECK (length("coin_operation"."key") BETWEEN 1 AND 240)
);
--> statement-breakpoint
CREATE TABLE "coin_view_receipt" (
	"session_hash" text NOT NULL,
	"chapter_id" uuid NOT NULL,
	"manga_id" uuid NOT NULL,
	"event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"allocations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "coin_view_receipt_session_hash_chapter_id_pk" PRIMARY KEY("session_hash","chapter_id"),
	CONSTRAINT "coin_view_receipt_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "coin_view_receipt_session_check" CHECK ("coin_view_receipt"."session_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coin_view_receipt_window_check" CHECK ("coin_view_receipt"."expires_at" > "coin_view_receipt"."accepted_at")
);
--> statement-breakpoint
CREATE TABLE "coin_wallet" (
	"id" uuid PRIMARY KEY DEFAULT public.uuid_generate_v7() NOT NULL,
	"user_id" text,
	"group_id" text,
	"balance" bigint DEFAULT 0 NOT NULL,
	"sequence" bigint DEFAULT 0 NOT NULL,
	"view_remainder_tenths" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_wallet_owner_check" CHECK (num_nonnulls("coin_wallet"."user_id", "coin_wallet"."group_id") = 1),
	CONSTRAINT "coin_wallet_balance_check" CHECK ("coin_wallet"."balance" >= 0 AND "coin_wallet"."sequence" >= 0),
	CONSTRAINT "coin_wallet_remainder_check" CHECK ("coin_wallet"."view_remainder_tenths" BETWEEN 0 AND 999 AND ("coin_wallet"."group_id" IS NOT NULL OR "coin_wallet"."view_remainder_tenths" = 0))
);
--> statement-breakpoint
ALTER TABLE "avatar_frame" ADD CONSTRAINT "avatar_frame_topic_id_avatar_frame_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."avatar_frame_topic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_owner_group_id_organization_id_fk" FOREIGN KEY ("owner_group_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_uploader_user_id_user_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_numbering_manga_fk" FOREIGN KEY ("manga_id","numbering_mode") REFERENCES "public"."manga"("id","numbering_mode") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_volume_manga_fk" FOREIGN KEY ("volume_id","manga_id") REFERENCES "public"."manga_volume"("id","manga_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_group" ADD CONSTRAINT "chapter_group_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_group" ADD CONSTRAINT "chapter_group_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_page" ADD CONSTRAINT "chapter_page_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_stats" ADD CONSTRAINT "chapter_stats_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_tiktok_replica" ADD CONSTRAINT "chapter_tiktok_replica_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_upload_final_object" ADD CONSTRAINT "chapter_upload_final_object_session_id_chapter_upload_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chapter_upload_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_upload_page" ADD CONSTRAINT "chapter_upload_page_session_id_chapter_upload_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chapter_upload_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_upload_session" ADD CONSTRAINT "chapter_upload_session_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_upload_session" ADD CONSTRAINT "chapter_upload_session_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_upload_session" ADD CONSTRAINT "chapter_upload_session_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_upload_session" ADD CONSTRAINT "chapter_upload_session_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_chapter_manga_fk" FOREIGN KEY ("chapter_id","manga_id") REFERENCES "public"."chapter"("id","manga_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_reporter_user_id_user_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover" ADD CONSTRAINT "cover_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover" ADD CONSTRAINT "cover_volume_manga_fk" FOREIGN KEY ("volume_id","manga_id") REFERENCES "public"."manga_volume"("id","manga_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_upload_operation" ADD CONSTRAINT "cover_upload_operation_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_upload_operation" ADD CONSTRAINT "cover_upload_operation_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_upload_operation" ADD CONSTRAINT "cover_upload_operation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_upload_session" ADD CONSTRAINT "cover_upload_session_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_upload_session" ADD CONSTRAINT "cover_upload_session_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_upload_session" ADD CONSTRAINT "cover_upload_session_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_item" ADD CONSTRAINT "library_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_item" ADD CONSTRAINT "library_item_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga" ADD CONSTRAINT "manga_owner_group_id_organization_id_fk" FOREIGN KEY ("owner_group_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga" ADD CONSTRAINT "manga_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_engagement_daily" ADD CONSTRAINT "manga_engagement_daily_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_group" ADD CONSTRAINT "manga_group_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_group" ADD CONSTRAINT "manga_group_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_language" ADD CONSTRAINT "manga_language_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_person" ADD CONSTRAINT "manga_person_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_person" ADD CONSTRAINT "manga_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_stats" ADD CONSTRAINT "manga_stats_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_tag" ADD CONSTRAINT "manga_tag_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_tag" ADD CONSTRAINT "manga_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_volume" ADD CONSTRAINT "manga_volume_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manga_volume" ADD CONSTRAINT "manga_volume_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_chapter_manga_fk" FOREIGN KEY ("chapter_id","manga_id") REFERENCES "public"."chapter"("id","manga_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_history" ADD CONSTRAINT "reading_history_chapter_manga_fk" FOREIGN KEY ("chapter_id","manga_id") REFERENCES "public"."chapter"("id","manga_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_chest" ADD CONSTRAINT "shop_chest_topic_id_avatar_frame_topic_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."avatar_frame_topic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_gacha_roll" ADD CONSTRAINT "shop_gacha_roll_chest_id_shop_chest_id_fk" FOREIGN KEY ("chest_id") REFERENCES "public"."shop_chest"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_gacha_roll" ADD CONSTRAINT "shop_gacha_roll_frame_id_avatar_frame_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."avatar_frame"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_gacha_roll" ADD CONSTRAINT "shop_gacha_roll_coin_operation_key_coin_operation_key_fk" FOREIGN KEY ("coin_operation_key") REFERENCES "public"."coin_operation"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_gacha_state" ADD CONSTRAINT "shop_gacha_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_purchase" ADD CONSTRAINT "shop_purchase_frame_id_avatar_frame_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."avatar_frame"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_purchase" ADD CONSTRAINT "shop_purchase_coin_operation_key_coin_operation_key_fk" FOREIGN KEY ("coin_operation_key") REFERENCES "public"."coin_operation"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_notice_state" ADD CONSTRAINT "system_notice_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_application" ADD CONSTRAINT "translation_group_application_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_application" ADD CONSTRAINT "translation_group_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_application" ADD CONSTRAINT "translation_group_application_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_manga_engagement_daily" ADD CONSTRAINT "translation_group_manga_engagement_daily_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_manga_engagement_daily" ADD CONSTRAINT "translation_group_manga_engagement_daily_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_manga_view_stats" ADD CONSTRAINT "translation_group_manga_view_stats_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_manga_view_stats" ADD CONSTRAINT "translation_group_manga_view_stats_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_member_profile" ADD CONSTRAINT "translation_group_member_profile_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_profile" ADD CONSTRAINT "translation_group_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_profile" ADD CONSTRAINT "translation_group_profile_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_profile" ADD CONSTRAINT "translation_group_profile_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation_group_profile" ADD CONSTRAINT "translation_group_profile_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatar_frame" ADD CONSTRAINT "user_avatar_frame_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatar_frame" ADD CONSTRAINT "user_avatar_frame_frame_id_avatar_frame_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."avatar_frame"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatar_frame" ADD CONSTRAINT "user_avatar_frame_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_avatar_frame_id_avatar_frame_id_fk" FOREIGN KEY ("avatar_frame_id") REFERENCES "public"."avatar_frame"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_moderated_by_user_id_user_id_fk" FOREIGN KEY ("moderated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_comment_reward" ADD CONSTRAINT "coin_comment_reward_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_comment_reward" ADD CONSTRAINT "coin_comment_reward_wallet_id_coin_wallet_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."coin_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_operation_key_coin_operation_key_fk" FOREIGN KEY ("operation_key") REFERENCES "public"."coin_operation"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_wallet_id_coin_wallet_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."coin_wallet"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_reference_ledger_id_coin_ledger_id_fk" FOREIGN KEY ("reference_ledger_id") REFERENCES "public"."coin_ledger"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_view_receipt" ADD CONSTRAINT "coin_view_receipt_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_view_receipt" ADD CONSTRAINT "coin_view_receipt_manga_id_manga_id_fk" FOREIGN KEY ("manga_id") REFERENCES "public"."manga"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_wallet" ADD CONSTRAINT "coin_wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_wallet" ADD CONSTRAINT "coin_wallet_group_id_organization_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "avatar_frame_catalog_idx" ON "avatar_frame" USING btree ("created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "avatar_frame_topic_idx" ON "avatar_frame" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "avatar_frame_topic_name_unique" ON "avatar_frame_topic" USING btree (lower(btrim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_default_slot_uidx" ON "chapter" USING btree ("manga_id","language","reading_key") WHERE "chapter"."deleted_at" IS NULL AND "chapter"."is_default";--> statement-breakpoint
CREATE INDEX "chapter_reading_slot_idx" ON "chapter" USING btree ("manga_id","language","reading_key");--> statement-breakpoint
CREATE INDEX "chapter_manga_published_idx" ON "chapter" USING btree ("manga_id","publication_state","moderation_hidden_at","deleted_at","published_at","id");--> statement-breakpoint
CREATE INDEX "chapter_owner_group_idx" ON "chapter" USING btree ("owner_group_id","id");--> statement-breakpoint
CREATE INDEX "chapter_replica_discovery_idx" ON "chapter" USING btree ("id") WHERE "chapter"."pages_version" > 0 AND "chapter"."publication_state" = 'published' AND "chapter"."moderation_hidden_at" IS NULL AND "chapter"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "chapter_group_group_idx" ON "chapter_group" USING btree ("group_id","chapter_id");--> statement-breakpoint
CREATE INDEX "chapter_tiktok_replica_due_idx" ON "chapter_tiktok_replica" USING btree ("next_retry_at","chapter_id") WHERE "chapter_tiktok_replica"."state" IN ('pending', 'retry_wait');--> statement-breakpoint
CREATE INDEX "chapter_tiktok_replica_expired_idx" ON "chapter_tiktok_replica" USING btree ("claim_expires_at","chapter_id") WHERE "chapter_tiktok_replica"."state" = 'running';--> statement-breakpoint
CREATE INDEX "chapter_upload_page_session_state_idx" ON "chapter_upload_page" USING btree ("session_id","state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_upload_session_active_chapter_uidx" ON "chapter_upload_session" USING btree ("chapter_id") WHERE "chapter_upload_session"."chapter_id" IS NOT NULL AND "chapter_upload_session"."state" IN ('open', 'finalizing');--> statement-breakpoint
CREATE UNIQUE INDEX "chapter_upload_session_active_draft_uidx" ON "chapter_upload_session" USING btree ("actor_user_id","group_id","manga_id") WHERE "chapter_upload_session"."chapter_id" IS NULL AND "chapter_upload_session"."state" IN ('open', 'finalizing');--> statement-breakpoint
CREATE INDEX "chapter_upload_session_cleanup_idx" ON "chapter_upload_session" USING btree ("state","expires_at","id");--> statement-breakpoint
CREATE INDEX "chapter_upload_session_actor_state_idx" ON "chapter_upload_session" USING btree ("actor_user_id","state","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_creation_key_unique" ON "comment" USING btree ("user_id","creation_key");--> statement-breakpoint
CREATE INDEX "comment_manga_created_idx" ON "comment" USING btree ("manga_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comment_user_created_idx" ON "comment" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comment_chapter_created_idx" ON "comment" USING btree ("chapter_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comment_admin_created_idx" ON "comment" USING btree ("created_at","id") WHERE "comment"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "content_report_status_created_idx" ON "content_report" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "cover_manga_idx" ON "cover" USING btree ("manga_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cover_primary_manga_uidx" ON "cover" USING btree ("manga_id") WHERE "cover"."is_primary";--> statement-breakpoint
CREATE INDEX "cover_upload_operation_cleanup_idx" ON "cover_upload_operation" USING btree ("state","expires_at","id");--> statement-breakpoint
CREATE INDEX "cover_upload_session_cleanup_idx" ON "cover_upload_session" USING btree ("state","expires_at","id");--> statement-breakpoint
CREATE INDEX "cover_upload_session_actor_idx" ON "cover_upload_session" USING btree ("actor_user_id","group_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "forbidden_word_normalized_idx" ON "forbidden_word" USING btree ("normalized_word");--> statement-breakpoint
CREATE INDEX "library_item_user_category_idx" ON "library_item" USING btree ("user_id","category","created_at","manga_id");--> statement-breakpoint
CREATE INDEX "library_item_following_manga_user_idx" ON "library_item" USING btree ("manga_id","user_id") WHERE "library_item"."category" = 'following';--> statement-breakpoint
CREATE INDEX "manga_catalog_idx" ON "manga" USING btree ("publication_state","moderation_hidden_at","deleted_at","has_usable_chapters","latest_chapter_published_at","id");--> statement-breakpoint
CREATE INDEX "manga_filters_idx" ON "manga" USING btree ("original_language","content_rating","publication_demographic","status","year");--> statement-breakpoint
CREATE INDEX "manga_owner_group_idx" ON "manga" USING btree ("owner_group_id","id");--> statement-breakpoint
CREATE INDEX "manga_engagement_daily_bucket_manga_idx" ON "manga_engagement_daily" USING btree ("bucket_date","manga_id");--> statement-breakpoint
CREATE INDEX "manga_group_group_idx" ON "manga_group" USING btree ("group_id","manga_id");--> statement-breakpoint
CREATE INDEX "manga_person_person_idx" ON "manga_person" USING btree ("person_id","role","manga_id");--> statement-breakpoint
CREATE INDEX "manga_tag_tag_idx" ON "manga_tag" USING btree ("tag_id","manga_id");--> statement-breakpoint
CREATE UNIQUE INDEX "manga_volume_active_number_uidx" ON "manga_volume" USING btree ("manga_id","number") WHERE "manga_volume"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "moderation_action_timeline_idx" ON "moderation_action" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_action_target_idx" ON "moderation_action" USING btree ("target_kind","target_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_user_type_manga_uidx" ON "notification" USING btree ("user_id","type","manga_id");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notification" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notification" USING btree ("user_id") WHERE "notification"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "reading_history_user_read_idx" ON "reading_history" USING btree ("user_id","read_at","chapter_id");--> statement-breakpoint
CREATE INDEX "reading_history_user_manga_idx" ON "reading_history" USING btree ("user_id","manga_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_chest_common_unique" ON "shop_chest" USING btree ("kind") WHERE "shop_chest"."kind" = 'common';--> statement-breakpoint
CREATE UNIQUE INDEX "shop_chest_topic_unique" ON "shop_chest" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "shop_purchase_actor_created_idx" ON "shop_purchase" USING btree ("actor_user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "system_notice_created_idx" ON "system_notice" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "tag_slug_uidx" ON "tag" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_group_name_uidx" ON "tag" USING btree ("group",lower(btrim("name")));--> statement-breakpoint
CREATE UNIQUE INDEX "translation_group_application_pending_user_uidx" ON "translation_group_application" USING btree ("user_id") WHERE "translation_group_application"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "translation_group_application_group_status_idx" ON "translation_group_application" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "translation_group_manga_engagement_daily_bucket_group_idx" ON "translation_group_manga_engagement_daily" USING btree ("bucket_date","group_id");--> statement-breakpoint
CREATE INDEX "translation_group_manga_view_stats_manga_idx" ON "translation_group_manga_view_stats" USING btree ("manga_id","group_id");--> statement-breakpoint
CREATE INDEX "user_avatar_frame_frame_user_idx" ON "user_avatar_frame" USING btree ("frame_id","user_id");--> statement-breakpoint
CREATE INDEX "user_profile_status_updated_user_idx" ON "user_profile" USING btree ("status","updated_at" DESC NULLS LAST,"user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "coin_ledger_wallet_created_idx" ON "coin_ledger" USING btree ("wallet_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "coin_operation_source_idx" ON "coin_operation" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "coin_view_receipt_expiry_idx" ON "coin_view_receipt" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "coin_wallet_user_unique" ON "coin_wallet" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coin_wallet_group_unique" ON "coin_wallet" USING btree ("group_id");