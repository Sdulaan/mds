import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { isAdmin, requireUser } from '@/lib/auth';
import { getBankNames } from '@/lib/data/cheques';
import { getEntityOptions } from '@/lib/data/entities';
import { getGrnOptions } from '@/lib/data/grns';
import { todayKey } from '@/lib/dates';
import { pick } from '@/lib/filters';
import { card } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import ChequeForm from '@/components/cheques/ChequeForm';
import { ENTITY_TYPE_FOR, type TransactionType } from '@/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add Cheque' };

export default async function NewChequePage({ searchParams }: PageProps<'/cheques/new'>) {
  const user = await requireUser();
  const type: TransactionType = pick(await searchParams, 'type') === 'DEBIT' ? 'DEBIT' : 'CREDIT';
  const [entities, banks, grnOptions] = await Promise.all([
    getEntityOptions(ENTITY_TYPE_FOR[type]),
    getBankNames(type),
    type === 'DEBIT' ? getGrnOptions() : Promise.resolve([]),
  ]);
  const back = type === 'CREDIT' ? '/receivables' : '/payables';
  const tab = (t: TransactionType, text: string) => (
    <Link
      href={`/cheques/new?type=${t}`}
      aria-current={type === t ? 'page' : undefined}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        type === t ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'
      }`}
    >
      {text}
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> {type === 'CREDIT' ? 'Customer cheques' : 'Creditor cheques'}
      </Link>
      <PageHeader
        title="Add Cheque"
        description={type === 'CREDIT' ? 'Record a cheque received from a customer. It starts as In Hand.' : 'Record a cheque issued to a creditor. It starts as Pending.'}
      />
      <div className="mb-4 inline-flex rounded-lg bg-surface-2 p-1">
        {tab('CREDIT', 'Customer cheque (received)')}
        {tab('DEBIT', 'Creditor cheque (issued)')}
      </div>
      <div className={`${card} p-6 sm:p-8`}>
        <ChequeForm key={type} type={type} entities={entities} banks={banks} today={todayKey()} isAdmin={isAdmin(user)} grnOptions={grnOptions} />
      </div>
    </div>
  );
}
