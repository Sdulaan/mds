import 'server-only';
import { sql, query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { APP_TIMEZONE } from '@/lib/dates';
import type {
  DashboardMetrics,
  Entity,
  TransactionFilters,
  TransactionWithEntity,
} from '@/types';

// Read-only data access. These are deliberately NOT server actions ('use server'),
// so they can't be invoked directly from the browser. Each one checks the session.

const TRANSACTION_COLUMNS = `
  t.id,
  t.transaction_type,
  t.entity_id,
  t.cheque_number,
  t.cheque_date::text,
  t.amount,
  t.status,
  t.grn_number,
  t.remarks,
  TO_CHAR(t.cleared_at AT TIME ZONE '${APP_TIMEZONE}', 'YYYY-MM-DD') AS cleared_at,
  t.created_at::text,
  e.name AS entity_name,
  e.type AS entity_type
`;

export async function getEntities(): Promise<Entity[]> {
  await requireUser();
  const rows = await sql`
    SELECT id, name, type,
      -- created_at is a UTC TIMESTAMP (no zone); show the local calendar date
      ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${APP_TIMEZONE})::date::text AS created_at
    FROM entities
    ORDER BY type, name ASC
  `;
  return rows as Entity[];
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionWithEntity[]> {
  await requireUser();
  const { type = 'ALL', status = 'ALL', month } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (type !== 'ALL') {
    params.push(type);
    conditions.push(`t.transaction_type = $${params.length}`);
  }
  if (status !== 'ALL') {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (month) {
    // Range comparison so the cheque_date index can be used.
    params.push(`${month}-01`);
    const p = params.length;
    conditions.push(`t.cheque_date >= $${p}::date AND t.cheque_date < ($${p}::date + INTERVAL '1 month')`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions t
     JOIN entities e ON e.id = t.entity_id
     ${where}
     ORDER BY t.cheque_date DESC, t.created_at DESC`,
    params
  );

  return rows as TransactionWithEntity[];
}

export async function getMetrics(): Promise<DashboardMetrics> {
  await requireUser();
  const rows = await sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING' AND transaction_type = 'CREDIT'), 0) AS pending_credits,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING' AND transaction_type = 'DEBIT'), 0)  AS pending_debits,
      COALESCE(SUM(amount) FILTER (
        WHERE status = 'CLEARED'
          AND DATE_TRUNC('month', cleared_at AT TIME ZONE ${APP_TIMEZONE})
            = DATE_TRUNC('month', NOW() AT TIME ZONE ${APP_TIMEZONE})
      ), 0) AS cleared_this_month,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING'), 0) AS total_outstanding
    FROM transactions
  `;
  const r = rows[0] ?? {};
  return {
    pendingCredits: parseFloat(String(r.pending_credits ?? 0)),
    pendingDebits: parseFloat(String(r.pending_debits ?? 0)),
    clearedThisMonth: parseFloat(String(r.cleared_this_month ?? 0)),
    totalOutstanding: parseFloat(String(r.total_outstanding ?? 0)),
  };
}

export async function getRecentTransactions(limit = 5): Promise<TransactionWithEntity[]> {
  await requireUser();
  const rows = await query(
    `SELECT ${TRANSACTION_COLUMNS}
     FROM transactions t
     JOIN entities e ON e.id = t.entity_id
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows as TransactionWithEntity[];
}
