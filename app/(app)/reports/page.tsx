import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTransactions } from '@/lib/queries';
import { buildFilterLabel, filtersToQuery, parseFilters } from '@/lib/filters';
import { currentMonthKey, recentMonths } from '@/lib/dates';
import { formatAmount } from '@/lib/format';
import { summarize } from '@/lib/reports/summary';
import FilterBar from '@/components/FilterBar';
import ExportButtons from '@/components/ExportButtons';
import { TRANSACTION_STATUSES } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reports',
  description: 'Download cheque summary reports as Excel or PDF.',
};

type Filters = ReturnType<typeof parseFilters>;

const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400';
const td = 'px-4 py-3';

async function ReportPreview({ filters }: { filters: Filters }) {
  const transactions = await getTransactions({ ...filters, month: filters.month || undefined });
  const summary = summarize(transactions);
  const cell = (b: { count: number; amount: number }) => (
    <>
      <span className="font-semibold text-white">{formatAmount(b.amount)}</span>
      <span className="ml-1.5 text-xs text-slate-500">({b.count})</span>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Report</p>
          <p className="text-lg font-semibold text-white">{buildFilterLabel(filters)}</p>
          <p className="text-sm text-slate-400">
            {summary.count} cheque{summary.count === 1 ? '' : 's'} · {formatAmount(summary.total)}
          </p>
        </div>
        <ExportButtons filters={filters} />
      </div>

      {/* By type & status */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-800/60">
                <th className={`${th} text-left`} />
                {TRANSACTION_STATUSES.map((s) => (
                  <th key={s} className={`${th} text-right`}>{s}</th>
                ))}
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(['CREDIT', 'DEBIT'] as const).map((type) => (
                <tr key={type}>
                  <td className={`${td} font-medium text-slate-300`}>
                    {type === 'CREDIT' ? 'Credits (received)' : 'Debits (paid)'}
                  </td>
                  {TRANSACTION_STATUSES.map((s) => (
                    <td key={s} className={`${td} whitespace-nowrap text-right`}>{cell(summary.byType[type][s])}</td>
                  ))}
                  <td className={`${td} whitespace-nowrap text-right`}>{cell(summary.byType[type].ALL)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By entity */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">By Entity</h2>
        {summary.byEntity.length === 0 ? (
          <p className="glass-card py-12 text-center text-sm text-slate-500">No transactions for this selection.</p>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-800/60">
                    <th className={`${th} text-left`}>Entity</th>
                    <th className={`${th} text-right`}>Cheques</th>
                    <th className={`${th} text-right`}>Pending</th>
                    <th className={`${th} text-right`}>Cleared</th>
                    <th className={`${th} text-right`}>Bounced</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summary.byEntity.map((e) => (
                    <tr key={`${e.type}-${e.name}`} className="hover:bg-white/3 transition-colors">
                      <td className={td}>
                        <p className="font-medium text-white">{e.name}</p>
                        <p className="text-xs text-slate-500">{e.type}</p>
                      </td>
                      <td className={`${td} text-right text-slate-300`}>{e.count}</td>
                      <td className={`${td} whitespace-nowrap text-right text-amber-400`}>{formatAmount(e.pending)}</td>
                      <td className={`${td} whitespace-nowrap text-right text-emerald-400`}>{formatAmount(e.cleared)}</td>
                      <td className={`${td} whitespace-nowrap text-right text-rose-400`}>{formatAmount(e.bounced)}</td>
                      <td className={`${td} whitespace-nowrap text-right font-semibold text-white`}>{formatAmount(e.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const filters = parseFilters(await searchParams);
  const thisMonth = currentMonthKey();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Reports</h1>
        <p className="mt-1 text-slate-400">
          Choose a month and filters, preview the summary, then download it as Excel or PDF.
        </p>
      </div>

      <div className="glass-card mb-6 flex flex-wrap items-end justify-between gap-4 p-4">
        <FilterBar
          currentType={filters.type}
          currentStatus={filters.status}
          currentMonth={filters.month}
          months={recentMonths(24)}
        />
        {filters.month !== thisMonth && (
          <Link
            href={`/reports?${filtersToQuery({ ...filters, month: thisMonth })}`}
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            This month
          </Link>
        )}
      </div>

      <Suspense
        key={JSON.stringify(filters)}
        fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-800/60" />}
      >
        <ReportPreview filters={filters} />
      </Suspense>
    </div>
  );
}
