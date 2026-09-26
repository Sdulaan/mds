import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { getBankNames } from '@/lib/data/cheques';
import { getEntityOptions } from '@/lib/data/entities';
import { recentMonths } from '@/lib/dates';
import { getReport } from '@/lib/reports/definitions';
import { paramsToQuery, parseReportParams } from '@/lib/reports/params';
import type { ReportDefinition, ReportParams } from '@/lib/reports/types';
import { card } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import ReportActions from '@/components/ReportActions';
import ReportParamsForm from '@/components/reports/ReportParamsForm';
import ReportView from '@/components/reports/ReportView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/reports/[slug]'>): Promise<Metadata> {
  return { title: getReport((await params).slug)?.title ?? 'Report' };
}

async function ReportContent({ def, params, raw }: { def: ReportDefinition; params: ReportParams; raw: URLSearchParams }) {
  const report = await def.build(params, raw);
  const empty = report.sections.every((s) => s.rows.every((r) => r.kind === 'total'));
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-medium text-fg">{report.title}</span> · {report.subtitle}
        </p>
        <ReportActions slug={def.slug} query={paramsToQuery(params)} disabled={empty} />
      </div>
      <ReportView report={report} />
    </>
  );
}

export default async function ReportPage({ params, searchParams }: PageProps<'/reports/[slug]'>) {
  await requireUser();
  const { slug } = await params;
  const def = getReport(slug);
  if (!def) notFound();
  if (def.group === 'Registers') redirect(slug === 'customer-cheques' ? '/receivables' : '/payables');

  const sp = await searchParams;
  const raw = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : [])));
  const reportParams = parseReportParams(def, raw);
  const [entities, banks] = await Promise.all([
    def.entityType ? getEntityOptions(def.entityType) : Promise.resolve([]),
    def.params.includes('bank') ? getBankNames(def.group === 'Receivables' ? 'CREDIT' : 'DEBIT') : Promise.resolve([]),
  ]);

  return (
    <div>
      <Link href="/reports" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> Reports
      </Link>
      <PageHeader title={def.title} description={def.description} />
      <div className={`${card} mb-5 p-4`}>
        <ReportParamsForm def={def} params={reportParams} entities={entities} banks={banks} months={recentMonths(36)} />
      </div>
      <Suspense key={JSON.stringify(reportParams)} fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" />}>
        <ReportContent def={def} params={reportParams} raw={raw} />
      </Suspense>
    </div>
  );
}
