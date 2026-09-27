import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { GrnOption } from '@/lib/grn-allocation';

const NO_CHEQUE = '00000000-0000-0000-0000-000000000000';

/**
 * Links creditor cheques that have a GRN number but no GRN link yet (Excel import, old backups).
 * Where the GRN isn't in purchases, a purchase is created from the cheque's amount and date.
 * Keep in step with scripts/migrations/003_cheque_grns.sql.
 */
export const LINK_UNLINKED_CHEQUES = `
WITH unlinked AS (
  SELECT t.id, t.entity_id, TRIM(t.grn_number) AS grn, t.cheque_date, t.amount, t.status, t.created_by
  FROM transactions t
  WHERE t.transaction_type = 'DEBIT' AND NULLIF(TRIM(t.grn_number), '') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM cheque_grns g WHERE g.transaction_id = t.id)
),
missing AS (
  SELECT u.entity_id, MIN(u.grn) AS grn, MIN(u.cheque_date) AS purchase_date,
         COALESCE(NULLIF(SUM(u.amount) FILTER (WHERE u.status <> 'CANCELLED'), 0), SUM(u.amount)) AS amount,
         (ARRAY_AGG(u.created_by ORDER BY u.cheque_date))[1] AS created_by
  FROM unlinked u
  WHERE NOT EXISTS (
    SELECT 1 FROM purchases p WHERE p.entity_id = u.entity_id AND LOWER(TRIM(p.grn_number)) = LOWER(u.grn)
  )
  GROUP BY u.entity_id, LOWER(u.grn)
),
created AS (
  INSERT INTO purchases (entity_id, grn_number, purchase_date, amount, remarks, created_by)
  SELECT entity_id, grn, purchase_date, amount, 'Created automatically from creditor cheque', created_by FROM missing
  RETURNING id, entity_id, grn_number
)
INSERT INTO cheque_grns (transaction_id, purchase_id, amount)
SELECT u.id,
       COALESCE(
         c.id,
         (SELECT p.id FROM purchases p
          WHERE p.entity_id = u.entity_id AND LOWER(TRIM(p.grn_number)) = LOWER(u.grn)
          ORDER BY p.purchase_date, p.created_at LIMIT 1)
       ),
       u.amount
FROM unlinked u
LEFT JOIN created c ON c.entity_id = u.entity_id AND LOWER(c.grn_number) = LOWER(u.grn)`;

/** SQL: amount paid on purchase `p` by cheques that aren't cancelled, other than cheque `$n`. */
export const paidOn = (chequeParam: string) => `COALESCE((
  SELECT SUM(g.amount) FROM cheque_grns g JOIN transactions t ON t.id = g.transaction_id
  WHERE g.purchase_id = p.id AND t.status <> 'CANCELLED' AND t.id <> ${chequeParam}
), 0)`;

const OPTION_COLUMNS = `p.id, p.entity_id, p.grn_number, p.purchase_date::text, p.amount::float AS amount`;

/**
 * GRNs a creditor cheque can pay: those with an unpaid balance, plus (when editing) the ones
 * already on that cheque. `remaining` ignores the cheque being edited.
 */
export async function getGrnOptions(chequeId?: string): Promise<GrnOption[]> {
  await requireUser();
  const rows = await query(
    `SELECT ${OPTION_COLUMNS}, (p.amount - ${paidOn('$1')})::float AS remaining
     FROM purchases p
     WHERE p.amount - ${paidOn('$1')} > 0
        OR EXISTS (SELECT 1 FROM cheque_grns g WHERE g.purchase_id = p.id AND g.transaction_id = $1)
     ORDER BY p.purchase_date, p.created_at`,
    [chequeId ?? NO_CHEQUE]
  );
  return rows as GrnOption[];
}

/** Balances of specific GRNs of one creditor (for saving a cheque). */
export async function getGrnBalances(ids: string[], entityId: string, chequeId?: string): Promise<GrnOption[]> {
  const rows = await query(
    `SELECT ${OPTION_COLUMNS}, (p.amount - ${paidOn('$3')})::float AS remaining
     FROM purchases p WHERE p.id = ANY($1::uuid[]) AND p.entity_id = $2
     ORDER BY p.purchase_date, p.created_at`,
    [ids, entityId, chequeId ?? NO_CHEQUE]
  );
  return rows as GrnOption[];
}

export interface ChequeGrn {
  purchase_id: string;
  grn_number: string;
  purchase_date: string;
  grn_amount: number;
  amount: number;
}

/** The GRNs a cheque pays, oldest first. */
export async function getChequeGrns(chequeId: string): Promise<ChequeGrn[]> {
  await requireUser();
  const rows = await query(
    `SELECT g.purchase_id, p.grn_number, p.purchase_date::text, p.amount::float AS grn_amount, g.amount::float AS amount
     FROM cheque_grns g JOIN purchases p ON p.id = g.purchase_id
     WHERE g.transaction_id = $1 ORDER BY p.purchase_date, p.created_at`,
    [chequeId]
  );
  return rows as ChequeGrn[];
}

export interface GrnPayment {
  transaction_id: string;
  cheque_number: string;
  cheque_date: string;
  status: string;
  amount: number;
}

/** Cheques paying a GRN (including cancelled ones, shown as such). */
export async function getGrnPayments(purchaseId: string): Promise<GrnPayment[]> {
  await requireUser();
  const rows = await query(
    `SELECT g.transaction_id, t.cheque_number, t.cheque_date::text, t.status, g.amount::float AS amount
     FROM cheque_grns g JOIN transactions t ON t.id = g.transaction_id
     WHERE g.purchase_id = $1 ORDER BY t.cheque_date, t.created_at`,
    [purchaseId]
  );
  return rows as GrnPayment[];
}
