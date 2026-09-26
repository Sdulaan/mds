import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { deletePurchase } from '@/actions/purchaseActions';
import { canDelete, canEdit, requireUser } from '@/lib/auth';
import { getEntityOptions } from '@/lib/data/entities';
import { getPurchase } from '@/lib/data/purchases';
import { todayKey } from '@/lib/dates';
import { isUuid } from '@/lib/filters';
import { btnSecondary, card, cn } from '@/lib/ui';
import ConfirmButton from '@/components/ConfirmButton';
import PageHeader from '@/components/PageHeader';
import RecordHistory from '@/components/RecordHistory';
import PurchaseForm from '@/components/purchases/PurchaseForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Purchase' };

export default async function PurchasePage({ params }: PageProps<'/purchases/[id]'>) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  const purchase = await getPurchase(id);
  if (!purchase) notFound();
  const creditors = await getEntityOptions('VENDOR', purchase.entity_id);
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
        <div className={`${card} p-6`}>
          <PurchaseForm purchase={purchase} creditors={creditors} today={todayKey()} readOnly={!editable} />
        </div>
        <RecordHistory table="purchases" record={purchase} />
      </div>
    </div>
  );
}
