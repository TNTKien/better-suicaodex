import { sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"

// Operator-only read audit. Compare historical snapshots, never live catalog/ownership.
// ponytail: full receipt/ledger scan; add bounded incremental audits only if maintenance time becomes excessive.
export async function reconcileGachaDatabase(
  database: Pick<Database, "execute">
) {
  const result = await database.execute<{
    rolls: string
    states: string
    financialErrors: string
    orphanErrors: string
    auditErrors: string
    pityErrors: string
    stateErrors: string
  }>(sql`
    WITH financial AS (
      SELECT r.*, o.key AS operation_key, o.transaction_group, o.source_type,
        o.source_id, o.actor_user_id AS coin_actor, o.result, o.created_at AS operation_at,
        d.id AS debit_id, d.wallet_id, d.sequence AS debit_sequence, d.mode AS debit_mode,
        d.requested_amount AS debit_amount, d.delta AS debit_delta,
        d.balance_after AS debit_balance, d.reference_ledger_id AS debit_reference,
        w.user_id AS wallet_user, w.group_id AS wallet_group
      FROM shop_gacha_roll r LEFT JOIN coin_operation o ON o.key = r.coin_operation_key
      LEFT JOIN coin_ledger d ON d.operation_key = o.key AND d.position = 0
      LEFT JOIN coin_wallet w ON w.id = d.wallet_id
    ), invalid_financial AS (
      SELECT r.id FROM financial r WHERE
        r.operation_key IS DISTINCT FROM 'shop.gacha:' || r.actor_user_id || ':' || r.operation_id::text
        OR r.source_type IS DISTINCT FROM 'shop.gacha' OR r.source_id IS DISTINCT FROM r.id::text
        OR r.coin_actor IS DISTINCT FROM r.actor_user_id OR r.wallet_user IS DISTINCT FROM r.actor_user_id
        OR r.wallet_group IS NOT NULL OR r.operation_at IS DISTINCT FROM r.created_at
        OR r.debit_id IS NULL OR r.debit_mode IS DISTINCT FROM 'debit'
        OR r.debit_amount IS DISTINCT FROM r.price OR r.debit_delta IS DISTINCT FROM -r.price
        OR r.debit_reference IS NOT NULL
        OR (SELECT count(*) FROM coin_ledger l WHERE l.operation_key = r.operation_key)
          <> CASE WHEN r.duplicate THEN 2 ELSE 1 END
        OR (r.duplicate AND NOT EXISTS (SELECT 1 FROM coin_ledger l
          WHERE l.operation_key = r.operation_key AND l.position = 1 AND l.wallet_id = r.wallet_id
            AND l.mode = 'credit' AND l.requested_amount = r.refund AND l.delta = r.refund
            AND l.sequence = r.debit_sequence + 1 AND l.balance_after = r.debit_balance + r.refund
            AND l.reference_ledger_id IS NULL))
        OR EXISTS (SELECT 1 FROM coin_ledger l WHERE l.operation_key = r.operation_key
          AND l.created_at IS DISTINCT FROM r.created_at)
        OR r.result->>'operationKey' IS DISTINCT FROM r.operation_key
        OR r.result->>'transactionGroup' IS DISTINCT FROM r.transaction_group::text
        OR r.result->'entries' IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object(
          'id', l.id::text, 'walletId', l.wallet_id::text,
          'owner', jsonb_build_object('kind', 'user', 'id', r.actor_user_id),
          'mode', l.mode, 'requestedAmount', l.requested_amount::text,
          'delta', l.delta::text, 'balanceAfter', l.balance_after::text,
          'sequence', l.sequence::text) ORDER BY l.position)
          FROM coin_ledger l WHERE l.operation_key = r.operation_key)
    ), orphan_financial AS (
      SELECT o.key FROM coin_operation o WHERE
        (o.source_type = 'shop.gacha' OR o.key LIKE 'shop.gacha:%')
        AND NOT EXISTS (SELECT 1 FROM shop_gacha_roll r WHERE r.coin_operation_key = o.key)
      UNION ALL SELECT l.operation_key FROM coin_ledger l
        WHERE l.operation_key LIKE 'shop.gacha:%'
          AND NOT EXISTS (SELECT 1 FROM coin_operation o WHERE o.key = l.operation_key)
    ), invalid_audit AS (
      SELECT r.id FROM shop_gacha_roll r WHERE
        (SELECT count(*) FROM moderation_action a WHERE a.action = 'shop.gacha_rolled'
          AND a.after->>'receiptId' = r.id::text) <> 1
        OR NOT EXISTS (SELECT 1 FROM moderation_action a WHERE a.action = 'shop.gacha_rolled'
          AND a.target_kind = 'shop_chest' AND a.target_id = r.chest_id::text
          AND a.actor_user_id = r.actor_user_id AND a.after->>'receiptId' = r.id::text
          AND a.after->>'coinOperationKey' = r.coin_operation_key AND a.after->>'userId' = r.actor_user_id
          AND a.after->>'frameId' = r.frame_id::text AND a.after->>'rarity' = r.rarity::text
          AND a.after->>'duplicate' = r.duplicate::text AND a.after->>'refund' = r.refund::text
          AND a.before->>'owned' = r.duplicate::text
          AND a.before->>'sinceSr' = r.since_sr_before::text AND a.before->>'sinceSsr' = r.since_ssr_before::text
          AND a.before->>'rollCount' = (r.roll_sequence - 1)::text
          AND a.after->>'sinceSr' = r.since_sr_after::text AND a.after->>'sinceSsr' = r.since_ssr_after::text
          AND a.after->>'rollCount' = r.roll_sequence::text)
      UNION ALL SELECT a.id FROM moderation_action a WHERE a.action = 'shop.gacha_rolled'
        AND NOT EXISTS (SELECT 1 FROM shop_gacha_roll r WHERE r.id::text = a.after->>'receiptId')
    ), chain AS (
      SELECT r.*, row_number() OVER (PARTITION BY actor_user_id ORDER BY roll_sequence) AS expected_sequence,
        lag(since_sr_after, 1, 0) OVER (PARTITION BY actor_user_id ORDER BY roll_sequence) AS previous_sr,
        lag(since_ssr_after, 1, 0) OVER (PARTITION BY actor_user_id ORDER BY roll_sequence) AS previous_ssr,
        lag(debit_sequence) OVER (PARTITION BY actor_user_id ORDER BY roll_sequence) AS previous_debit,
        row_number() OVER (PARTITION BY actor_user_id ORDER BY roll_sequence DESC) AS newest
      FROM financial r
    ), invalid_pity AS (
      SELECT id FROM chain r WHERE r.roll_sequence <> r.expected_sequence
        OR r.since_sr_before <> r.previous_sr OR r.since_ssr_before <> r.previous_ssr
        OR r.debit_sequence <= r.previous_debit
        OR r.rule_snapshot->'version' IS DISTINCT FROM to_jsonb(r.rule_version)
        OR r.rule_snapshot->'price' IS DISTINCT FROM to_jsonb(r.price::text)
        OR r.price <= 0 OR r.refund < 0
        OR (NOT r.duplicate AND r.refund <> 0)
        OR (r.duplicate AND r.rule_snapshot->'duplicateRefund'->r.rarity::text IS DISTINCT FROM to_jsonb(r.refund::text))
        OR r.since_sr_before < 0 OR r.since_sr_before > r.since_ssr_before
        OR r.since_sr_before >= (r.rule_snapshot->>'srPity')::integer
        OR r.since_ssr_before >= (r.rule_snapshot->>'ssrPity')::integer
        OR r.since_sr_after IS DISTINCT FROM CASE WHEN r.rarity = 'R' THEN r.since_sr_before + 1 ELSE 0 END
        OR r.since_ssr_after IS DISTINCT FROM CASE WHEN r.rarity = 'SSR' THEN 0 ELSE r.since_ssr_before + 1 END
        OR (r.since_ssr_before = (r.rule_snapshot->>'ssrPity')::integer - 1 AND r.rarity <> 'SSR')
        OR (r.since_sr_before = (r.rule_snapshot->>'srPity')::integer - 1 AND r.rarity = 'R')
    ), invalid_state AS (
      SELECT coalesce(s.user_id, r.actor_user_id) FROM shop_gacha_state s
      FULL JOIN (SELECT * FROM chain WHERE newest = 1) r ON r.actor_user_id = s.user_id
      WHERE (r.id IS NOT NULL AND (s.user_id IS NULL OR s.roll_count IS DISTINCT FROM r.roll_sequence
        OR s.since_sr IS DISTINCT FROM r.since_sr_after OR s.since_ssr IS DISTINCT FROM r.since_ssr_after
        OR s.updated_at IS DISTINCT FROM r.created_at))
        OR (r.id IS NULL AND (s.roll_count <> 0 OR s.since_sr <> 0 OR s.since_ssr <> 0))
    )
    SELECT (SELECT count(*)::text FROM shop_gacha_roll) AS rolls,
      (SELECT count(*)::text FROM shop_gacha_state) AS states,
      (SELECT count(*)::text FROM invalid_financial) AS "financialErrors",
      (SELECT count(*)::text FROM orphan_financial) AS "orphanErrors",
      (SELECT count(*)::text FROM invalid_audit) AS "auditErrors",
      (SELECT count(*)::text FROM invalid_pity) AS "pityErrors",
      (SELECT count(*)::text FROM invalid_state) AS "stateErrors"
  `)
  const row = result.rows[0]!
  return {
    ...row,
    matches: [
      row.financialErrors,
      row.orphanErrors,
      row.auditErrors,
      row.pityErrors,
      row.stateErrors,
    ].every((n) => n === "0"),
  }
}
