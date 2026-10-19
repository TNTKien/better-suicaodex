CREATE OR REPLACE FUNCTION "public"."sync_manga_library_follow_count"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO "public"."manga_stats" ("manga_id", "views", "follows", "updated_at")
		VALUES (NEW."manga_id", 0, 1, now())
		ON CONFLICT ("manga_id") DO UPDATE SET
			"follows" = "manga_stats"."follows" + 1,
			"updated_at" = excluded."updated_at";
		RETURN NEW;
	END IF;

	UPDATE "public"."manga_stats"
	SET
		"follows" = "follows" - 1,
		"updated_at" = now()
	WHERE "manga_id" = OLD."manga_id";
	RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "library_item_follow_count_trigger"
AFTER INSERT OR DELETE ON "library_item"
FOR EACH ROW
EXECUTE FUNCTION "public"."sync_manga_library_follow_count"();

--> statement-breakpoint
-- Financial history is append-only, including statements issued outside the service.
CREATE FUNCTION public.coin_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Coin history is append-only' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER coin_ledger_immutable BEFORE UPDATE OR DELETE ON public.coin_ledger
FOR EACH ROW EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER coin_ledger_no_truncate BEFORE TRUNCATE ON public.coin_ledger
FOR EACH STATEMENT EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER coin_operation_immutable BEFORE UPDATE OR DELETE ON public.coin_operation
FOR EACH ROW EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER coin_operation_no_truncate BEFORE TRUNCATE ON public.coin_operation
FOR EACH STATEMENT EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE FUNCTION public.coin_protect_wallet_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'Coin wallet owner is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER coin_wallet_owner_immutable BEFORE UPDATE ON public.coin_wallet
FOR EACH ROW EXECUTE FUNCTION public.coin_protect_wallet_owner();

--> statement-breakpoint

CREATE TRIGGER shop_purchase_immutable BEFORE UPDATE OR DELETE ON public.shop_purchase
FOR EACH ROW EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER shop_purchase_no_truncate BEFORE TRUNCATE ON public.shop_purchase
FOR EACH STATEMENT EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
-- FK existence alone is insufficient: a receipt must identify its buyer's one debit.
CREATE FUNCTION public.shop_check_purchase_financial_link() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.coin_operation_key <> 'shop.purchase:' || NEW.actor_user_id || ':' || NEW.operation_id::text
    OR NOT EXISTS (
      SELECT 1 FROM public.coin_operation AS operation
      JOIN public.coin_ledger AS ledger ON ledger.operation_key = operation.key
      JOIN public.coin_wallet AS wallet ON wallet.id = ledger.wallet_id
      WHERE operation.key = NEW.coin_operation_key
        AND operation.actor_user_id = NEW.actor_user_id
        AND operation.source_type = 'shop.purchase' AND operation.source_id = NEW.id::text
        AND ledger.position = 0 AND ledger.mode = 'debit'
        AND ledger.requested_amount = NEW.price AND ledger.delta = -NEW.price
        AND wallet.user_id = NEW.actor_user_id AND wallet.group_id IS NULL
    )
    OR (SELECT count(*) FROM public.coin_ledger WHERE operation_key = NEW.coin_operation_key) <> 1 THEN
    RAISE EXCEPTION 'Shop purchase must reference exactly one matching personal wallet debit'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER shop_purchase_financial_link
AFTER INSERT ON public.shop_purchase DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.shop_check_purchase_financial_link();
--> statement-breakpoint
CREATE FUNCTION public.shop_protect_purchase_ledger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.shop_purchase WHERE coin_operation_key = NEW.operation_key) THEN
    RAISE EXCEPTION 'A completed Shop purchase cannot gain additional ledger entries' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shop_purchase_ledger_guard BEFORE INSERT ON public.coin_ledger
FOR EACH ROW EXECUTE FUNCTION public.shop_protect_purchase_ledger();

--> statement-breakpoint
-- Stable chest identities, including archived topic chests, must retain history.
CREATE FUNCTION public.shop_protect_chest() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.retired_at IS NOT NULL
    OR OLD.version = 2147483647 THEN
    RAISE EXCEPTION 'Chest identity or retirement is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Chest updates must advance their version once' USING ERRCODE = '23514';
  END IF;
  IF NEW.topic_id IS DISTINCT FROM OLD.topic_id
    AND NOT (OLD.kind = 'topic' AND OLD.topic_id IS NOT NULL AND NEW.topic_id IS NULL
      AND NEW.retired_at IS NOT NULL AND NOT NEW.sale_enabled) THEN
    RAISE EXCEPTION 'A chest cannot change topic or become common' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shop_chest_update_guard BEFORE UPDATE ON public.shop_chest
FOR EACH ROW EXECUTE FUNCTION public.shop_protect_chest();
--> statement-breakpoint
CREATE TRIGGER shop_chest_no_delete BEFORE DELETE ON public.shop_chest
FOR EACH ROW EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER shop_chest_no_truncate BEFORE TRUNCATE ON public.shop_chest
FOR EACH STATEMENT EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
-- Retire before the FK's SET NULL action, leaving existing frame deletion semantics intact.
CREATE FUNCTION public.shop_retire_topic_chest() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.shop_chest
    SET topic_id = NULL, topic_name = OLD.name, sale_enabled = false,
      retired_at = now(), updated_at = now(), version = version + 1
    WHERE topic_id = OLD.id;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER shop_chest_topic_deleted BEFORE DELETE ON public.avatar_frame_topic
FOR EACH ROW EXECUTE FUNCTION public.shop_retire_topic_chest();
--> statement-breakpoint
CREATE TRIGGER shop_gacha_roll_immutable BEFORE UPDATE OR DELETE ON public.shop_gacha_roll
FOR EACH ROW EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER shop_gacha_roll_no_truncate BEFORE TRUNCATE ON public.shop_gacha_roll
FOR EACH STATEMENT EXECUTE FUNCTION public.coin_reject_history_mutation();
--> statement-breakpoint
CREATE FUNCTION public.shop_check_gacha_financial_link() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  receipt public.shop_gacha_roll%ROWTYPE;
  debit public.coin_ledger%ROWTYPE;
  operation public.coin_operation%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'coin_operation' THEN
    IF NEW.source_type <> 'shop.gacha' THEN RETURN NEW; END IF;
    SELECT * INTO receipt FROM public.shop_gacha_roll WHERE coin_operation_key = NEW.key;
  ELSIF TG_TABLE_NAME = 'coin_ledger' THEN
    SELECT * INTO operation FROM public.coin_operation WHERE key = NEW.operation_key;
    IF operation.source_type IS DISTINCT FROM 'shop.gacha' THEN RETURN NEW; END IF;
    SELECT * INTO receipt FROM public.shop_gacha_roll WHERE coin_operation_key = NEW.operation_key;
  ELSE
    receipt := NEW;
  END IF;
  IF receipt.id IS NULL THEN
    RAISE EXCEPTION 'Gacha operation requires a receipt' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO operation FROM public.coin_operation WHERE key = receipt.coin_operation_key;
  SELECT * INTO debit FROM public.coin_ledger
    WHERE operation_key = receipt.coin_operation_key AND position = 0;
  IF receipt.coin_operation_key <> 'shop.gacha:' || receipt.actor_user_id || ':' || receipt.operation_id::text
    OR operation.actor_user_id IS DISTINCT FROM receipt.actor_user_id
    OR operation.source_type IS DISTINCT FROM 'shop.gacha'
    OR operation.source_id IS DISTINCT FROM receipt.id::text
    OR debit.id IS NULL OR debit.mode <> 'debit'
    OR debit.requested_amount <> receipt.price OR debit.delta <> -receipt.price
    OR debit.reference_ledger_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.coin_wallet
      WHERE id = debit.wallet_id AND user_id = receipt.actor_user_id AND group_id IS NULL)
    OR (SELECT count(*) FROM public.coin_ledger WHERE operation_key = receipt.coin_operation_key)
      <> (CASE WHEN receipt.duplicate THEN 2 ELSE 1 END) THEN
    RAISE EXCEPTION 'Gacha receipt must match its personal wallet debit/refund' USING ERRCODE = '23514';
  END IF;
  IF receipt.duplicate AND NOT EXISTS (
    SELECT 1 FROM public.coin_ledger
    WHERE operation_key = receipt.coin_operation_key AND position = 1
      AND wallet_id = debit.wallet_id AND mode = 'credit'
      AND requested_amount = receipt.refund AND delta = receipt.refund
      AND sequence = debit.sequence + 1 AND balance_after = debit.balance_after + receipt.refund
      AND reference_ledger_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Gacha duplicate requires exactly one matching refund after debit' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER shop_gacha_roll_financial_link
AFTER INSERT ON public.shop_gacha_roll DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.shop_check_gacha_financial_link();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER shop_gacha_operation_receipt_link
AFTER INSERT ON public.coin_operation DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.shop_check_gacha_financial_link();
--> statement-breakpoint
-- Revalidate the complete operation when any ledger entry commits.
CREATE CONSTRAINT TRIGGER shop_gacha_ledger_guard
AFTER INSERT ON public.coin_ledger DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.shop_check_gacha_financial_link();

--> statement-breakpoint
INSERT INTO organization (id, name, slug, created_at)
VALUES (public.uuid_generate_v7()::text, 'System', 'system', now()) ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
INSERT INTO translation_group_profile (organization_id, description, approval_status, publication_state)
SELECT id, 'Fallback owner for deleted groups', 'approved', 'published' FROM organization WHERE slug = 'system'
ON CONFLICT (organization_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO shop_chest (kind) VALUES ('common') ON CONFLICT DO NOTHING;

--> statement-breakpoint
CREATE UNIQUE INDEX "member_organization_user_uidx" ON "member" ("organization_id", "user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "member_user_uidx" ON "member" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "member_owner_organization_uidx" ON "member" ("organization_id") WHERE "role" = 'owner';
