import { sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"

// Maintenance-only, read-only full-ledger checks. Aggregate in PostgreSQL, not JS numbers.
export async function reconcileCoinDatabase(db: Pick<Database, "execute">) {
  const result = await db.execute<{
    wallets: string
    ledgerEntries: string
    totalBalance: string
    totalDelta: string
    walletErrors: string
    entryErrors: string
    transferErrors: string
    receiptErrors: string
  }>(sql`
    with entries as (
      select l.*, sum(delta) over (partition by wallet_id order by sequence) as running_balance,
        row_number() over (partition by wallet_id order by sequence) as expected_sequence
      from coin_ledger l
    ), balances as (
      select w.id, w.balance, w.sequence, coalesce(sum(l.delta), 0) as ledger_balance,
        count(l.id) as ledger_count, coalesce(max(l.sequence), 0) as last_sequence
      from coin_wallet w left join coin_ledger l on l.wallet_id = w.id group by w.id
    ), transfers as (
      select o.key from coin_operation o left join coin_ledger l on l.operation_key = o.key
      left join coin_wallet w on w.id = l.wallet_id
      where o.source_type = 'group.transfer' group by o.key
      having count(l.id) <> 2 or sum(l.delta) <> 0
        or count(*) filter (where l.mode = 'debit' and w.group_id = o.source_id) <> 1
        or count(*) filter (where l.mode = 'credit' and w.user_id is not null) <> 1
    ), receipts as (
      select o.key from coin_operation o
      where o.result->>'operationKey' is distinct from o.key
        or o.result->>'transactionGroup' is distinct from o.transaction_group::text
        or jsonb_array_length(o.result->'entries') < 1
        or jsonb_array_length(o.result->'entries') is distinct from
          (select count(*)::integer from coin_ledger l where l.operation_key = o.key)
        or exists (
          select 1 from jsonb_array_elements(o.result->'entries') with ordinality e(value, pos)
          left join coin_ledger l on l.operation_key = o.key and l.position = e.pos - 1
          left join coin_wallet w on w.id = l.wallet_id
          where l.id is null or e.value->>'id' is distinct from l.id::text
            or e.value->>'walletId' is distinct from l.wallet_id::text
            or e.value->>'delta' is distinct from l.delta::text
            or e.value->>'balanceAfter' is distinct from l.balance_after::text
            or e.value->>'requestedAmount' is distinct from l.requested_amount::text
            or e.value->>'mode' is distinct from l.mode
            or e.value->>'sequence' is distinct from l.sequence::text
            or e.value->'owner'->>'id' is distinct from coalesce(w.user_id, w.group_id)
            or e.value->'owner'->>'kind' is distinct from (case when w.user_id is null then 'group' else 'user' end)
        )
    )
    select (select count(*)::text from coin_wallet) as wallets,
      (select count(*)::text from coin_ledger) as "ledgerEntries",
      (select coalesce(sum(balance), 0)::text from coin_wallet) as "totalBalance",
      (select coalesce(sum(delta), 0)::text from coin_ledger) as "totalDelta",
      (select count(*)::text from balances where balance <> ledger_balance or sequence <> ledger_count or sequence <> last_sequence) as "walletErrors",
      (select count(*)::text from entries where balance_after <> running_balance or sequence <> expected_sequence) as "entryErrors",
      (select count(*)::text from transfers) as "transferErrors",
      (select count(*)::text from receipts) as "receiptErrors"
  `)
  const row = result.rows[0]!
  return {
    ...row,
    matches:
      [
        row.walletErrors,
        row.entryErrors,
        row.transferErrors,
        row.receiptErrors,
      ].every((n) => n === "0") && row.totalBalance === row.totalDelta,
  }
}
