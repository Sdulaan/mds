import Link from 'next/link';
import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { getEntityOptions } from '@/lib/data/entities';
import { PURCHASE_SORT_KEYS, getPurchases } from '@/lib/data/purchases';
import { formatDate, recentMonths, todayKey } from '@/lib/dates';
import { isUuid, pick } from '@/lib/filters';
import { isMonthKey } from '@/lib/dates';
import { formatAmount, formatNumber } from '@/lib/format';
import { parseSort, sortHref, type Sort } from '@/lib/sort';
import { btnSecondary, card, cn, input, td, th } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import SortHeader, { SortInputs } from '@/components/SortHeader';
import GrnBalance from '@/components/purchases/GrnBalance';
import PurchaseForm from '@/components/purchases/PurchaseForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Purchases (GRN)' };

export default async function PurchasesPage({ searchParams }: PageProps<'/purchases'>) {
  const sp = await searchParams;
  const q = pick(sp, 'q')?.trim() || undefined;
  const entity = pick(sp, 'entity');
  const month = pick(sp, 'month');
  const parsed = parseSort(sp, PURCHASE_SORT_KEYS);
  const filters = { q, entityId: isUuid(entity) ? entity : undefined, month: isMonthKey(month) ? month : undefined, sort: parsed };
  // Default order (no ?sort): newest first.
  const sort: Sort = parsed.sort ? parsed : { sort: 'date', dir: 'desc' };
  const filterQuery = new URLSearchParams(
    Object.entries({ q, entity: filters.entityId, month: filters.month }).filter((e): e is [string, string] => !!e[1])
  ).toString();
  const href = (column: string) => sortHref('/purchases', filterQuery, sort, column);
  const [creditors, result] = await Promise.all([getEntityOptions('VENDOR'), getPurchases(filters)]);

  return (
    <div>
      <PageHeader
        title="Purchases (GRN)"
        description="Goods received from creditors. Used with issued cheques to build the monthly creditor payables report."
      />

      <section className={`${card} mb-6 p-5`}>
        <h2 className="mb-4 text-base font-semibold text-fg">Add purchase</h2>
        <PurchaseForm creditors={creditors} today={todayKey()} />
      </section>

      <form className={`${card} mb-4 flex flex-wrap items-end gap-3 p-4`}>
        <SortInputs sort={parsed} />
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input type="search" name="q" defaultValue={q ?? ''} placeholder="Search creditor, GRN or invoice…" className={cn(input, 'pl-10')} />
        </div>
        <select name="entity" defaultValue={filters.entityId ?? ''} className={cn(input, 'w-auto max-w-56')} aria-label="Creditor">
          <option value="">All creditors</option>
          {creditors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="month" defaultValue={filters.month ?? ''} className={cn(input, 'w-auto')} aria-label="Month">
          <option value="">All months</option>
          {recentMonths(24).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button type="submit" className={btnSecondary}>Filter</button>
      </form>

      <p className="mb-3 text-sm text-muted">
        {result.total.toLocaleString()} purchase{result.total === 1 ? '' : 's'} · <span className="font-semibold text-fg">{formatAmount(result.totalAmount)}</span>
        {result.total > result.rows.length && ` · showing the first ${result.rows.length}`}
      </p>

      {result.rows.length === 0 ? (
        <p className={`${card} py-12 text-center text-sm text-subtle`}>No purchases recorded.</p>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <SortHeader label="Date" column="date" current={sort} href={href('date')} />
                  <SortHeader label="Creditor" column="creditor" current={sort} href={href('creditor')} />
                  <SortHeader label="GRN No." column="grn" current={sort} href={href('grn')} />
                  <SortHeader label="Invoice No." column="invoice" current={sort} href={href('invoice')} />
                  <SortHeader label="Amount (LKR)" column="amount" current={sort} href={href('amount')} align="right" />
                  <SortHeader label="Balance (LKR)" column="balance" current={sort} href={href('balance')} align="right" />
                  <th className={th}>Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-surface-2/60">
                    <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(p.purchase_date)}</td>
                    <td className={td}><Link href={`/purchases/${p.id}`} className="font-medium text-fg hover:text-brand">{p.entity_name}</Link></td>
                    <td className={`${td} font-mono text-xs text-muted`}>{p.grn_number || '—'}</td>
                    <td className={`${td} font-mono text-xs text-muted`}>{p.invoice_number || '—'}</td>
                    <td className={`${td} whitespace-nowrap text-right font-medium tabular-nums text-fg`}>{formatNumber(p.amount)}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                      <GrnBalance amount={Number(p.amount)} paid={p.paid} />
                    </td>
                    <td className={`${td} max-w-64 truncate text-muted`}>{p.remarks || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
