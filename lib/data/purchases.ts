import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { Purchase } from '@/types';

const PURCHASE_COLUMNS = `
  p.id, p.entity_id, e.name AS entity_name, p.grn_number, p.invoice_number, p.purchase_date::text, p.amount,
  p.remarks, p.created_at::text, p.created_by, p.updated_at::text, p.updated_by,
  cu.username AS created_by_name, uu.username AS updated_by_name
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
    `SELECT ${PURCHASE_COLUMNS} ${PURCHASE_JOINS} ${where} ORDER BY p.purchase_date DESC, p.created_at DESC LIMIT ${limit}`,
    params
  );
  return { rows: rows as Purchase[], total: summary?.total ?? 0, totalAmount: summary?.amount ?? 0 };
}

export async function getPurchase(id: string): Promise<Purchase | null> {
  await requireUser();
  const rows = await query(`SELECT ${PURCHASE_COLUMNS} ${PURCHASE_JOINS} WHERE p.id = $1`, [id]);
  return (rows[0] as Purchase) ?? null;
}
