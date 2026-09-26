import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { canEdit, requireUser } from '@/lib/auth';
import { getBankNames, getChequePage } from '@/lib/data/cheques';
import { getEntityOptions } from '@/lib/data/entities';
import { recentMonths } from '@/lib/dates';
import { filtersToQuery, parseChequeFilters, pick } from '@/lib/filters';
import { formatAmount } from '@/lib/format';
import { btnPrimary, card } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import ReportActions from '@/components/ReportActions';
import ChequeFilterBar from '@/components/cheques/ChequeFilterBar';
import ChequeRegister from '@/components/cheques/ChequeRegister';
import { ENTITY_LABEL, ENTITY_TYPE_FOR, type ChequeFilters, type TransactionType } from '@/types';

const CONFIG: Record<TransactionType, { title: string; description: string; path: string; slug: string }> = {
  CREDIT: {
    title: 'Customer Cheques',
    description: 'Cheques received from customers — tick Deposited, then Credited (or Returned).',
    path: '/receivables',
    slug: 'customer-cheques',
  },
  DEBIT: {
    title: 'Creditor Cheques',
    description: 'Outstanding cheque register — cheques issued to creditors. Tick Cleared or Cancelled.',
    path: '/payables',
    slug: 'creditor-cheques',
  },
};

async function RegisterContent({ type, filters, page }: { type: TransactionType; filters: ChequeFilters; page: number }) {
  const user = await requireUser();
  const result = await getChequePage(filters, page);
  const cfg = CONFIG[type];
  const query = filtersToQuery(filters);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-muted">
            <span className="font-semibold text-fg">{result.total.toLocaleString()}</span> cheque{result.total === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-muted">
            Total <span className="font-semibold tabular-nums text-fg">{formatAmount(result.totalAmount)}</span>
          </span>
        </div>
        <ReportActions slug={cfg.slug} query={query} disabled={result.total === 0} />
      </div>
      <ChequeRegister
        type={type}
        rows={result.rows}
        editableIds={result.rows.filter((r) => canEdit(user, r.created_by)).map((r) => r.id)}
        entityLabel={ENTITY_LABEL[ENTITY_TYPE_FOR[type]].one}
      />
      <Pagination page={result.page} pageCount={result.pageCount} baseQuery={query} pathname={cfg.path} />
    </>
  );
}

export default async function RegisterPage({
  type,
  searchParams,
}: {
  type: TransactionType;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseChequeFilters(searchParams, type);
  const page = Math.max(1, parseInt(pick(searchParams, 'page') ?? '1', 10) || 1);
  const cfg = CONFIG[type];
  const entityType = ENTITY_TYPE_FOR[type];
  const [entities, banks] = await Promise.all([getEntityOptions(entityType), getBankNames(type)]);

  return (
    <div>
      <PageHeader
        title={cfg.title}
        description={cfg.description}
        actions={
          <Link href={`/cheques/new?type=${type}`} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add Cheque
          </Link>
        }
      />

      <div className={`${card} mb-5 p-4`}>
        <ChequeFilterBar
          type={type}
          filters={filters}
          entities={entities}
          banks={banks}
          months={recentMonths(24)}
          entityLabel={ENTITY_LABEL[entityType].one}
        />
      </div>

      <Suspense
        key={JSON.stringify({ filters, page })}
        fallback={<div className="h-96 animate-pulse rounded-xl bg-surface-2" />}
      >
        <RegisterContent type={type} filters={filters} page={page} />
      </Suspense>
    </div>
  );
}
