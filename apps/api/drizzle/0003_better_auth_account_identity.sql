DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "account"
    GROUP BY "provider_id", "account_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Resolve duplicate Better Auth (provider_id, account_id) pairs before upgrading'
      USING ERRCODE = '23505';
  END IF;
END $$;
--> statement-breakpoint
-- Retain existing issuer values for rollback; Better Auth 1.7.3+ no longer writes this column.
ALTER TABLE "account" ALTER COLUMN "issuer" DROP NOT NULL;
--> statement-breakpoint
DROP INDEX "account_issuer_accountId_uidx";
