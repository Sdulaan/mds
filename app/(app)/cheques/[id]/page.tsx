import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { deleteCheque } from '@/actions/chequeActions';
import { canDelete, canEdit, isAdmin, requireUser } from '@/lib/auth';
import { getBankNames, getCheque } from '@/lib/data/cheques';
import { getEntityOptions } from '@/lib/data/entities';
import { todayKey } from '@/lib/dates';
import { isUuid } from '@/lib/filters';
import { btnSecondary, card, cn } from '@/lib/ui';
import ConfirmButton from '@/components/ConfirmButton';
import PageHeader from '@/components/PageHeader';
import RecordHistory from '@/components/RecordHistory';
import StatusBadge from '@/components/StatusBadge';
import ChequeForm from '@/components/cheques/ChequeForm';
import { ENTITY_TYPE_FOR } from '@/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cheque' };

export default async function ChequePage({ params }: PageProps<'/cheques/[id]'>) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  const cheque = await getCheque(id);
  if (!cheque) notFound();

  const type = cheque.transaction_type;
  const [entities, banks] = await Promise.all([getEntityOptions(ENTITY_TYPE_FOR[type], cheque.entity_id), getBankNames(type)]);
  const editable = canEdit(user, cheque.created_by);
  const back = type === 'CREDIT' ? '/receivables' : '/payables';

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> {type === 'CREDIT' ? 'Customer cheques' : 'Creditor cheques'}
      </Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Cheque {cheque.cheque_number} <StatusBadge status={cheque.status} size="md" /></span>}
        description={`${cheque.entity_name} · ${type === 'CREDIT' ? 'received from customer' : 'issued to creditor'}`}
        actions={
          canDelete(user) && (
            <ConfirmButton
              action={deleteCheque.bind(null, cheque.id)}
              confirm={`Delete cheque ${cheque.cheque_number} (${cheque.entity_name})? This cannot be undone.`}
              redirectTo={back}
              className={cn(btnSecondary, 'text-bounced hover:border-bounced/40')}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </ConfirmButton>
          )
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className={`${card} p-6 sm:p-8`}>
          {!editable && (
            <p className="mb-5 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
              View only — standard users can edit only the cheques they entered.
            </p>
          )}
          <ChequeForm type={type} cheque={cheque} entities={entities} banks={banks} today={todayKey()} isAdmin={isAdmin(user)} readOnly={!editable} />
        </div>
        <RecordHistory table="transactions" record={cheque} />
      </div>
    </div>
  );
}
