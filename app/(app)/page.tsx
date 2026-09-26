import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Ban, CheckCircle2, Clock, Hand, Landmark, Plus, RotateCcw, Wallet } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getDashboard, type MonthPoint } from '@/lib/data/dashboard';
import { currentHour, currentMonthKey, monthLabel } from '@/lib/dates';
import { formatAmount } from '@/lib/format';
import { btnPrimary, btnSecondary, card } from '@/lib/ui';
import ChartCard from '@/components/charts/ChartCard';
import RankedBars from '@/components/charts/RankedBars';
import KPICard from '@/components/KPICard';
import PageHeader from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Cheque management dashboard — key metrics and trends.',
};

const toColumns = (points: MonthPoint[]) =>
  points.map((p) => ({
    key: p.month,
    label: monthLabel(p.month, 'short').split(' ')[0],
    title: monthLabel(p.month),
    value: p.amount,
    count: p.count,
  }));

const n = (count: number, word = 'cheque') => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

function SectionHeading({ title, href, linkText }: { title: string; href: string; linkText: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-fg">{title}</h2>
      <Link href={href} className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover">
        {linkText} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

async function DashboardContent() {
  const { receivables: r, payables: p } = await getDashboard();
  const thisMonth = monthLabel(currentMonthKey());
  const receivedThisMonth = r.receivedByMonth[r.receivedByMonth.length - 1];

  return (
    <div className="space-y-10">
      {/* ── Receivables (SRS 1 §5) ─────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Customer cheques (receivables)" href="/receivables" linkText="Open register" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Received this month"
            value={formatAmount(receivedThisMonth.amount)}
            subtitle={`${n(receivedThisMonth.count)} dated ${thisMonth}`}
            icon={<Landmark className="h-5 w-5" />}
            tone="credit"
          />
          <KPICard
            title="Cheques in hand"
            value={formatAmount(r.inHand.amount)}
            subtitle={`${n(r.inHand.count)} not yet deposited`}
            icon={<Hand className="h-5 w-5" />}
            tone="pending"
          />
          <KPICard
            title="Credited this month"
            value={formatAmount(r.creditedThisMonth.amount)}
            subtitle={`${n(r.creditedThisMonth.count)} · ${formatAmount(r.deposited.amount)} awaiting credit`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="cleared"
          />
          <KPICard
            title="Returned this month"
            value={formatAmount(r.returnedThisMonth.amount)}
            subtitle={n(r.returnedThisMonth.count)}
            icon={<RotateCcw className="h-5 w-5" />}
            tone="bounced"
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Cheques received per month"
            subtitle="Total value by cheque date — hover a column for the count"
            data={toColumns(r.receivedByMonth)}
            barClass="bg-credit"
          />
          <ChartCard
            title="Credited cheques per month"
            subtitle="Value credited to the bank each month"
            data={toColumns(r.creditedByMonth)}
            barClass="bg-cleared"
            countLabel="credited"
          />
        </div>
      </section>

      {/* ── Payables (SRS 2 §6) ────────────────────────────────────────────── */}
      <section>
        <SectionHeading title="Creditor cheques (payables)" href="/payables" linkText="Open register" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Outstanding cheques"
            value={formatAmount(p.outstanding.amount)}
            subtitle={`${n(p.outstanding.count)} not yet cleared`}
            icon={<Clock className="h-5 w-5" />}
            tone="debit"
          />
          <KPICard
            title="Cleared cheques"
            value={formatAmount(p.cleared.amount)}
            subtitle={`${n(p.cleared.count)} · ${formatAmount(p.clearedThisMonth.amount)} this month`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="cleared"
          />
          <KPICard
            title="Cancelled cheques"
            value={formatAmount(p.cancelled.amount)}
            subtitle={n(p.cancelled.count)}
            icon={<Ban className="h-5 w-5" />}
            tone="neutral"
          />
          <KPICard
            title="Creditors outstanding"
            value={formatAmount(p.creditorsOutstanding)}
            subtitle="Opening balances + purchases − payments"
            icon={<Wallet className="h-5 w-5" />}
            tone="brand"
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Monthly outstanding cheque trend"
            subtitle="Uncleared cheques at each month end"
            data={toColumns(p.outstandingTrend)}
            barClass="bg-debit"
            countLabel="outstanding"
          />
          <ChartCard
            title="Monthly cleared cheque trend"
            subtitle="Value cleared by the bank each month"
            data={toColumns(p.clearedByMonth)}
            barClass="bg-cleared"
            countLabel="cleared"
          />
        </div>
        <section className={`${card} mt-4 p-5`}>
          <h3 className="text-base font-semibold text-fg">Creditor-wise outstanding amount</h3>
          <p className="mb-4 text-xs text-muted">Top 10 creditors by uncleared cheque value · amount · number of cheques</p>
          <RankedBars data={p.topCreditors} barClass="bg-debit" />
        </section>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-surface-2" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-xl bg-surface-2" />
        <div className="h-72 rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const hour = currentHour();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div>
      <PageHeader
        title={`Good ${greeting}${user.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}`}
        description={
          <>
            Cheque overview for <span className="font-medium text-brand">{monthLabel(currentMonthKey())}</span>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/cheques/new?type=CREDIT" className={btnPrimary}>
              <Plus className="h-4 w-4" /> Customer cheque
            </Link>
            <Link href="/cheques/new?type=DEBIT" className={btnSecondary}>
              <Plus className="h-4 w-4" /> Creditor cheque
            </Link>
          </div>
        }
      />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
