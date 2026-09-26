import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTransactions } from '@/lib/queries';
import { buildFilterLabel, parseFilters } from '@/lib/filters';
import { recentMonths } from '@/lib/dates';
import { formatAmount } from '@/lib/format';
import TransactionTable from '@/components/TransactionTable';
import FilterBar from '@/components/FilterBar';
import ExportButtons from '@/components/ExportButtons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cheque Ledger',
  description: 'View, filter, and manage all cheque transactions.',
};

type Filters = ReturnType<typeof parseFilters>;

async function LedgerContent({ filters }: { filters: Filters }) {
  const transactions = await getTransactions({
    type: filters.type,
    status: filters.status,
    month: filters.month || undefined,
  });

  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <>
      {/* Summary bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">
            <span className="font-semibold text-white">{transactions.length}</span> results
          </span>
          {transactions.length > 0 && (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">
              Total: <span className="font-semibold text-white">{formatAmount(total)}</span>
            </span>
          )}
          <span className="text-xs text-slate-500">{buildFilterLabel(filters)}</span>
        </div>
        <ExportButtons filters={filters} disabled={transactions.length === 0} />
      </div>

      <TransactionTable transactions={transactions} />
    </>
  );
}

function LedgerSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-10 w-48 rounded-lg bg-slate-800/60" />
      <div className="h-96 rounded-2xl bg-slate-800/60" />
    </div>
  );
}

export default async function LedgerPage({ searchParams }: PageProps<'/ledger'>) {
  const filters = parseFilters(await searchParams);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Cheque Ledger</h1>
        <p className="mt-1 text-slate-400">
          Full transaction history — filter by type, status, or month.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="glass-card mb-6 p-4">
        <FilterBar
          currentType={filters.type}
          currentStatus={filters.status}
          currentMonth={filters.month}
          months={recentMonths(24)}
        />
      </div>

      {/* Table + Export */}
      <Suspense key={JSON.stringify(filters)} fallback={<LedgerSkeleton />}>
        <LedgerContent filters={filters} />
      </Suspense>
    </div>
  );
}
