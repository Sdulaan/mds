import { Suspense } from 'react';
import { getTransactions } from '@/actions/transactionActions';
import TransactionTable from '@/components/TransactionTable';
import FilterBar from '@/components/FilterBar';
import ExportPDFButton from '@/components/ExportPDFButton';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
import type { TransactionType, TransactionStatus } from '@/types';

export const metadata: Metadata = {
  title: 'Cheque Ledger',
  description: 'View, filter, and manage all cheque transactions.',
};

interface PageProps {
  searchParams: Promise<{
    type?: string;
    status?: string;
    month?: string;
  }>;
}

function buildFilterLabel(type: string, status: string, month: string): string {
  const parts: string[] = [];
  if (type !== 'ALL') parts.push(type === 'CREDIT' ? 'Credits' : 'Debits');
  if (status !== 'ALL') parts.push(status.charAt(0) + status.slice(1).toLowerCase());
  if (month) {
    const [year, m] = month.split('-');
    const label = new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
    parts.push(label);
  }
  return parts.length > 0 ? parts.join(' · ') : 'All Transactions';
}

async function LedgerContent({
  type,
  status,
  month,
}: {
  type: string;
  status: string;
  month: string;
}) {
  const transactions = await getTransactions({
    type: type !== 'ALL' ? (type as TransactionType) : 'ALL',
    status: status !== 'ALL' ? (status as TransactionStatus) : 'ALL',
    month: month || undefined,
  });

  const filterLabel = buildFilterLabel(type, status, month);
  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <>
      {/* Summary bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">
            <span className="font-semibold text-white">{transactions.length}</span> results
          </span>
          {transactions.length > 0 && (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">
              Total:{' '}
              <span className="font-semibold text-white">
                {new Intl.NumberFormat('en-LK', {
                  style: 'currency',
                  currency: 'LKR',
                }).format(total)}
              </span>
            </span>
          )}
        </div>
        <ExportPDFButton transactions={transactions} filterLabel={filterLabel} />
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

export default async function LedgerPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const type = params.type ?? 'ALL';
  const status = params.status ?? 'ALL';
  const month = params.month ?? '';

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
        <Suspense>
          <FilterBar currentType={type} currentStatus={status} currentMonth={month} />
        </Suspense>
      </div>

      {/* Table + Export */}
      <Suspense fallback={<LedgerSkeleton />}>
        <LedgerContent type={type} status={status} month={month} />
      </Suspense>
    </div>
  );
}
