import 'server-only';
import { query } from '@/lib/db';
import { CHEQUE_COLUMNS, CHEQUE_JOINS, chequeOrderBy, chequeWhere } from '@/lib/data/cheques';
import { addMonths, currentMonthKey, formatDate, monthEnd, monthLabel, todayKey } from '@/lib/dates';
import { buildFilterLabel, parseChequeFilters } from '@/lib/filters';
import { formatAmount } from '@/lib/format';
import { STATUS_LABEL, type ChequeStatus, type TransactionType, type TransactionWithEntity } from '@/types';
import type { Column, ReportData, ReportDefinition, ReportParams, Row, Section } from './types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const num = (v: unknown) => parseFloat(String(v ?? 0)) || 0;
const sum = <T>(rows: T[], pick: (r: T) => unknown) => rows.reduce((s, r) => s + num(pick(r)), 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

async function entityName(id?: string): Promise<string | undefined> {
  if (!id) return undefined;
  const [row] = await query('SELECT name FROM entities WHERE id = $1', [id]);
  return row?.name;
}

async function describe(p: ReportParams, extra: string[] = []): Promise<string> {
  const parts: string[] = [];
  if (p.from || p.to) parts.push(`${p.from ? formatDate(p.from) : 'Beginning'} – ${p.to ? formatDate(p.to) : 'Today'}`);
  if (p.month) parts.push(monthLabel(p.month));
  const name = await entityName(p.entityId);
  if (name) parts.push(name);
  if (p.bank) parts.push(p.bank);
  parts.push(...extra);
  return parts.length ? parts.join(' · ') : 'All records';
}

/** Cheques of one type matching extra SQL conditions. `$n` placeholders continue from params. */
async function fetchCheques(type: TransactionType, conditions: string[], params: unknown[], orderBy: string) {
  const all = [`t.transaction_type = '${type}'`, ...conditions];
  const rows = await query(`SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS} WHERE ${all.join(' AND ')} ORDER BY ${orderBy}`, params);
  return rows as TransactionWithEntity[];
}

/** Adds entity / bank / date-range conditions; `dateColumn` is what the range filters on. */
function standardConditions(p: ReportParams, dateColumn: string, params: unknown[]): string[] {
  const c: string[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  if (p.entityId) c.push(`t.entity_id = ${add(p.entityId)}`);
  if (p.bank) c.push(`t.bank_name ILIKE ${add(p.bank)}`);
  if (p.from) c.push(`${dateColumn} >= ${add(p.from)}::date`);
  if (p.to) c.push(`${dateColumn} <= ${add(p.to)}::date`);
  return c;
}

const subtotal = (label: string, labelKey: string, amountKey: string, amount: number, extra: Record<string, string | number> = {}): Row => ({
  kind: 'subtotal',
  cells: { [labelKey]: label, [amountKey]: amount, ...extra },
});

/**
 * One section per entity: its cheques, a subtotal after each month (of the `monthKey` date),
 * and an entity total. Used by the "by customer" / "by creditor" reports.
 */
function entitySections(
  rows: TransactionWithEntity[],
  columns: Column[],
  toCells: (c: TransactionWithEntity) => Row['cells'],
  monthKey: 'cheque_date' | 'cleared_date' | null,
  labelKey = columns[0].key
): Section[] {
  const sections: Section[] = [];
  for (const [, list] of groupBy(rows, (r) => r.entity_id)) {
    const out: Row[] = [];
    if (monthKey) {
      for (const [month, monthRows] of groupBy(list, (r) => (r[monthKey] ?? '').slice(0, 7))) {
        out.push(...monthRows.map((r) => ({ cells: toCells(r) })));
        out.push(subtotal(`${month ? monthLabel(month) : 'No date'} total (${monthRows.length})`, labelKey, 'amount', sum(monthRows, (r) => r.amount)));
      }
    } else {
      out.push(...list.map((r) => ({ cells: toCells(r) })));
    }
    out.push({ kind: 'total', cells: { [labelKey]: `Total — ${plural(list.length, 'cheque')}`, amount: sum(list, (r) => r.amount) } });
    sections.push({ title: list[0].entity_name + (list[0].entity_active ? '' : ' (inactive)'), columns, rows: out, blockKey: monthKey ?? undefined });
  }
  return sections;
}

function totalsSummary(rows: TransactionWithEntity[], countLabel: string, amountLabel: string, entityLabel?: string) {
  const summary = [
    { label: countLabel, value: rows.length.toLocaleString() },
    { label: amountLabel, value: formatAmount(sum(rows, (r) => r.amount)) },
  ];
  if (entityLabel) summary.push({ label: entityLabel, value: new Set(rows.map((r) => r.entity_id)).size.toLocaleString() });
  return summary;
}

const lastTwelveMonths = (): ReportParams => {
  const now = currentMonthKey();
  return { from: `${addMonths(now, -11)}-01`, to: monthEnd(now) };
};
const thisMonth = (): ReportParams => ({ from: `${currentMonthKey()}-01`, to: monthEnd(currentMonthKey()) });

/** Month-by-month count/amount table for a date column (used by the monthly summaries). */
async function monthlySummary(type: TransactionType, dateColumn: string, statusCondition: string, p: ReportParams, labels: [string, string]): Promise<ReportData> {
  const params: unknown[] = [];
  const conditions = [statusCondition, `${dateColumn} IS NOT NULL`, ...standardConditions(p, dateColumn, params)];
  const rows = await query(
    `SELECT TO_CHAR(${dateColumn}, 'YYYY-MM') AS month, COUNT(*)::int AS count, SUM(t.amount) AS amount
     FROM transactions t WHERE t.transaction_type = '${type}' AND ${conditions.join(' AND ')}
     GROUP BY 1 ORDER BY 1`,
    params
  );
  const total = sum(rows, (r) => r.amount);
  const count = rows.reduce((s, r) => s + r.count, 0);
  return {
    title: '',
    subtitle: await describe(p),
    summary: [
      { label: labels[0], value: count.toLocaleString() },
      { label: labels[1], value: formatAmount(total) },
    ],
    sections: [{
      columns: [
        { key: 'month', label: 'Month' },
        { key: 'count', label: labels[0], type: 'number' },
        { key: 'amount', label: labels[1], type: 'money' },
      ],
      rows: [
        ...rows.map((r) => ({ cells: { month: monthLabel(r.month), count: r.count, amount: num(r.amount) }, sortKeys: { month: r.month } })),
        { kind: 'total' as const, cells: { month: 'Total', count, amount: total } },
      ],
    }],
  };
}

/** Longest date range a daily summary lists. */
const MAX_DAILY_DAYS = 366;

/**
 * The period of a summary report: a whole month, or a from–to date range. Only one is ever
 * used (see ReportParams.mode). Status and balances are taken as at `end`.
 */
function summaryPeriod(p: ReportParams): { start: string; end: string; label: string } {
  const byDate = p.mode === 'date' || (!p.month && !!(p.from || p.to));
  if (!byDate) {
    const month = p.month ?? currentMonthKey();
    return { start: `${month}-01`, end: monthEnd(month), label: monthLabel(month) };
  }
  const end = p.to ?? todayKey();
  let start = p.from && p.from <= end ? p.from : `${end.slice(0, 7)}-01`;
  const earliest = new Date(Date.parse(end) - (MAX_DAILY_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);
  if (start < earliest) start = earliest;
  return { start, end, label: `${formatDate(start)} – ${formatDate(end)}` };
}

/**
 * Every date of the period in order (0 on days without any), with the number and value of cheques
 * dated that day that were still pending at the end of the period. One section per month.
 */
async function dailyPendingSummary(type: TransactionType, p: ReportParams, labels: [string, string]): Promise<Omit<ReportData, 'title'>> {
  const { start, end, label } = summaryPeriod(p);
  const params: unknown[] = [start, end];
  const pending = type === 'CREDIT'
    ? `(t.cleared_date IS NULL OR t.cleared_date > $2::date) AND (t.returned_date IS NULL OR t.returned_date > $2::date)`
    : `(t.cleared_date IS NULL OR t.cleared_date > $2::date) AND (t.cancelled_date IS NULL OR t.cancelled_date > $2::date)`;
  const extra = standardConditions({ entityId: p.entityId, bank: p.bank }, 't.cheque_date', params);
  const rows = await query(
    `SELECT d::date::text AS day, COUNT(t.id)::int AS count, COALESCE(SUM(t.amount), 0) AS amount
     FROM generate_series($1::date, $2::date, INTERVAL '1 day') AS d
     LEFT JOIN transactions t ON t.cheque_date = d::date AND t.transaction_type = '${type}' AND ${pending}
       ${extra.length ? `AND ${extra.join(' AND ')}` : ''}
     GROUP BY d ORDER BY d`,
    params
  );
  const count = rows.reduce((s, r) => s + r.count, 0);
  const total = sum(rows, (r) => r.amount);
  const columns: Column[] = [{ key: 'day', label: 'Date', type: 'date' }, { key: 'count', label: 'Cheques', type: 'number' }, { key: 'amount', label: 'Amount (LKR)', type: 'money' }];
  const sections: Section[] = [...groupBy(rows, (r) => String(r.day).slice(0, 7))].map(([month, list]) => ({
    title: monthLabel(month),
    month,
    columns,
    rows: [
      ...list.map((r) => ({ cells: { day: r.day, count: r.count, amount: num(r.amount) } })),
      { kind: 'total' as const, cells: { day: `${monthLabel(month)} total`, count: list.reduce((s, r) => s + r.count, 0), amount: sum(list, (r) => r.amount) } },
    ],
  }));
  return {
    subtitle: [label, await entityName(p.entityId), p.bank].filter(Boolean).join(' · '),
    summary: [
      { label: labels[0], value: count.toLocaleString() },
      { label: labels[1], value: formatAmount(total) },
      { label: 'Days with cheques', value: rows.filter((r) => r.count > 0).length.toLocaleString() },
    ],
    sections,
  };
}

// ─── Column sets ──────────────────────────────────────────────────────────────

const C = {
  chequeDate: { key: 'cheque_date', label: 'Cheque Date', type: 'date' },
  chequeNo: { key: 'cheque_number', label: 'Cheque No.' },
  bank: { key: 'bank_name', label: 'Bank' },
  grn: { key: 'grn_number', label: 'GRN No.' },
  status: { key: 'status', label: 'Status', type: 'status' },
  amount: { key: 'amount', label: 'Amount (LKR)', type: 'money' },
  customer: { key: 'entity_name', label: 'Customer' },
  creditor: { key: 'entity_name', label: 'Creditor' },
} satisfies Record<string, Column>;

const cells = (c: TransactionWithEntity, extra: Record<string, string | number | null> = {}) => ({
  cheque_date: c.cheque_date,
  cheque_number: c.cheque_number,
  bank_name: c.bank_name,
  grn_number: c.grn_number,
  status: c.status,
  amount: num(c.amount),
  entity_name: c.entity_name,
  ...extra,
});

// ─── Report definitions ──────────────────────────────────────────────────────

const PENDING_RECEIVABLE = `t.status IN ('IN_HAND', 'DEPOSITED')`;

/**
 * Creditor cheques that were still pending at the end of the report period (the "to" date):
 * issued by then and not cleared or cancelled by then. A cheque issued in March and cleared in
 * September is therefore outstanding in a March report, whenever that report is run.
 * Without a "to" date this is simply the current status.
 */
function pendingPayableAsOf(p: ReportParams, params: unknown[]): string {
  if (!p.to) return `t.status = 'PENDING'`;
  params.push(p.to);
  const d = `$${params.length}::date`;
  return `(t.cheque_date <= ${d} AND (t.cleared_date IS NULL OR t.cleared_date > ${d}) AND (t.cancelled_date IS NULL OR t.cancelled_date > ${d}))`;
}

/**
 * Customer cheques still in hand or deposited at the report's "to" date: not credited or returned
 * by then. A cheque received in March and credited in September stays pending in a March report.
 * Without a "to" date this is simply the current status.
 */
function pendingReceivableAsOf(p: ReportParams, params: unknown[]): string {
  if (!p.to) return PENDING_RECEIVABLE;
  params.push(p.to);
  const d = `$${params.length}::date`;
  return `((t.cleared_date IS NULL OR t.cleared_date > ${d}) AND (t.returned_date IS NULL OR t.returned_date > ${d}))`;
}

/** In hand or deposited, as it stood on `date` (today when no date). */
const receivableStatusAt = (c: TransactionWithEntity, date?: string): ChequeStatus =>
  !date ? c.status : c.deposited_date && c.deposited_date <= date ? 'DEPOSITED' : 'IN_HAND';

/** Still pending at the end of the cheque's own month (for the month-by-month uncleared summary). */
const MONTH_END = `(date_trunc('month', t.cheque_date) + INTERVAL '1 month' - INTERVAL '1 day')::date`;
const PENDING_AT_CHEQUE_MONTH_END =
  `(t.cleared_date IS NULL OR t.cleared_date > ${MONTH_END}) AND (t.cancelled_date IS NULL OR t.cancelled_date > ${MONTH_END})`;

export const REPORTS: ReportDefinition[] = [
  // ── Receivables (SRS 1: Cheque Management System) ──────────────────────────
  {
    slug: 'cheques-in-hand',
    title: 'Cheques in Hand by Customer',
    group: 'Receivables',
    description: 'Customer cheques not credited or returned by the end of the selected period (or today), grouped by customer with cheque dates, numbers and monthly totals.',
    params: ['entity', 'dateRange', 'bank'],
    entityType: 'CUSTOMER',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const conditions = standardConditions(p, 't.cheque_date', params);
      const rows = await fetchCheques('CREDIT', [pendingReceivableAsOf(p, params), ...conditions], params, 'LOWER(e.name), t.cheque_date, t.cheque_number');
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: totalsSummary(rows, 'Pending cheques', 'Pending amount', 'Customers'),
        sections: entitySections(rows, [C.chequeDate, C.chequeNo, C.bank, C.status, C.amount], (c) => cells(c, { status: receivableStatusAt(c, p.to) }), 'cheque_date'),
      };
    },
  },
  {
    slug: 'credited-cheques',
    title: 'Credited Cheques by Customer',
    group: 'Receivables',
    description: 'Customer cheques credited to the bank, grouped by customer with cheque dates, numbers and monthly totals.',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'CUSTOMER',
    dateLabel: 'Credited date',
    defaults: thisMonth,
    async build(p) {
      const params: unknown[] = [];
      const rows = await fetchCheques('CREDIT', [`t.status = 'CREDITED'`, ...standardConditions(p, 't.cleared_date', params)], params, 'LOWER(e.name), t.cleared_date, t.cheque_date');
      return {
        title: this.title,
        subtitle: await describe(p, ['by credited date']),
        summary: totalsSummary(rows, 'Credited cheques', 'Credited amount', 'Customers'),
        sections: entitySections(
          rows,
          [C.chequeDate, C.chequeNo, C.bank, { key: 'cleared_date', label: 'Credited Date', type: 'date' }, C.amount],
          (c) => cells(c, { cleared_date: c.cleared_date }),
          'cleared_date'
        ),
      };
    },
  },
  {
    slug: 'returned-cheques',
    title: 'Returned Cheques by Month',
    group: 'Receivables',
    description: 'Bounced or returned customer cheques for each month, subtotalled by customer.',
    params: ['dateRange', 'entity'],
    entityType: 'CUSTOMER',
    dateLabel: 'Returned date',
    defaults: lastTwelveMonths,
    async build(p) {
      const params: unknown[] = [];
      const rows = await fetchCheques('CREDIT', [`t.status = 'RETURNED'`, ...standardConditions(p, 't.returned_date', params)], params, 't.returned_date, LOWER(e.name), t.cheque_date');
      const columns: Column[] = [C.customer, C.chequeNo, C.chequeDate, C.bank, { key: 'returned_date', label: 'Returned Date', type: 'date' }, C.amount];
      const sections: Section[] = [];
      for (const [month, list] of groupBy(rows, (r) => (r.returned_date ?? '').slice(0, 7))) {
        const out: Row[] = [];
        for (const [, custRows] of groupBy(list, (r) => r.entity_id)) {
          out.push(...custRows.map((c) => ({ cells: cells(c, { returned_date: c.returned_date }), group: c.entity_id })));
          if (custRows.length > 1) out.push(subtotal(`${custRows[0].entity_name} (${custRows.length})`, 'entity_name', 'amount', sum(custRows, (r) => r.amount)));
        }
        out.push({ kind: 'total', cells: { entity_name: `Total — ${plural(list.length, 'cheque')}`, amount: sum(list, (r) => r.amount) } });
        sections.push({ title: monthLabel(month), columns, rows: out, blockKey: 'entity_name', month });
      }
      return { title: this.title, subtitle: await describe(p), summary: totalsSummary(rows, 'Returned cheques', 'Returned amount', 'Customers'), sections };
    },
  },
  {
    slug: 'in-hand-summary',
    title: 'Cheques in Hand by Date',
    group: 'Receivables',
    description: 'Customer cheques not credited or returned by the end of the selected period (or today), totalled by cheque date and by month.',
    params: ['dateRange', 'entity'],
    entityType: 'CUSTOMER',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const range = standardConditions(p, 't.cheque_date', params);
      const conditions = [pendingReceivableAsOf(p, params), ...range];
      const rows = await query(
        `SELECT t.cheque_date::text AS day, COUNT(*)::int AS count, SUM(t.amount) AS amount
         FROM transactions t WHERE t.transaction_type = 'CREDIT' AND ${conditions.join(' AND ')}
         GROUP BY 1 ORDER BY 1`,
        params
      );
      const columns: Column[] = [{ key: 'day', label: 'Date', type: 'date' }, { key: 'count', label: 'Cheques', type: 'number' }, { key: 'amount', label: 'Amount (LKR)', type: 'money' }];
      const sections: Section[] = [];
      for (const [month, list] of groupBy(rows, (r) => String(r.day).slice(0, 7))) {
        sections.push({
          title: monthLabel(month),
          month,
          columns,
          rows: [
            ...list.map((r) => ({ cells: { day: r.day, count: r.count, amount: num(r.amount) } })),
            { kind: 'total', cells: { day: `${monthLabel(month)} total`, count: list.reduce((s, r) => s + r.count, 0), amount: sum(list, (r) => r.amount) } },
          ],
        });
      }
      const count = rows.reduce((s, r) => s + r.count, 0);
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: [{ label: 'Pending cheques', value: count.toLocaleString() }, { label: 'Pending amount', value: formatAmount(sum(rows, (r) => r.amount)) }],
        sections,
      };
    },
  },
  {
    slug: 'monthly-received',
    title: 'Cheques Received by Month',
    group: 'Receivables',
    description: 'Number and value of customer cheques for each month, with the amounts credited, returned and still pending at the end of that month.',
    params: ['dateRange', 'entity'],
    entityType: 'CUSTOMER',
    dateLabel: 'Cheque date',
    defaults: lastTwelveMonths,
    async build(p) {
      const params: unknown[] = [];
      const conditions = standardConditions(p, 't.cheque_date', params);
      const rows = await query(
        `SELECT TO_CHAR(t.cheque_date, 'YYYY-MM') AS month, COUNT(*)::int AS count, SUM(t.amount) AS amount,
                COALESCE(SUM(t.amount) FILTER (WHERE t.cleared_date <= ${MONTH_END} AND (t.returned_date IS NULL OR t.returned_date > ${MONTH_END})), 0) AS credited,
                COALESCE(SUM(t.amount) FILTER (WHERE t.returned_date <= ${MONTH_END}), 0) AS returned,
                COALESCE(SUM(t.amount) FILTER (WHERE (t.cleared_date IS NULL OR t.cleared_date > ${MONTH_END}) AND (t.returned_date IS NULL OR t.returned_date > ${MONTH_END})), 0) AS pending
         FROM transactions t WHERE t.transaction_type = 'CREDIT' ${conditions.length ? `AND ${conditions.join(' AND ')}` : ''}
         GROUP BY 1 ORDER BY 1`,
        params
      );
      const k = ['amount', 'credited', 'returned', 'pending'] as const;
      const totals = Object.fromEntries(k.map((key) => [key, sum(rows, (r) => r[key])]));
      const count = rows.reduce((s, r) => s + r.count, 0);
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: [{ label: 'Cheques received', value: count.toLocaleString() }, { label: 'Total value', value: formatAmount(totals.amount) }],
        sections: [{
          columns: [
            { key: 'month', label: 'Month' }, { key: 'count', label: 'Cheques', type: 'number' }, { key: 'amount', label: 'Total', type: 'money' },
            { key: 'credited', label: 'Credited', type: 'money' }, { key: 'returned', label: 'Returned', type: 'money' }, { key: 'pending', label: 'Pending', type: 'money' },
          ],
          rows: [
            ...rows.map((r) => ({ cells: { month: monthLabel(r.month), count: r.count, ...Object.fromEntries(k.map((key) => [key, num(r[key])])) }, sortKeys: { month: r.month } })),
            { kind: 'total' as const, cells: { month: 'Total', count, ...totals } },
          ],
        }],
      };
    },
  },

  // ── Payables (SRS 2: Creditors Outstanding Cheques & Monthly Payables) ─────
  {
    slug: 'creditor-outstanding',
    title: 'Uncleared Cheques',
    group: 'Payables',
    description: 'Full list of cheques issued to creditors that were not cleared by the end of the selected period (or today), with GRN numbers.',
    params: ['entity', 'dateRange', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const conditions = standardConditions(p, 't.cheque_date', params);
      const rows = await fetchCheques('DEBIT', [pendingPayableAsOf(p, params), ...conditions], params, 'LOWER(e.name), t.cheque_date, t.cheque_number');
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: totalsSummary(rows, 'Total uncleared cheques', 'Total uncleared amount'),
        sections: [{
          columns: [C.creditor, C.grn, C.chequeNo, C.chequeDate, C.amount, C.status],
          rows: [
            // Every row was pending at the report date, even if it has cleared since.
            ...rows.map((c) => ({ cells: cells(c, { status: 'PENDING' }) })),
            { kind: 'total', cells: { entity_name: `Total — ${plural(rows.length, 'cheque')}`, amount: sum(rows, (r) => r.amount) } },
          ],
        }],
      };
    },
  },
  {
    slug: 'creditor-uncleared',
    title: 'Uncleared Cheques by Creditor',
    group: 'Payables',
    description: 'Cheques not cleared by the end of the selected period (or today), grouped by creditor, with the number and amount of uncleared cheques for each.',
    params: ['entity', 'dateRange', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const conditions = standardConditions(p, 't.cheque_date', params);
      const rows = await fetchCheques('DEBIT', [pendingPayableAsOf(p, params), ...conditions], params, 'LOWER(e.name), t.cheque_date, t.cheque_number');
      const detail = entitySections(rows, [C.grn, C.chequeNo, C.chequeDate, C.bank, C.amount], (c) => cells(c), null, 'grn_number');
      const byCreditor = [...groupBy(rows, (r) => r.entity_id).values()];
      const summarySection: Section = {
        title: 'Summary by creditor',
        columns: [C.creditor, { key: 'count', label: 'Uncleared Cheques', type: 'number' }, { key: 'amount', label: 'Uncleared (LKR)', type: 'money' }],
        rows: [
          ...byCreditor.map((list) => ({ cells: { entity_name: list[0].entity_name, count: list.length, amount: sum(list, (r) => r.amount) } })),
          { kind: 'total', cells: { entity_name: 'Total', count: rows.length, amount: sum(rows, (r) => r.amount) } },
        ],
      };
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: totalsSummary(rows, 'Uncleared cheques', 'Total uncleared', 'Creditors'),
        sections: [summarySection, ...detail],
      };
    },
  },
  {
    slug: 'creditor-cleared',
    title: 'Cleared Cheques by Creditor',
    group: 'Payables',
    description: 'Cheques cleared by the bank, grouped by creditor with cleared dates and a monthly summary.',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cleared date',
    defaults: thisMonth,
    async build(p) {
      const params: unknown[] = [];
      const rows = await fetchCheques('DEBIT', [`t.status = 'CLEARED'`, ...standardConditions(p, 't.cleared_date', params)], params, 'LOWER(e.name), t.cleared_date, t.cheque_date');
      const detail = entitySections(
        rows,
        [C.grn, C.chequeNo, C.chequeDate, { key: 'cleared_date', label: 'Cleared Date', type: 'date' }, C.amount],
        (c) => cells(c, { cleared_date: c.cleared_date }),
        null,
        'grn_number'
      );
      const months = [...groupBy(rows, (r) => (r.cleared_date ?? '').slice(0, 7)).entries()].sort(([a], [b]) => a.localeCompare(b));
      const monthly: Section = {
        title: 'Monthly summary',
        columns: [{ key: 'month', label: 'Month' }, { key: 'count', label: 'Cleared Cheques', type: 'number' }, { key: 'amount', label: 'Cleared Amount', type: 'money' }],
        rows: [
          ...months.map(([m, list]) => ({ cells: { month: monthLabel(m), count: list.length, amount: sum(list, (r) => r.amount) }, sortKeys: { month: m } })),
          { kind: 'total', cells: { month: 'Total', count: rows.length, amount: sum(rows, (r) => r.amount) } },
        ],
      };
      return {
        title: this.title,
        subtitle: await describe(p, ['by cleared date']),
        summary: totalsSummary(rows, 'Cleared cheques', 'Total cleared amount', 'Creditors'),
        sections: [monthly, ...detail],
      };
    },
  },
  {
    slug: 'cancelled-cheques',
    title: 'Cancelled Cheques',
    group: 'Payables',
    description: 'Cheques cancelled after issue, with cancellation dates.',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cancellation date',
    defaults: lastTwelveMonths,
    async build(p) {
      const params: unknown[] = [];
      const rows = await fetchCheques('DEBIT', [`t.status = 'CANCELLED'`, ...standardConditions(p, 't.cancelled_date', params)], params, 't.cancelled_date, LOWER(e.name)');
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: totalsSummary(rows, 'Total cancelled cheques', 'Total cancelled amount'),
        sections: [{
          columns: [C.creditor, C.grn, C.chequeNo, C.chequeDate, { key: 'cancelled_date', label: 'Cancellation Date', type: 'date' }, C.amount],
          rows: [
            ...rows.map((c) => ({ cells: cells(c, { cancelled_date: c.cancelled_date }) })),
            { kind: 'total', cells: { entity_name: `Total — ${plural(rows.length, 'cheque')}`, amount: sum(rows, (r) => r.amount) } },
          ],
        }],
      };
    },
  },
  {
    slug: 'creditor-payables',
    title: 'Creditor Payables',
    group: 'Payables',
    description: 'Opening balance, purchases (GRNs), payments (cheques cleared) and outstanding balance for each creditor, for a month, quarter or year, plus cheques issued but not yet cleared.',
    params: ['period', 'month', 'entity'],
    entityType: 'VENDOR',
    defaults: () => ({ period: 'month', month: currentMonthKey() }),
    async build(p) {
      const period = p.period ?? 'month';
      const ref = p.month ?? currentMonthKey();
      const [year, month] = ref.split('-').map(Number);
      const startMonth = period === 'year' ? `${year}-01` : period === 'quarter' ? `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}` : ref;
      const endMonth = addMonths(startMonth, period === 'year' ? 11 : period === 'quarter' ? 2 : 0);
      const start = `${startMonth}-01`;
      const end = monthEnd(endMonth);

      const params: unknown[] = [start, end];
      const entityCond = p.entityId ? (params.push(p.entityId), `AND e.id = $3`) : '';
      // Payments = cheques cleared in the period: a cheque is only paid once the bank clears it, so a
      // cheque that stays uncleared and is later cancelled never counts, and past periods never change.
      // Uncleared = cheques issued by the period end and not cleared or cancelled by then (for information).
      const rows = await query(
        `SELECT e.name, e.is_active,
           e.opening_balance
             + COALESCE((SELECT SUM(amount) FROM purchases p WHERE p.entity_id = e.id AND p.purchase_date < $1), 0)
             - COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.entity_id = e.id AND t.transaction_type = 'DEBIT' AND t.cleared_date < $1), 0) AS opening,
           COALESCE((SELECT SUM(amount) FROM purchases p WHERE p.entity_id = e.id AND p.purchase_date BETWEEN $1 AND $2), 0) AS purchases,
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.entity_id = e.id AND t.transaction_type = 'DEBIT' AND t.cleared_date BETWEEN $1 AND $2), 0) AS payments,
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.entity_id = e.id AND t.transaction_type = 'DEBIT' AND t.cheque_date <= $2
                       AND (t.cleared_date IS NULL OR t.cleared_date > $2) AND (t.cancelled_date IS NULL OR t.cancelled_date > $2)), 0) AS uncleared
         FROM entities e WHERE e.type = 'VENDOR' ${entityCond}
         ORDER BY LOWER(e.name)`,
        params
      );
      const data = rows
        .map((r) => ({ name: r.name + (r.is_active ? '' : ' (inactive)'), opening: num(r.opening), purchases: num(r.purchases), payments: num(r.payments), uncleared: num(r.uncleared) }))
        .map((r) => ({ ...r, outstanding: r.opening + r.purchases - r.payments }))
        .filter((r) => r.opening || r.purchases || r.payments || r.uncleared);
      const t = {
        opening: sum(data, (r) => r.opening), purchases: sum(data, (r) => r.purchases), payments: sum(data, (r) => r.payments),
        outstanding: sum(data, (r) => r.outstanding), uncleared: sum(data, (r) => r.uncleared),
      };
      const periodLabel = period === 'month' ? monthLabel(startMonth) : `${monthLabel(startMonth, 'short')} – ${monthLabel(endMonth, 'short')}`;
      return {
        title: this.title,
        subtitle: [`${period === 'year' ? 'Annual' : period === 'quarter' ? 'Quarterly' : 'Monthly'}: ${periodLabel}`, await entityName(p.entityId)].filter(Boolean).join(' · '),
        summary: [
          { label: 'Opening balance', value: formatAmount(t.opening) },
          { label: 'Purchases', value: formatAmount(t.purchases) },
          { label: 'Payments made (cleared)', value: formatAmount(t.payments) },
          { label: 'Outstanding balance', value: formatAmount(t.outstanding) },
        ],
        sections: [{
          columns: [
            { key: 'name', label: 'Creditor' },
            { key: 'opening', label: 'Opening Balance', type: 'money' },
            { key: 'purchases', label: 'Purchases', type: 'money' },
            { key: 'payments', label: 'Payments Made (Cleared)', type: 'money' },
            { key: 'outstanding', label: 'Outstanding Balance', type: 'money' },
            { key: 'uncleared', label: 'Uncleared Cheques', type: 'money' },
          ],
          rows: [...data.map((r) => ({ cells: r })), { kind: 'total', cells: { name: 'Total', ...t } }],
        }],
      };
    },
  },
  {
    slug: 'monthly-outstanding',
    title: 'Uncleared Cheques by Month',
    group: 'Payables',
    description: 'Number and value of creditor cheques issued in each month that were still uncleared at the end of that month.',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cheque date',
    async build(p) {
      const r = await monthlySummary('DEBIT', 't.cheque_date', PENDING_AT_CHEQUE_MONTH_END, p, ['Uncleared Cheques', 'Uncleared Amount']);
      return { ...r, title: this.title };
    },
  },
  {
    slug: 'monthly-cleared',
    title: 'Cleared Cheques by Month',
    group: 'Payables',
    description: 'Number and value of creditor cheques cleared in each month.',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cleared date',
    defaults: lastTwelveMonths,
    async build(p) {
      const r = await monthlySummary('DEBIT', 't.cleared_date', `t.status = 'CLEARED'`, p, ['Cleared Cheques', 'Cleared Amount']);
      return { ...r, title: this.title };
    },
  },
  {
    slug: 'monthly-cancelled',
    title: 'Cancelled Cheques by Month',
    group: 'Payables',
    description: 'Number and value of creditor cheques cancelled in each month.',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cancellation date',
    defaults: lastTwelveMonths,
    async build(p) {
      const r = await monthlySummary('DEBIT', 't.cancelled_date', `t.status = 'CANCELLED'`, p, ['Cancelled Cheques', 'Cancelled Amount']);
      return { ...r, title: this.title };
    },
  },

  // ── Summary reports (Month ⇄ Date switch) ───────────────────────────────────
  {
    slug: 'in-hand-daily',
    title: 'Cheques in Hand — Daily Summary',
    group: 'Summary',
    description: 'Every date of the chosen month or date range in order, with the number and value of customer cheques still in hand or deposited at the end of the period (0 on days with none).',
    params: ['monthOrRange', 'entity'],
    entityType: 'CUSTOMER',
    defaults: () => ({ mode: 'month', month: currentMonthKey() }),
    async build(p) {
      return { title: this.title, ...(await dailyPendingSummary('CREDIT', p, ['Cheques in hand', 'Amount in hand'])) };
    },
  },
  {
    slug: 'uncleared-daily',
    title: 'Uncleared Cheques — Daily Summary',
    group: 'Summary',
    description: 'Every date of the chosen month or date range in order, with the number and value of creditor cheques still uncleared at the end of the period (0 on days with none).',
    params: ['monthOrRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    defaults: () => ({ mode: 'month', month: currentMonthKey() }),
    async build(p) {
      return { title: this.title, ...(await dailyPendingSummary('DEBIT', p, ['Uncleared cheques', 'Uncleared amount'])) };
    },
  },
  {
    slug: 'payables-summary',
    title: 'Creditor Payables Summary',
    group: 'Summary',
    description: 'Each creditor with their balance at the start of the chosen month or date range, purchases and cleared cheques in the period, and the outstanding balance at the end (opening balance + purchases − cleared cheques), with totals.',
    params: ['monthOrRange'],
    defaults: () => ({ mode: 'month', month: currentMonthKey() }),
    async build(p) {
      const byDate = p.mode === 'date' || (!p.month && !!(p.from || p.to));
      const month = p.month ?? currentMonthKey();
      const end = byDate ? (p.to ?? todayKey()) : monthEnd(month);
      const start = byDate ? (p.from && p.from <= end ? p.from : `${end.slice(0, 7)}-01`) : `${month}-01`;
      // Closing balance matches the Outstanding Balance column of Creditor Payables.
      const rows = await query(
        `SELECT e.name, e.is_active, e.opening_balance
             + COALESCE((SELECT SUM(amount) FROM purchases p WHERE p.entity_id = e.id AND p.purchase_date < $1), 0)
             - COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.entity_id = e.id AND t.transaction_type = 'DEBIT' AND t.cleared_date < $1), 0) AS opening,
           COALESCE((SELECT SUM(amount) FROM purchases p WHERE p.entity_id = e.id AND p.purchase_date BETWEEN $1 AND $2), 0) AS purchases,
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.entity_id = e.id AND t.transaction_type = 'DEBIT' AND t.cleared_date BETWEEN $1 AND $2), 0) AS paid
         FROM entities e WHERE e.type = 'VENDOR'
         ORDER BY LOWER(e.name)`,
        [start, end]
      );
      const data = rows
        .map((r) => {
          const opening = num(r.opening), purchases = num(r.purchases), paid = num(r.paid);
          return { name: r.name + (r.is_active ? '' : ' (inactive)'), opening, purchases, paid, outstanding: opening + purchases - paid };
        })
        .filter((r) => r.opening || r.purchases || r.paid || r.outstanding);
      const total = sum(data, (r) => r.outstanding);
      return {
        title: this.title,
        subtitle: byDate ? `${formatDate(start)} – ${formatDate(end)}` : monthLabel(month),
        summary: [
          { label: 'Creditors', value: data.length.toLocaleString() },
          { label: 'Purchases', value: formatAmount(sum(data, (r) => r.purchases)) },
          { label: 'Cleared cheques', value: formatAmount(sum(data, (r) => r.paid)) },
          { label: 'Total outstanding', value: formatAmount(total) },
        ],
        sections: [{
          columns: [
            { key: 'name', label: 'Creditor' },
            { key: 'opening', label: 'Opening Balance', type: 'money' },
            { key: 'purchases', label: 'Purchases', type: 'money' },
            { key: 'paid', label: 'Cleared Cheques', type: 'money' },
            { key: 'outstanding', label: 'Outstanding Balance', type: 'money' },
          ],
          rows: [
            ...data.map((r) => ({ cells: r })),
            {
              kind: 'total',
              cells: {
                name: 'Total',
                opening: sum(data, (r) => r.opening),
                purchases: sum(data, (r) => r.purchases),
                paid: sum(data, (r) => r.paid),
                outstanding: total,
              },
            },
          ],
        }],
      };
    },
  },
  {
    slug: 'bank-reconciliation-statement',
    title: 'Bank Reconciliation Statement',
    group: 'Summary',
    description: 'Reconciles the cash book with the bank statement at the end of the period: creditor cheques issued but not yet cleared, customer cheques deposited but not yet credited, and the cheques credited, returned, cleared and cancelled in the period, with the returned and cancelled cheques listed.',
    params: ['monthOrRange', 'bookBalance'],
    defaults: () => ({ mode: 'month', month: currentMonthKey() }),
    async build(p) {
      const { start, end, label } = summaryPeriod(p);
      // As at the period end: customer cheques banked but not credited (deposits in transit),
      // and creditor cheques issued but not presented / cleared (unpresented cheques).
      const inTransit = `t.transaction_type = 'CREDIT' AND t.deposited_date <= $1
        AND (t.cleared_date IS NULL OR t.cleared_date > $1) AND (t.returned_date IS NULL OR t.returned_date > $1)`;
      const unpresented = `t.transaction_type = 'DEBIT' AND t.cheque_date <= $1
        AND (t.cleared_date IS NULL OR t.cleared_date > $1) AND (t.cancelled_date IS NULL OR t.cancelled_date > $1)`;
      const [open, [activity], reversed] = await Promise.all([
        query(
          `SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS}
           WHERE (${inTransit}) OR (${unpresented})
           ORDER BY LOWER(e.name), t.cheque_date, t.cheque_number`,
          [end]
        ) as Promise<TransactionWithEntity[]>,
        query(
          `SELECT
             COUNT(*) FILTER (WHERE transaction_type = 'CREDIT' AND deposited_date BETWEEN $1 AND $2)::int AS deposited_n,
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'CREDIT' AND deposited_date BETWEEN $1 AND $2), 0) AS deposited,
             COUNT(*) FILTER (WHERE transaction_type = 'CREDIT' AND cleared_date BETWEEN $1 AND $2)::int AS credited_n,
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'CREDIT' AND cleared_date BETWEEN $1 AND $2), 0) AS credited,
             COUNT(*) FILTER (WHERE transaction_type = 'CREDIT' AND returned_date BETWEEN $1 AND $2)::int AS returned_n,
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'CREDIT' AND returned_date BETWEEN $1 AND $2), 0) AS returned,
             COUNT(*) FILTER (WHERE transaction_type = 'DEBIT' AND cleared_date BETWEEN $1 AND $2)::int AS cleared_n,
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'DEBIT' AND cleared_date BETWEEN $1 AND $2), 0) AS cleared,
             COUNT(*) FILTER (WHERE transaction_type = 'DEBIT' AND cancelled_date BETWEEN $1 AND $2)::int AS cancelled_n,
             COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'DEBIT' AND cancelled_date BETWEEN $1 AND $2), 0) AS cancelled
           FROM transactions`,
          [start, end]
        ),
        // Customer cheques returned and creditor cheques cancelled during the period.
        query(
          `SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS}
           WHERE (t.transaction_type = 'CREDIT' AND t.returned_date BETWEEN $1 AND $2)
              OR (t.transaction_type = 'DEBIT' AND t.cancelled_date BETWEEN $1 AND $2)
           ORDER BY COALESCE(t.returned_date, t.cancelled_date), LOWER(e.name), t.cheque_number`,
          [start, end]
        ) as Promise<TransactionWithEntity[]>,
      ]);
      const returnedRows = reversed.filter((c) => c.transaction_type === 'CREDIT');
      const cancelledRows = reversed.filter((c) => c.transaction_type === 'DEBIT');
      const transitRows = open.filter((c) => c.transaction_type === 'CREDIT');
      const unpresentedRows = open.filter((c) => c.transaction_type === 'DEBIT');
      const transit = sum(transitRows, (r) => r.amount);
      const unpaid = sum(unpresentedRows, (r) => r.amount);
      const book = p.bookBalance;
      const asAt = formatDate(end);

      const statement: Section = {
        title: `Reconciliation as at ${asAt}`,
        noSort: true,
        columns: [{ key: 'item', label: 'Item' }, { key: 'count', label: 'Cheques', type: 'number' }, { key: 'amount', label: 'Amount (LKR)', type: 'money' }],
        rows: [
          ...(book !== undefined ? [{ cells: { item: 'Balance as per cash book', count: null, amount: book } }] : []),
          { cells: { item: 'Add: cheques issued to creditors, not yet cleared (unpresented)', count: unpresentedRows.length, amount: unpaid } },
          { cells: { item: 'Less: customer cheques deposited, not yet credited (in transit)', count: transitRows.length, amount: -transit } },
          book !== undefined
            ? { kind: 'total', cells: { item: 'Balance as per bank statement', count: null, amount: book + unpaid - transit } }
            : { kind: 'total', cells: { item: 'Difference: bank statement − cash book', count: null, amount: unpaid - transit } },
        ],
      };
      const a = activity ?? {};
      const line = (item: string, n: string, amt: string) => ({ cells: { item, count: a[n] ?? 0, amount: num(a[amt]) } });
      const activitySection: Section = {
        title: `Cheque activity, ${label}`,
        noSort: true,
        columns: [{ key: 'item', label: 'Activity' }, { key: 'count', label: 'Cheques', type: 'number' }, { key: 'amount', label: 'Amount (LKR)', type: 'money' }],
        rows: [
          line('Customer cheques deposited', 'deposited_n', 'deposited'),
          line('Customer cheques credited by the bank', 'credited_n', 'credited'),
          line('Customer cheques returned', 'returned_n', 'returned'),
          line('Creditor cheques cleared by the bank', 'cleared_n', 'cleared'),
          line('Creditor cheques cancelled', 'cancelled_n', 'cancelled'),
        ],
      };
      return {
        title: this.title,
        subtitle: label,
        summary: [
          { label: 'Unpresented cheques', value: `${formatAmount(unpaid)} (${unpresentedRows.length})` },
          { label: 'Deposits in transit', value: `${formatAmount(transit)} (${transitRows.length})` },
          book !== undefined
            ? { label: 'Balance as per bank statement', value: formatAmount(book + unpaid - transit) }
            : { label: 'Bank − cash book', value: formatAmount(unpaid - transit) },
        ],
        sections: [
          statement,
          activitySection,
          {
            title: `Creditor cheques not yet cleared at ${asAt}`,
            columns: [C.creditor, C.grn, C.chequeNo, C.chequeDate, C.bank, C.amount],
            rows: [
              ...unpresentedRows.map((c) => ({ cells: cells(c) })),
              { kind: 'total', cells: { entity_name: `Total — ${plural(unpresentedRows.length, 'cheque')}`, amount: unpaid } },
            ],
          },
          {
            title: `Customer cheques deposited, not yet credited at ${asAt}`,
            columns: [C.customer, C.chequeNo, C.chequeDate, { key: 'deposited_date', label: 'Deposited Date', type: 'date' }, C.bank, C.amount],
            rows: [
              ...transitRows.map((c) => ({ cells: cells(c, { deposited_date: c.deposited_date }) })),
              { kind: 'total', cells: { entity_name: `Total — ${plural(transitRows.length, 'cheque')}`, amount: transit } },
            ],
          },
          {
            title: `Customer cheques returned, ${label}`,
            columns: [C.customer, C.chequeNo, C.chequeDate, { key: 'returned_date', label: 'Returned Date', type: 'date' }, C.bank, C.amount],
            rows: [
              ...returnedRows.map((c) => ({ cells: cells(c, { returned_date: c.returned_date }) })),
              { kind: 'total', cells: { entity_name: `Total — ${plural(returnedRows.length, 'cheque')}`, amount: sum(returnedRows, (r) => r.amount) } },
            ],
          },
          {
            title: `Creditor cheques cancelled, ${label}`,
            columns: [C.creditor, C.grn, C.chequeNo, C.chequeDate, { key: 'cancelled_date', label: 'Cancelled Date', type: 'date' }, C.bank, C.amount],
            rows: [
              ...cancelledRows.map((c) => ({ cells: cells(c, { cancelled_date: c.cancelled_date }) })),
              { kind: 'total', cells: { entity_name: `Total — ${plural(cancelledRows.length, 'cheque')}`, amount: sum(cancelledRows, (r) => r.amount) } },
            ],
          },
        ],
      };
    },
  },

  // ── Registers (exports of the filtered cheque lists) ───────────────────────
  ...(['CREDIT', 'DEBIT'] as const).map((type): ReportDefinition => ({
    slug: type === 'CREDIT' ? 'customer-cheques' : 'creditor-cheques',
    title: type === 'CREDIT' ? 'Customer Cheque Register' : 'Creditor Cheque Register',
    group: 'Registers',
    description: type === 'CREDIT' ? 'All customer cheques matching the register filters.' : 'All creditor cheques matching the register filters.',
    params: ['register'],
    async build(_p, raw) {
      const filters = parseChequeFilters(raw, type);
      const params: unknown[] = [];
      const rows = (await query(
        `SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS} ${chequeWhere(filters, params)} ORDER BY ${chequeOrderBy(filters, 't.cheque_date, t.created_at')}`,
        params
      )) as TransactionWithEntity[];
      const byStatus = [...groupBy(rows, (r) => r.status).entries()].map(([s, list]) => ({
        label: STATUS_LABEL[s as ChequeStatus],
        value: `${formatAmount(sum(list, (r) => r.amount))} (${list.length})`,
      }));
      const columns: Column[] = type === 'CREDIT'
        ? [C.chequeDate, C.customer, C.chequeNo, C.bank, C.amount, C.status, { key: 'status_date', label: 'Status Date', type: 'date' }, { key: 'entry_date', label: 'Entry Date', type: 'date' }, { key: 'remarks', label: 'Remarks' }]
        : [C.grn, C.creditor, C.chequeNo, C.chequeDate, C.bank, C.amount, C.status, { key: 'status_date', label: 'Status Date', type: 'date' }, { key: 'entry_date', label: 'Entry Date', type: 'date' }, { key: 'remarks', label: 'Remarks' }];
      return {
        title: this.title,
        subtitle: buildFilterLabel(filters, await entityName(filters.entityId)),
        summary: [{ label: 'Total', value: `${formatAmount(sum(rows, (r) => r.amount))} (${rows.length})` }, ...byStatus],
        sections: [{
          columns,
          rows: [
            ...rows.map((c) => ({
              cells: cells(c, {
                status_date: c.returned_date ?? c.cancelled_date ?? c.cleared_date ?? c.deposited_date,
                entry_date: c.entry_date,
                remarks: c.remarks,
              }),
            })),
            { kind: 'total' as const, cells: { [columns[0].key]: `Total — ${plural(rows.length, 'cheque')}`, amount: sum(rows, (r) => r.amount) } },
          ],
        }],
      };
    },
  })),
];

export const getReport = (slug: string) => REPORTS.find((r) => r.slug === slug);
