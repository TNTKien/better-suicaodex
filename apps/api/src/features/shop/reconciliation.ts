import { sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"

// Read-only operator audit; ownership may legitimately be revoked after purchase.
export async function reconcileShopDatabase(
  database: Pick<Database, "execute">
) {
  const result = await database.execute<{
    purchases: string
    financialErrors: string
    purchaseAuditErrors: string
    stockErrors: string
    untrackedStock: string
  }>(sql`
    WITH events AS (
      SELECT a.target_id AS frame_id, a.action, a.before, a.after,
        lag(a.after->>'stock') OVER (PARTITION BY a.target_id ORDER BY (a.after->>'shopVersion')::bigint) AS previous_stock,
        lag(a.after->>'shopVersion') OVER (PARTITION BY a.target_id ORDER BY (a.after->>'shopVersion')::bigint) AS previous_version,
        row_number() OVER (PARTITION BY a.target_id ORDER BY (a.after->>'shopVersion')::bigint DESC) AS newest
      FROM moderation_action a WHERE a.target_kind = 'avatar_frame'
        AND a.action IN ('avatar_frame.purchased', 'avatar_frame.shop_updated')
    ), invalid_financial AS (
      SELECT p.id::text FROM shop_purchase p LEFT JOIN coin_operation o ON o.key = p.coin_operation_key
      WHERE o.source_type IS DISTINCT FROM 'shop.purchase' OR o.source_id IS DISTINCT FROM p.id::text
        OR o.actor_user_id IS DISTINCT FROM p.actor_user_id
        OR o.key IS DISTINCT FROM 'shop.purchase:' || p.actor_user_id || ':' || p.operation_id::text
        OR (SELECT count(*) FROM coin_ledger l WHERE l.operation_key = o.key) <> 1
        OR NOT EXISTS (SELECT 1 FROM coin_ledger l JOIN coin_wallet w ON w.id = l.wallet_id
          WHERE l.operation_key = o.key AND l.position = 0 AND l.mode = 'debit'
            AND w.user_id = p.actor_user_id AND l.requested_amount = p.price AND l.delta = -p.price)
      UNION ALL SELECT o.source_id FROM coin_operation o
        WHERE o.source_type = 'shop.purchase' AND NOT EXISTS (SELECT 1 FROM shop_purchase p WHERE p.coin_operation_key = o.key)
    ), invalid_purchase_audits AS (
      SELECT p.id FROM shop_purchase p WHERE
        (SELECT count(*) FROM moderation_action a WHERE a.action = 'avatar_frame.purchased'
          AND a.after->>'purchaseId' = p.id::text) <> 1
        OR NOT EXISTS (SELECT 1 FROM moderation_action a WHERE a.action = 'avatar_frame.purchased'
          AND a.target_kind = 'avatar_frame' AND a.target_id = p.frame_id::text
          AND a.actor_user_id = p.actor_user_id AND a.after->>'purchaseId' = p.id::text
          AND a.after->>'coinOperationKey' = p.coin_operation_key
          AND a.after->>'userId' = p.actor_user_id
          AND (a.before->>'stock')::bigint - (a.after->>'stock')::bigint = 1)
      UNION ALL SELECT a.id FROM moderation_action a WHERE a.action = 'avatar_frame.purchased'
        AND NOT EXISTS (SELECT 1 FROM shop_purchase p WHERE p.id::text = a.after->>'purchaseId')
    ), invalid_stock AS (
      SELECT e.frame_id FROM events e JOIN avatar_frame f ON f.id::text = e.frame_id
      WHERE e.before->>'stock' IS NULL OR e.after->>'stock' IS NULL
        OR e.before->>'shopVersion' IS NULL OR e.after->>'shopVersion' IS NULL
        OR (e.before->>'stock')::bigint < 0 OR (e.after->>'stock')::bigint < 0
        OR (e.after->>'shopVersion')::bigint <> (e.before->>'shopVersion')::bigint + 1
        OR (e.previous_version IS NULL AND ((e.before->>'stock')::bigint <> 0
          OR (e.before->>'shopVersion')::bigint <> 1))
        OR (e.previous_stock IS NOT NULL AND (e.previous_stock IS DISTINCT FROM e.before->>'stock'
          OR e.previous_version IS DISTINCT FROM e.before->>'shopVersion'))
        OR (e.newest = 1 AND (f.shop_stock::text IS DISTINCT FROM e.after->>'stock'
          OR f.shop_version::text IS DISTINCT FROM e.after->>'shopVersion'))
    )
    SELECT (SELECT count(*)::text FROM shop_purchase) AS purchases,
      (SELECT count(*)::text FROM invalid_financial) AS "financialErrors",
      (SELECT count(*)::text FROM invalid_purchase_audits) AS "purchaseAuditErrors",
      (SELECT count(*)::text FROM invalid_stock) AS "stockErrors",
      (SELECT count(*)::text FROM avatar_frame f WHERE f.shop_stock <> 0 AND
        NOT EXISTS (SELECT 1 FROM events e WHERE e.frame_id = f.id::text)) AS "untrackedStock"
  `)
  const row = result.rows[0]!
  return {
    ...row,
    matches: [
      row.financialErrors,
      row.purchaseAuditErrors,
      row.stockErrors,
      row.untrackedStock,
    ].every((n) => n === "0"),
  }
}
