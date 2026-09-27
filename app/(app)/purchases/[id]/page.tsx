import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { deletePurchase } from '@/actions/purchaseActions';
import { canDelete, canEdit, requireUser } from '@/lib/auth';
import { getEntityOptions } from '@/lib/data/entities';
import { getGrnPayments } from '@/lib/data/grns';
import { getPurchase } from '@/lib/data/purchases';
import { formatDate, todayKey } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { isUuid } from '@/lib/filters';
import { btnSecondary, card, cn } from '@/lib/ui';
import ConfirmButton from '@/components/ConfirmButton';
import PageHeader from '@/components/PageHeader';
import RecordHistory from '@/components/RecordHistory';
import StatusBadge from '@/components/StatusBadge';
import GrnBalance from '@/components/purchases/GrnBalance';
import type { ChequeStatus } from '@/types';
import PurchaseForm from '@/components/purchases/PurchaseForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Purchase' };

export default async function PurchasePage({ params }: PageProps<'/purchases/[id]'>) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  const purchase = await getPurchase(id);
  if (!purchase) notFound();
  const [creditors, payments] = await Promise.all([getEntityOptions('VENDOR', purchase.entity_id), getGrnPayments(purchase.id)]);
  const editable = canEdit(user, purchase.created_by);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/purchases" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> Purchases
      </Link>
      <PageHeader
        title={`Purchase ${purchase.grn_number ? `GRN ${purchase.grn_number}` : ''}`}
        description={purchase.entity_name}
        actions={canDelete(user) && (
          <ConfirmButton action={deletePurchase.bind(null, purchase.id)} confirm="Delete this purchase? This cannot be undone." redirectTo="/purchases" className={cn(btnSecondary, 'text-bounced')}>
            <Trash2 className="h-4 w-4" /> Delete
          </ConfirmButton>
        )}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className={`${card} p-6`}>
            <PurchaseForm purchase={purchase} creditors={creditors} today={todayKey()} readOnly={!editable} />
          </div>
          <section className={`${card} p-5`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-fg">Cheques paying this GRN</h2>
              <p className="text-sm text-muted">
                Balance (LKR): <GrnBalance amount={Number(purchase.amount)} paid={purchase.paid} />
              </p>
            </div>
            {payments.length === 0 ? (
              <p className="text-sm text-subtle">No cheques yet. Select this GRN when adding a creditor cheque.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 font-semibold">Cheque No.</th>
                    <th className="py-2 font-semibold">Cheque Date</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 text-right font-semibold">Paid on this GRN (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.map((c) => (
                    <tr key={c.transaction_id} className={c.status === 'CANCELLED' ? 'opacity-60' : undefined}>
                      <td className="py-2"><Link href={`/cheques/${c.transaction_id}`} className="font-mono text-fg hover:text-brand">{c.cheque_number}</Link></td>
                      <td className="py-2 text-muted">{formatDate(c.cheque_date)}</td>
                      <td className="py-2"><StatusBadge status={c.status as ChequeStatus} /></td>
                      <td className={`py-2 text-right tabular-nums ${c.status === 'CANCELLED' ? 'text-subtle line-through' : 'text-fg'}`}>{formatNumber(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
        <RecordHistory table="purchases" record={purchase} />
      </div>
    </div>
  );
}
