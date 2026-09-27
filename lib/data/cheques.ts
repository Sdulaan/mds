import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { naturalOrder, sqlOrder } from '@/lib/sort';
import type { ChequeFilters, TransactionType, TransactionWithEntity } from '@/types';

// Read-only data access. Deliberately NOT server actions ('use server'), so these
// can't be invoked directly from the browser. Each one checks the session.

export const CHEQUE_COLUMNS = `
  t.id, t.transaction_type, t.entity_id, t.cheque_number, t.cheque_date::text, t.amount, t.status,
  t.bank_name, t.grn_number, t.remarks, t.entry_date::text,
  t.deposited_date::text, t.cleared_date::text, t.returned_date::text, t.cancelled_date::text,
  t.created_at::text, t.created_by, t.updated_at::text, t.updated_by,
  cu.username AS created_by_name, uu.username AS updated_by_name,
  e.name AS entity_name, e.type AS entity_type, e.is_active AS entity_active
`;

export const CHEQUE_JOINS = `
  FROM transactions t
  JOIN entities e ON e.id = t.entity_id
  LEFT JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users uu ON uu.id = t.updated_by
`;

/** Builds a parameterised WHERE clause for register/report filters. */
export function chequeWhere(filters: ChequeFilters, params: unknown[]): string {
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const conditions = [`t.transaction_type = ${add(filters.type)}`];

  if (filters.status && filters.status !== 'ALL') conditions.push(`t.status = ${add(filters.status)}`);
  if (filters.entityId) conditions.push(`t.entity_id = ${add(filters.entityId)}`);
  if (filters.bank) conditions.push(`t.bank_name ILIKE ${add(filters.bank)}`);
  if (filters.month) {
    const p = add(`${filters.month}-01`);
    conditions.push(`t.cheque_date >= ${p}::date AND t.cheque_date < (${p}::date + INTERVAL '1 month')`);
  }
  if (filters.from) conditions.push(`t.cheque_date >= ${add(filters.from)}::date`);
  if (filters.to) conditions.push(`t.cheque_date <= ${add(filters.to)}::date`);
  if (filters.q) {
    const like = add(`%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const ors = [`e.name ILIKE ${like}`, `t.cheque_number ILIKE ${like}`, `t.grn_number ILIKE ${like}`, `t.bank_name ILIKE ${like}`];
    // Amount search: "12,500" or "12500.00" match the cheque amount exactly.
    const amount = Number(filters.q.replace(/,/g, ''));
    if (filters.q.trim() !== '' && !isNaN(amount)) ors.push(`t.amount = ${add(amount)}`);
    conditions.push(`(${ors.join(' OR ')})`);
  }
  return `WHERE ${conditions.join(' AND ')}`;
}

// Status sorts follow the workflow (in hand → deposited → credited → returned; pending → cleared → cancelled).
const STATUS_RANK = `CASE t.status WHEN 'IN_HAND' THEN 1 WHEN 'DEPOSITED' THEN 2 WHEN 'CREDITED' THEN 3 WHEN 'RETURNED' THEN 4
  WHEN 'PENDING' THEN 1 WHEN 'CLEARED' THEN 2 WHEN 'CANCELLED' THEN 3 END`;

/** ORDER BY for the register sort (whitelisted keys only; see CHEQUE_SORT_KEYS). */
export function chequeOrderBy(filters: ChequeFilters, fallback = 't.cheque_date DESC, t.created_at DESC'): string {
  const dir = filters.dir ?? 'asc';
  const primary: Record<string, string> = {
    grn: naturalOrder('t.grn_number', dir),
    entity: sqlOrder('LOWER(e.name)', dir),
    cheque_number: naturalOrder('t.cheque_number', dir),
    cheque_date: sqlOrder('t.cheque_date', dir),
    amount: sqlOrder('t.amount', dir),
    status: sqlOrder(STATUS_RANK, dir),
    entry_date: sqlOrder('t.entry_date', dir),
  };
  const order = filters.sort ? primary[filters.sort] : undefined;
  return order ? `${order}, ${fallback}` : fallback;
}

export const PAGE_SIZE = 100;

export interface ChequePage {
  rows: TransactionWithEntity[];
  total: number;
  totalAmount: number;
  page: number;
  pageCount: number;
}

/** Register listing with totals across all matching rows (not just the page). */
export async function getChequePage(filters: ChequeFilters, page = 1): Promise<ChequePage> {
  await requireUser();
  const params: unknown[] = [];
  const where = chequeWhere(filters, params);

  const [summary] = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(t.amount), 0) AS amount FROM transactions t JOIN entities e ON e.id = t.entity_id ${where}`,
    params
  );
  const total = summary?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows = await query(
    `SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS} ${where}
     ORDER BY ${chequeOrderBy(filters)}
     LIMIT ${PAGE_SIZE} OFFSET ${(current - 1) * PAGE_SIZE}`,
    params
  );

  return {
    rows: rows as TransactionWithEntity[],
    total,
    totalAmount: parseFloat(String(summary?.amount ?? 0)),
    page: current,
    pageCount,
  };
}

/** All matching cheques (for exports). */
export async function getCheques(filters: ChequeFilters, orderBy = 't.cheque_date DESC, t.created_at DESC') {
  await requireUser();
  const params: unknown[] = [];
  const rows = await query(`SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS} ${chequeWhere(filters, params)} ORDER BY ${orderBy}`, params);
  return rows as TransactionWithEntity[];
}

export async function getCheque(id: string): Promise<TransactionWithEntity | null> {
  await requireUser();
  const rows = await query(`SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS} WHERE t.id = $1`, [id]);
  return (rows[0] as TransactionWithEntity) ?? null;
}

export async function getRecentCheques(type: TransactionType, limit = 5): Promise<TransactionWithEntity[]> {
  await requireUser();
  const rows = await query(
    `SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS} WHERE t.transaction_type = $1 ORDER BY t.created_at DESC LIMIT $2`,
    [type, limit]
  );
  return rows as TransactionWithEntity[];
}

export async function getBankNames(type?: TransactionType): Promise<string[]> {
  await requireUser();
  const rows = await query(
    `SELECT DISTINCT bank_name FROM transactions WHERE bank_name IS NOT NULL AND bank_name <> ''
     ${type ? 'AND transaction_type = $1' : ''} ORDER BY bank_name`,
    type ? [type] : []
  );
  return rows.map((r) => r.bank_name as string);
}

export interface DuplicateMatch {
  value: string;
  entity_name: string;
  cheque_date: string;
}

/**
 * SRS §7 duplicate control for creditor cheques: our own cheque numbers are unique per bank.
 * (GRNs can't be paid twice because of the GRN links; customer cheques aren't checked.)
 */
export async function findDuplicates(input: {
  type: TransactionType;
  entityId: string;
  chequeNumber: string;
  bankName: string | null;
  excludeId?: string;
}): Promise<DuplicateMatch[]> {
  const rows = await query(
    `SELECT t.cheque_number AS value, e.name AS entity_name, t.cheque_date::text
     FROM transactions t JOIN entities e ON e.id = t.entity_id
     WHERE t.transaction_type = $1 AND LOWER(t.cheque_number) = LOWER($2) AND t.id <> $3 AND COALESCE(t.bank_name, '') ILIKE $4
     LIMIT 3`,
    [input.type, input.chequeNumber, input.excludeId ?? '00000000-0000-0000-0000-000000000000', input.bankName ?? '']
  );
  return rows as DuplicateMatch[];
}
