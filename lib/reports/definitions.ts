import 'server-only';
import { query } from '@/lib/db';
import { CHEQUE_COLUMNS, CHEQUE_JOINS, chequeWhere } from '@/lib/data/cheques';
import { addMonths, currentMonthKey, formatDate, monthEnd, monthLabel } from '@/lib/dates';
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
 * One section per entity: its cheques, a subtotal after each month (by `monthOf`),
 * and an entity total. Used by the customer-/creditor-wise reports.
 */
function entitySections(
  rows: TransactionWithEntity[],
  columns: Column[],
  toCells: (c: TransactionWithEntity) => Row['cells'],
  monthOf: ((c: TransactionWithEntity) => string | null) | null,
  labelKey = columns[0].key
): Section[] {
  const sections: Section[] = [];
  for (const [, list] of groupBy(rows, (r) => r.entity_id)) {
    const out: Row[] = [];
    if (monthOf) {
      for (const [month, monthRows] of groupBy(list, (r) => (monthOf(r) ?? '').slice(0, 7))) {
        out.push(...monthRows.map((r) => ({ cells: toCells(r) })));
        out.push(subtotal(`${month ? monthLabel(month) : 'No date'} total (${monthRows.length})`, labelKey, 'amount', sum(monthRows, (r) => r.amount)));
      }
    } else {
      out.push(...list.map((r) => ({ cells: toCells(r) })));
    }
    out.push({ kind: 'total', cells: { [labelKey]: `Total — ${plural(list.length, 'cheque')}`, amount: sum(list, (r) => r.amount) } });
    sections.push({ title: list[0].entity_name + (list[0].entity_active ? '' : ' (inactive)'), columns, rows: out });
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
        ...rows.map((r) => ({ cells: { month: monthLabel(r.month), count: r.count, amount: num(r.amount) } })),
        { kind: 'total' as const, cells: { month: 'Total', count, amount: total } },
      ],
    }],
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

export const REPORTS: ReportDefinition[] = [
  // ── Receivables (SRS 1: Cheque Management System) ──────────────────────────
  {
    slug: 'cheques-in-hand',
    title: 'Pending Cheques in Hand — Customer-wise',
    group: 'Receivables',
    description: 'Outstanding customer cheques (in hand or deposited, not yet credited) per customer, with cheque dates, numbers and monthly totals.',
    params: ['entity', 'dateRange', 'bank'],
    entityType: 'CUSTOMER',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const rows = await fetchCheques('CREDIT', [PENDING_RECEIVABLE, ...standardConditions(p, 't.cheque_date', params)], params, 'LOWER(e.name), t.cheque_date, t.cheque_number');
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: totalsSummary(rows, 'Pending cheques', 'Pending amount', 'Customers'),
        sections: entitySections(rows, [C.chequeDate, C.chequeNo, C.bank, C.status, C.amount], (c) => cells(c), (c) => c.cheque_date),
      };
    },
  },
  {
    slug: 'credited-cheques',
    title: 'Credited Cheques — Customer-wise',
    group: 'Receivables',
    description: 'Customer cheques successfully credited to the bank, per customer, with cheque dates, numbers and monthly totals.',
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
          (c) => c.cleared_date
        ),
      };
    },
  },
  {
    slug: 'returned-cheques',
    title: 'Monthly Customer-wise Returned Cheques',
    group: 'Receivables',
    description: 'Bounced / returned customer cheques grouped by month and customer.',
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
          out.push(...custRows.map((c) => ({ cells: cells(c, { returned_date: c.returned_date }) })));
          if (custRows.length > 1) out.push(subtotal(`${custRows[0].entity_name} (${custRows.length})`, 'entity_name', 'amount', sum(custRows, (r) => r.amount)));
        }
        out.push({ kind: 'total', cells: { entity_name: `Total — ${plural(list.length, 'cheque')}`, amount: sum(list, (r) => r.amount) } });
        sections.push({ title: monthLabel(month), columns, rows: out });
      }
      return { title: this.title, subtitle: await describe(p), summary: totalsSummary(rows, 'Returned cheques', 'Returned amount', 'Customers'), sections };
    },
  },
  {
    slug: 'in-hand-summary',
    title: 'Month-wise Cheques in Hand Summary',
    group: 'Receivables',
    description: 'Pending customer cheques by cheque date, with daily and monthly totals.',
    params: ['dateRange', 'entity'],
    entityType: 'CUSTOMER',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const conditions = [PENDING_RECEIVABLE, ...standardConditions(p, 't.cheque_date', params)];
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
    title: 'Monthly Cheques Received',
    group: 'Receivables',
    description: 'Number and value of customer cheques by cheque month, with credited, returned and pending amounts.',
    params: ['dateRange', 'entity'],
    entityType: 'CUSTOMER',
    dateLabel: 'Cheque date',
    defaults: lastTwelveMonths,
    async build(p) {
      const params: unknown[] = [];
      const conditions = standardConditions(p, 't.cheque_date', params);
      const rows = await query(
        `SELECT TO_CHAR(t.cheque_date, 'YYYY-MM') AS month, COUNT(*)::int AS count, SUM(t.amount) AS amount,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'CREDITED'), 0) AS credited,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'RETURNED'), 0) AS returned,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('IN_HAND', 'DEPOSITED')), 0) AS pending
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
            ...rows.map((r) => ({ cells: { month: monthLabel(r.month), count: r.count, ...Object.fromEntries(k.map((key) => [key, num(r[key])])) } })),
            { kind: 'total' as const, cells: { month: 'Total', count, ...totals } },
          ],
        }],
      };
    },
  },

  // ── Payables (SRS 2: Creditors Outstanding Cheques & Monthly Payables) ─────
  {
    slug: 'creditor-outstanding',
    title: 'Creditor-wise Outstanding Cheques',
    group: 'Payables',
    description: 'All pending (uncleared) cheques issued to creditors, with GRN numbers and status. (SRS 5.1)',
    params: ['entity', 'dateRange', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const rows = await fetchCheques('DEBIT', [`t.status = 'PENDING'`, ...standardConditions(p, 't.cheque_date', params)], params, 'LOWER(e.name), t.cheque_date, t.cheque_number');
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: totalsSummary(rows, 'Total outstanding cheques', 'Total outstanding amount'),
        sections: [{
          columns: [C.creditor, C.grn, C.chequeNo, C.chequeDate, C.amount, C.status],
          rows: [
            ...rows.map((c) => ({ cells: cells(c) })),
            { kind: 'total', cells: { entity_name: `Total — ${plural(rows.length, 'cheque')}`, amount: sum(rows, (r) => r.amount) } },
          ],
        }],
      };
    },
  },
  {
    slug: 'creditor-uncleared',
    title: 'Creditor-wise Uncleared Cheques',
    group: 'Payables',
    description: 'Uncleared cheques grouped by creditor, with the number and outstanding amount per creditor. (SRS 5.2)',
    params: ['entity', 'dateRange', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cheque date',
    async build(p) {
      const params: unknown[] = [];
      const rows = await fetchCheques('DEBIT', [`t.status = 'PENDING'`, ...standardConditions(p, 't.cheque_date', params)], params, 'LOWER(e.name), t.cheque_date, t.cheque_number');
      const detail = entitySections(rows, [C.grn, C.chequeNo, C.chequeDate, C.bank, C.amount], (c) => cells(c), null, 'grn_number');
      const byCreditor = [...groupBy(rows, (r) => r.entity_id).values()];
      const summarySection: Section = {
        title: 'Creditor-wise payable summary',
        columns: [C.creditor, { key: 'count', label: 'Uncleared Cheques', type: 'number' }, { key: 'amount', label: 'Outstanding (LKR)', type: 'money' }],
        rows: [
          ...byCreditor.map((list) => ({ cells: { entity_name: list[0].entity_name, count: list.length, amount: sum(list, (r) => r.amount) } })),
          { kind: 'total', cells: { entity_name: 'Total', count: rows.length, amount: sum(rows, (r) => r.amount) } },
        ],
      };
      return {
        title: this.title,
        subtitle: await describe(p),
        summary: totalsSummary(rows, 'Uncleared cheques', 'Total outstanding', 'Creditors'),
        sections: [summarySection, ...detail],
      };
    },
  },
  {
    slug: 'creditor-cleared',
    title: 'Creditor-wise Cleared Cheques',
    group: 'Payables',
    description: 'Cheques cleared by the bank, per creditor, with cleared dates and a monthly summary. (SRS 5.3)',
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
          ...months.map(([m, list]) => ({ cells: { month: monthLabel(m), count: list.length, amount: sum(list, (r) => r.amount) } })),
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
    description: 'Cheques cancelled after issue, with cancellation dates. (SRS 5.4)',
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
    title: 'Monthly Creditor Payables',
    group: 'Payables',
    description: 'Opening balance, purchases (GRNs), payments (cheques issued) and outstanding balance per creditor — monthly, quarterly or annual. (SRS 5.5)',
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
      // Payments = cheques issued in the period (cancelled cheques excluded).
      const rows = await query(
        `SELECT e.name, e.is_active,
           e.opening_balance
             + COALESCE((SELECT SUM(amount) FROM purchases p WHERE p.entity_id = e.id AND p.purchase_date < $1), 0)
             - COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.entity_id = e.id AND t.transaction_type = 'DEBIT' AND t.status <> 'CANCELLED' AND t.cheque_date < $1), 0) AS opening,
           COALESCE((SELECT SUM(amount) FROM purchases p WHERE p.entity_id = e.id AND p.purchase_date BETWEEN $1 AND $2), 0) AS purchases,
           COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.entity_id = e.id AND t.transaction_type = 'DEBIT' AND t.status <> 'CANCELLED' AND t.cheque_date BETWEEN $1 AND $2), 0) AS payments
         FROM entities e WHERE e.type = 'VENDOR' ${entityCond}
         ORDER BY LOWER(e.name)`,
        params
      );
      const data = rows
        .map((r) => ({ name: r.name + (r.is_active ? '' : ' (inactive)'), opening: num(r.opening), purchases: num(r.purchases), payments: num(r.payments) }))
        .map((r) => ({ ...r, outstanding: r.opening + r.purchases - r.payments }))
        .filter((r) => r.opening || r.purchases || r.payments);
      const t = { opening: sum(data, (r) => r.opening), purchases: sum(data, (r) => r.purchases), payments: sum(data, (r) => r.payments), outstanding: sum(data, (r) => r.outstanding) };
      const periodLabel = period === 'month' ? monthLabel(startMonth) : `${monthLabel(startMonth, 'short')} – ${monthLabel(endMonth, 'short')}`;
      return {
        title: `${period === 'year' ? 'Annual' : period === 'quarter' ? 'Quarterly' : 'Monthly'} Creditor Payables`,
        subtitle: [periodLabel, await entityName(p.entityId)].filter(Boolean).join(' · '),
        summary: [
          { label: 'Opening balance', value: formatAmount(t.opening) },
          { label: 'Purchases', value: formatAmount(t.purchases) },
          { label: 'Payments made', value: formatAmount(t.payments) },
          { label: 'Outstanding balance', value: formatAmount(t.outstanding) },
        ],
        sections: [{
          columns: [
            { key: 'name', label: 'Creditor' },
            { key: 'opening', label: 'Opening Balance', type: 'money' },
            { key: 'purchases', label: 'Purchases', type: 'money' },
            { key: 'payments', label: 'Payments Made', type: 'money' },
            { key: 'outstanding', label: 'Outstanding Balance', type: 'money' },
          ],
          rows: [...data.map((r) => ({ cells: r })), { kind: 'total', cells: { name: 'Total', ...t } }],
        }],
      };
    },
  },
  {
    slug: 'monthly-outstanding',
    title: 'Monthly Outstanding Cheque Summary',
    group: 'Payables',
    description: 'Pending creditor cheques by cheque month. (SRS 5.6)',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cheque date',
    async build(p) {
      const r = await monthlySummary('DEBIT', 't.cheque_date', `t.status = 'PENDING'`, p, ['Outstanding Cheques', 'Outstanding Amount']);
      return { ...r, title: this.title };
    },
  },
  {
    slug: 'monthly-cleared',
    title: 'Monthly Cleared Cheque Summary',
    group: 'Payables',
    description: 'Creditor cheques cleared each month. (SRS 5.7)',
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
    title: 'Monthly Cancelled Cheque Summary',
    group: 'Payables',
    description: 'Creditor cheques cancelled each month. (SRS 5.8)',
    params: ['dateRange', 'entity', 'bank'],
    entityType: 'VENDOR',
    dateLabel: 'Cancellation date',
    defaults: lastTwelveMonths,
    async build(p) {
      const r = await monthlySummary('DEBIT', 't.cancelled_date', `t.status = 'CANCELLED'`, p, ['Cancelled Cheques', 'Cancelled Amount']);
      return { ...r, title: this.title };
    },
  },
  {
    slug: 'bank-reconciliation',
    title: 'Bank Reconciliation',
    group: 'Payables',
    description: 'Issued, cleared and outstanding creditor cheques per bank for a month, for reconciling against the bank statement. (SRS 13)',
    params: ['month', 'bank'],
    defaults: () => ({ month: currentMonthKey() }),
    async build(p) {
      const month = p.month ?? currentMonthKey();
      const start = `${month}-01`;
      const end = monthEnd(month);
      const params: unknown[] = [start, end];
      const bankCond = p.bank ? (params.push(p.bank), `AND t.bank_name ILIKE $3`) : '';
      // Outstanding at month end = issued on/before the end and neither cleared nor cancelled by then.
      const rows = await query(
        `SELECT ${CHEQUE_COLUMNS},
           (t.cheque_date BETWEEN $1 AND $2 AND (t.cancelled_date IS NULL OR t.cancelled_date > $2)) AS issued,
           (t.cleared_date BETWEEN $1 AND $2) AS cleared,
           (t.cheque_date <= $2 AND (t.cleared_date IS NULL OR t.cleared_date > $2) AND (t.cancelled_date IS NULL OR t.cancelled_date > $2)) AS outstanding
         ${CHEQUE_JOINS}
         WHERE t.transaction_type = 'DEBIT' ${bankCond}
           AND (t.cheque_date BETWEEN $1 AND $2 OR t.cleared_date BETWEEN $1 AND $2
                OR (t.cheque_date <= $2 AND (t.cleared_date IS NULL OR t.cleared_date > $2) AND (t.cancelled_date IS NULL OR t.cancelled_date > $2)))
         ORDER BY COALESCE(t.bank_name, ''), t.cheque_date, t.cheque_number`,
        params
      );
      const list = rows as (TransactionWithEntity & { issued: boolean; cleared: boolean; outstanding: boolean })[];
      const banks = [...groupBy(list, (r) => r.bank_name || 'No bank recorded').entries()];
      const agg = (rs: typeof list, key: 'issued' | 'cleared' | 'outstanding') => {
        const f = rs.filter((r) => r[key]);
        return { count: f.length, amount: sum(f, (r) => r.amount) };
      };
      const summaryRows: Row[] = banks.map(([bank, rs]) => {
        const i = agg(rs, 'issued'), c = agg(rs, 'cleared'), o = agg(rs, 'outstanding');
        return { cells: { bank, issued_count: i.count, issued: i.amount, cleared_count: c.count, cleared: c.amount, outstanding_count: o.count, outstanding: o.amount } };
      });
      const all = { i: agg(list, 'issued'), c: agg(list, 'cleared'), o: agg(list, 'outstanding') };
      summaryRows.push({ kind: 'total', cells: { bank: 'Total', issued_count: all.i.count, issued: all.i.amount, cleared_count: all.c.count, cleared: all.c.amount, outstanding_count: all.o.count, outstanding: all.o.amount } });

      const detail = (key: 'cleared' | 'outstanding', title: string, extra?: Column): Section => {
        const rs = list.filter((r) => r[key]);
        return {
          title,
          columns: [C.bank, C.creditor, C.grn, C.chequeNo, C.chequeDate, ...(extra ? [extra] : []), C.amount],
          rows: [
            ...rs.map((c) => ({ cells: cells(c, { bank_name: c.bank_name || '—', cleared_date: c.cleared_date }) })),
            { kind: 'total' as const, cells: { bank_name: `Total — ${plural(rs.length, 'cheque')}`, amount: sum(rs, (r) => r.amount) } },
          ],
        };
      };
      return {
        title: this.title,
        subtitle: [monthLabel(month), p.bank].filter(Boolean).join(' · '),
        summary: [
          { label: 'Issued this month', value: `${formatAmount(all.i.amount)} (${all.i.count})` },
          { label: 'Cleared this month', value: `${formatAmount(all.c.amount)} (${all.c.count})` },
          { label: `Outstanding at ${formatDate(end)}`, value: `${formatAmount(all.o.amount)} (${all.o.count})` },
        ],
        sections: [
          {
            title: 'Summary by bank',
            columns: [
              { key: 'bank', label: 'Bank' },
              { key: 'issued_count', label: 'Issued', type: 'number' }, { key: 'issued', label: 'Issued (LKR)', type: 'money' },
              { key: 'cleared_count', label: 'Cleared', type: 'number' }, { key: 'cleared', label: 'Cleared (LKR)', type: 'money' },
              { key: 'outstanding_count', label: 'Outstanding', type: 'number' }, { key: 'outstanding', label: 'Outstanding (LKR)', type: 'money' },
            ],
            rows: summaryRows,
          },
          detail('outstanding', `Outstanding cheques at ${formatDate(end)}`),
          detail('cleared', `Cheques cleared in ${monthLabel(month)}`, { key: 'cleared_date', label: 'Cleared Date', type: 'date' }),
        ],
      };
    },
  },

  // ── Registers (exports of the filtered cheque lists) ───────────────────────
  ...(['CREDIT', 'DEBIT'] as const).map((type): ReportDefinition => ({
    slug: type === 'CREDIT' ? 'customer-cheques' : 'creditor-cheques',
    title: type === 'CREDIT' ? 'Customer Cheque Register' : 'Outstanding Cheque Register',
    group: 'Registers',
    description: type === 'CREDIT' ? 'All customer cheques matching the register filters.' : 'All creditor cheques matching the register filters. (SRS 3)',
    params: ['register'],
    async build(_p, raw) {
      const filters = parseChequeFilters(raw, type);
      const params: unknown[] = [];
      const rows = (await query(
        `SELECT ${CHEQUE_COLUMNS} ${CHEQUE_JOINS} ${chequeWhere(filters, params)} ORDER BY t.cheque_date, t.created_at`,
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
