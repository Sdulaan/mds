import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { addMonths, currentMonthKey, monthEnd } from '@/lib/dates';

const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;

export interface Bucket {
  count: number;
  amount: number;
}

export interface MonthPoint {
  month: string; // 'YYYY-MM'
  count: number;
  amount: number;
}

export interface DashboardData {
  receivables: {
    inHand: Bucket;
    deposited: Bucket;
    creditedThisMonth: Bucket;
    returnedThisMonth: Bucket;
    receivedByMonth: MonthPoint[];
    creditedByMonth: MonthPoint[];
  };
  payables: {
    outstanding: Bucket;
    cleared: Bucket;
    cancelled: Bucket;
    clearedThisMonth: Bucket;
    creditorsOutstanding: number;
    outstandingTrend: MonthPoint[];
    clearedByMonth: MonthPoint[];
    topCreditors: { name: string; count: number; amount: number }[];
  };
}

/** Fills missing months with zeros so charts always show a continuous 12-month axis. */
function series(rows: { month: string; count: number; amount: unknown }[], months: string[]): MonthPoint[] {
  const map = new Map(rows.map((r) => [r.month, r]));
  return months.map((m) => ({ month: m, count: map.get(m)?.count ?? 0, amount: num(map.get(m)?.amount) }));
}

export async function getDashboard(): Promise<DashboardData> {
  await requireUser();
  const now = currentMonthKey();
  const months = Array.from({ length: 12 }, (_, i) => addMonths(now, i - 11));
  const start = `${months[0]}-01`;
  const end = monthEnd(now);

  const [totals, received, credited, trend, cleared, top, payable] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'IN_HAND')::int AS in_hand_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'IN_HAND'), 0) AS in_hand,
         COUNT(*) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'DEPOSITED')::int AS deposited_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'DEPOSITED'), 0) AS deposited,
         COUNT(*) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'CREDITED' AND TO_CHAR(cleared_date, 'YYYY-MM') = $1)::int AS credited_m_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'CREDITED' AND TO_CHAR(cleared_date, 'YYYY-MM') = $1), 0) AS credited_m,
         COUNT(*) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'RETURNED' AND TO_CHAR(returned_date, 'YYYY-MM') = $1)::int AS returned_m_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'CREDIT' AND status = 'RETURNED' AND TO_CHAR(returned_date, 'YYYY-MM') = $1), 0) AS returned_m,
         COUNT(*) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'PENDING')::int AS outstanding_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'PENDING'), 0) AS outstanding,
         COUNT(*) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'CLEARED')::int AS cleared_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'CLEARED'), 0) AS cleared,
         COUNT(*) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'CANCELLED')::int AS cancelled_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'CANCELLED'), 0) AS cancelled,
         COUNT(*) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'CLEARED' AND TO_CHAR(cleared_date, 'YYYY-MM') = $1)::int AS cleared_m_n,
         COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'DEBIT' AND status = 'CLEARED' AND TO_CHAR(cleared_date, 'YYYY-MM') = $1), 0) AS cleared_m
       FROM transactions`,
      [now]
    ),
    // Cheque volume & value received each month (by cheque date).
    query(
      `SELECT TO_CHAR(cheque_date, 'YYYY-MM') AS month, COUNT(*)::int AS count, SUM(amount) AS amount
       FROM transactions WHERE transaction_type = 'CREDIT' AND cheque_date BETWEEN $1 AND $2 GROUP BY 1`,
      [start, end]
    ),
    query(
      `SELECT TO_CHAR(cleared_date, 'YYYY-MM') AS month, COUNT(*)::int AS count, SUM(amount) AS amount
       FROM transactions WHERE transaction_type = 'CREDIT' AND status = 'CREDITED' AND cleared_date BETWEEN $1 AND $2 GROUP BY 1`,
      [start, end]
    ),
    // Outstanding creditor cheques as they stood at each month end.
    query(
      `SELECT TO_CHAR(m, 'YYYY-MM') AS month, COUNT(t.id)::int AS count, COALESCE(SUM(t.amount), 0) AS amount
       FROM generate_series($1::date, $2::date, INTERVAL '1 month') AS m
       LEFT JOIN transactions t ON t.transaction_type = 'DEBIT'
         AND t.cheque_date <= (m + INTERVAL '1 month' - INTERVAL '1 day')::date
         AND (t.cleared_date IS NULL OR t.cleared_date > (m + INTERVAL '1 month' - INTERVAL '1 day')::date)
         AND (t.cancelled_date IS NULL OR t.cancelled_date > (m + INTERVAL '1 month' - INTERVAL '1 day')::date)
       GROUP BY m ORDER BY m`,
      [start, `${now}-01`]
    ),
    query(
      `SELECT TO_CHAR(cleared_date, 'YYYY-MM') AS month, COUNT(*)::int AS count, SUM(amount) AS amount
       FROM transactions WHERE transaction_type = 'DEBIT' AND status = 'CLEARED' AND cleared_date BETWEEN $1 AND $2 GROUP BY 1`,
      [start, end]
    ),
    query(
      `SELECT e.name, COUNT(*)::int AS count, SUM(t.amount) AS amount
       FROM transactions t JOIN entities e ON e.id = t.entity_id
       WHERE t.transaction_type = 'DEBIT' AND t.status = 'PENDING'
       GROUP BY e.id, e.name ORDER BY SUM(t.amount) DESC LIMIT 10`
    ),
    // Creditors payable balance: opening balances + purchases − cheques cleared (a cheque is paid once it clears).
    query(
      `SELECT
         COALESCE((SELECT SUM(opening_balance) FROM entities WHERE type = 'VENDOR'), 0)
         + COALESCE((SELECT SUM(amount) FROM purchases), 0)
         - COALESCE((SELECT SUM(amount) FROM transactions WHERE transaction_type = 'DEBIT' AND status = 'CLEARED'), 0) AS balance`
    ),
  ]);

  const t = totals[0] ?? {};
  const b = (n: string, a: string): Bucket => ({ count: t[n] ?? 0, amount: num(t[a]) });

  return {
    receivables: {
      inHand: b('in_hand_n', 'in_hand'),
      deposited: b('deposited_n', 'deposited'),
      creditedThisMonth: b('credited_m_n', 'credited_m'),
      returnedThisMonth: b('returned_m_n', 'returned_m'),
      receivedByMonth: series(received, months),
      creditedByMonth: series(credited, months),
    },
    payables: {
      outstanding: b('outstanding_n', 'outstanding'),
      cleared: b('cleared_n', 'cleared'),
      cancelled: b('cancelled_n', 'cancelled'),
      clearedThisMonth: b('cleared_m_n', 'cleared_m'),
      creditorsOutstanding: num(payable[0]?.balance),
      outstandingTrend: series(trend, months),
      clearedByMonth: series(cleared, months),
      topCreditors: top.map((r) => ({ name: r.name, count: r.count, amount: num(r.amount) })),
    },
  };
}
