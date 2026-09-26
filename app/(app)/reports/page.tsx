import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowDownLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { REPORTS } from '@/lib/reports/definitions';
import { card } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';

export const metadata: Metadata = { title: 'Reports' };

const GROUPS = [
  { group: 'Receivables', title: 'Customer cheques (receivables)', icon: ArrowDownLeft, tone: 'bg-credit-soft text-credit' },
  { group: 'Payables', title: 'Creditor cheques & payables', icon: ArrowUpRight, tone: 'bg-debit-soft text-debit' },
] as const;

export default async function ReportsPage() {
  await requireUser();
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Every report can be previewed on screen, exported to PDF or Excel, and printed."
      />
      <div className="space-y-8">
        {GROUPS.map(({ group, title, icon: Icon, tone }) => (
          <section key={group}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg">
              <span className={`flex h-7 w-7 items-center justify-center rounded-md ${tone}`}><Icon className="h-4 w-4" /></span>
              {title}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {REPORTS.filter((r) => r.group === group).map((r) => (
                <Link key={r.slug} href={`/reports/${r.slug}`} className={`${card} group flex items-start gap-3 p-4 transition-colors hover:border-brand/40`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-fg group-hover:text-brand">{r.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{r.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-subtle group-hover:text-brand" />
                </Link>
              ))}
            </div>
          </section>
        ))}
        <p className="text-sm text-muted">
          The customer and creditor cheque registers can also be exported with their current search and filters from the{' '}
          <Link href="/receivables" className="text-brand hover:underline">Customer Cheques</Link> and{' '}
          <Link href="/payables" className="text-brand hover:underline">Creditor Cheques</Link> pages.
        </p>
      </div>
    </div>
  );
}
