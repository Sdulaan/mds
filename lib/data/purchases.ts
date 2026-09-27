import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { naturalOrder, sqlOrder, type Sort } from '@/lib/sort';
import type { Purchase } from '@/types';

/** Paid on purchase `p` by cheques that aren't cancelled. */
const PAID = `COALESCE((
  SELECT SUM(g.amount) FROM cheque_grns g JOIN transactions t ON t.id = g.transaction_id
  WHERE g.purchase_id = p.id AND t.status <> 'CANCELLED'
), 0)`;

const PURCHASE_COLUMNS = `
  p.id, p.entity_id, e.name AS entity_name, p.grn_number, p.invoice_number, p.purchase_date::text, p.amount,
  p.remarks, p.created_at::text, p.created_by, p.updated_at::text, p.updated_by,
  cu.username AS created_by_name, uu.username AS updated_by_name,
  ${PAID}::float AS paid
`;
const PURCHASE_JOINS = `
  FROM purchases p
  JOIN entities e ON e.id = p.entity_id
  LEFT JOIN users cu ON cu.id = p.created_by
  LEFT JOIN users uu ON uu.id = p.updated_by
`;

export interface PurchaseFilters {
  q?: string;
  entityId?: string;
  month?: string;
  sort?: Sort;
}

export const PURCHASE_SORT_KEYS = ['date', 'creditor', 'grn', 'invoice', 'amount', 'balance'] as const;

/** Default: newest purchase first. */
function purchaseOrderBy(sort?: Sort): string {
  const fallback = 'p.purchase_date DESC, p.created_at DESC';
  if (!sort?.sort) return fallback;
  const columns: Record<string, string> = {
    date: sqlOrder('p.purchase_date', sort.dir),
    creditor: sqlOrder('LOWER(e.name)', sort.dir),
    grn: naturalOrder('p.grn_number', sort.dir),
    invoice: naturalOrder('p.invoice_number', sort.dir),
    amount: sqlOrder('p.amount', sort.dir),
    balance: sqlOrder(`(p.amount - ${PAID})`, sort.dir),
  };
  return columns[sort.sort] ? `${columns[sort.sort]}, ${fallback}` : fallback;
}

export async function getPurchases(filters: PurchaseFilters = {}, limit = 200) {
  await requireUser();
  const params: unknown[] = [];
  const conditions: string[] = [];
  if (filters.entityId) {
    params.push(filters.entityId);
    conditions.push(`p.entity_id = $${params.length}`);
  }
  if (filters.month) {
    params.push(`${filters.month}-01`);
    conditions.push(`p.purchase_date >= $${params.length}::date AND p.purchase_date < ($${params.length}::date + INTERVAL '1 month')`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const p = `$${params.length}`;
    conditions.push(`(e.name ILIKE ${p} OR p.grn_number ILIKE ${p} OR p.invoice_number ILIKE ${p})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [summary] = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(p.amount), 0)::float AS amount FROM purchases p JOIN entities e ON e.id = p.entity_id ${where}`,
    params
  );
  const rows = await query(
    `SELECT ${PURCHASE_COLUMNS} ${PURCHASE_JOINS} ${where} ORDER BY ${purchaseOrderBy(filters.sort)} LIMIT ${limit}`,
    params
  );
  return { rows: rows as Purchase[], total: summary?.total ?? 0, totalAmount: summary?.amount ?? 0 };
}

export async function getPurchase(id: string): Promise<Purchase | null> {
  await requireUser();
  const rows = await query(`SELECT ${PURCHASE_COLUMNS} ${PURCHASE_JOINS} WHERE p.id = $1`, [id]);
  return (rows[0] as Purchase) ?? null;
}
