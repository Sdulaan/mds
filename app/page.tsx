import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown, CheckCircle, AlertCircle } from 'lucide-react';
import { getMetrics, getRecentTransactions } from '@/actions/transactionActions';

export const dynamic = 'force-dynamic';
import KPICard from '@/components/KPICard';
import StatusBadge from '@/components/StatusBadge';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'MDS Pharmacy cheque management dashboard — key metrics and recent activity.',
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function DashboardContent() {
  const [metrics, recent] = await Promise.all([
    getMetrics(),
    getRecentTransactions(5),
  ]);

  const now = new Date();
  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const kpis = [
    {
      title: 'Pending Credits',
      value: formatAmount(metrics.pendingCredits),
      subtitle: 'Awaiting bank clearance',
      icon: <TrendingUp className="h-6 w-6 text-white" />,
      gradient: 'bg-gradient-to-br from-sky-500 to-blue-600',
      glowColor: 'sky-500',
    },
    {
      title: 'Pending Debits',
      value: formatAmount(metrics.pendingDebits),
      subtitle: 'Outstanding payments',
      icon: <TrendingDown className="h-6 w-6 text-white" />,
      gradient: 'bg-gradient-to-br from-orange-500 to-red-600',
      glowColor: 'orange-500',
    },
    {
      title: 'Cleared This Month',
      value: formatAmount(metrics.clearedThisMonth),
      subtitle: monthLabel,
      icon: <CheckCircle className="h-6 w-6 text-white" />,
      gradient: 'bg-gradient-to-br from-emerald-500 to-green-600',
      glowColor: 'emerald-500',
    },
    {
      title: 'Total Outstanding',
      value: formatAmount(metrics.totalOutstanding),
      subtitle: 'All pending cheques',
      icon: <AlertCircle className="h-6 w-6 text-white" />,
      gradient: 'bg-gradient-to-br from-violet-500 to-purple-600',
      glowColor: 'violet-500',
    },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.title} {...kpi} />
        ))}
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <Link
            href="/ledger"
            className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
            <p className="text-slate-400">No transactions yet.</p>
            <Link
              href="/add-cheque"
              className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              Add your first cheque
            </Link>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recent.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-slate-300">{formatDate(tx.cheque_date)}</td>
                      <td className="px-4 py-3 font-medium text-white">{tx.entity_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            tx.transaction_type === 'CREDIT'
                              ? 'bg-sky-400/10 text-sky-400'
                              : 'bg-orange-400/10 text-orange-400'
                          }`}
                        >
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {formatAmount(Number(tx.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={tx.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/add-cheque"
          className="glass-card group flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white group-hover:text-violet-300 transition-colors">Add New Cheque</p>
            <p className="text-sm text-slate-400">Record a credit or debit cheque</p>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 text-slate-600 group-hover:text-violet-400 transition-colors" />
        </Link>

        <Link
          href="/ledger"
          className="glass-card group flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white group-hover:text-violet-300 transition-colors">View Full Ledger</p>
            <p className="text-sm text-slate-400">Filter, search and export cheques</p>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 text-slate-600 group-hover:text-violet-400 transition-colors" />
        </Link>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-800/60" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-800/60" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Good{' '}
          {new Date().getHours() < 12
            ? 'morning'
            : new Date().getHours() < 17
            ? 'afternoon'
            : 'evening'}{' '}
          👋
        </h1>
        <p className="mt-1 text-slate-400">
          Here&apos;s your cheque management overview for{' '}
          <span className="text-violet-400 font-medium">
            {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </span>
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
