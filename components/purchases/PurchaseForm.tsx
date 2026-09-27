'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { savePurchase } from '@/actions/purchaseActions';
import Combobox from '@/components/Combobox';
import { useFormAction } from '@/components/useFormAction';
import { alertError, alertSuccess, btnPrimary, cn, input, label } from '@/lib/ui';
import type { Purchase } from '@/types';

interface PurchaseFormProps {
  purchase?: Purchase;
  creditors: { id: string; name: string }[];
  today: string;
  readOnly?: boolean;
}

export default function PurchaseForm({ purchase, creditors, today, readOnly = false }: PurchaseFormProps) {
  const router = useRouter();
  const [name, setName] = useState(purchase?.entity_name ?? '');
  const { state, pending, formRef, onSubmit } = useFormAction(async (prev, fd) => {
    const r = await savePurchase(prev, fd);
    if (r.success && purchase) router.refresh();
    if (r.success && !purchase) setName('');
    return r;
  });
  const match = creditors.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  const creditorOptions = useMemo(() => creditors.map((c) => ({ value: c.name })), [creditors]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {purchase && <input type="hidden" name="id" value={purchase.id} />}
      <input type="hidden" name="entity_id" value={match?.id ?? ''} />
      {state.message && (
        <div role="alert" className={cn(state.success ? alertSuccess : alertError, 'flex items-center gap-2.5')}>
          {state.success ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {state.message}
        </div>
      )}
      <fieldset disabled={readOnly} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="p-creditor" className={label}>Creditor *</label>
          <Combobox
            id="p-creditor"
            value={name}
            onChange={setName}
            options={creditorOptions}
            placeholder="Search creditors…"
            emptyText="No creditor matches this name"
            required
          />
          {name && !match && <p className="mt-1 text-xs text-pending">No creditor with this name.</p>}
        </div>
        <div>
          <label htmlFor="p-grn" className={label}>GRN Number *</label>
          <input id="p-grn" name="grn_number" required defaultValue={purchase?.grn_number ?? ''} className={input} />
        </div>
        <div>
          <label htmlFor="p-inv" className={label}>Invoice Number</label>
          <input id="p-inv" name="invoice_number" defaultValue={purchase?.invoice_number ?? ''} className={input} />
        </div>
        <div>
          <label htmlFor="p-date" className={label}>Purchase / GRN Date *</label>
          <input id="p-date" name="purchase_date" type="date" required defaultValue={purchase?.purchase_date ?? today} className={input} />
        </div>
        <div>
          <label htmlFor="p-amount" className={label}>Amount (LKR) *</label>
          <input id="p-amount" name="amount" type="number" min="0.01" step="0.01" required defaultValue={purchase ? Number(purchase.amount) : ''} placeholder="0.00" className={cn(input, 'tabular-nums')} />
        </div>
        <div>
          <label htmlFor="p-remarks" className={label}>Remarks</label>
          <input id="p-remarks" name="remarks" defaultValue={purchase?.remarks ?? ''} className={input} />
        </div>
      </fieldset>
      {!readOnly && (
        <button type="submit" disabled={pending || !match} className={cn(btnPrimary, 'min-w-36')}>
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : purchase ? 'Save Changes' : 'Add Purchase'}
        </button>
      )}
    </form>
  );
}
