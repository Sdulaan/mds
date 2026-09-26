'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { saveEntity } from '@/actions/entityActions';
import { useFormAction } from '@/components/useFormAction';
import { alertError, alertSuccess, btnPrimary, cn, input, label } from '@/lib/ui';
import { ENTITY_LABEL, type Entity, type EntityType } from '@/types';

interface EntityFormProps {
  type: EntityType;
  entity?: Entity;
  readOnly?: boolean;
}

export default function EntityForm({ type, entity, readOnly = false }: EntityFormProps) {
  const router = useRouter();
  const basePath = type === 'CUSTOMER' ? '/customers' : '/creditors';
  const { state, pending, formRef, onSubmit } = useFormAction(async (prev, fd) => {
    const result = await saveEntity(prev, fd);
    if (result.success) {
      if (entity) router.refresh();
      else if (typeof result.data === 'string') router.push(`${basePath}/${result.data}`);
    }
    return result;
  });
  const one = ENTITY_LABEL[type].one;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      {entity && <input type="hidden" name="id" value={entity.id} />}
      <input type="hidden" name="type" value={type} />

      {state.message && (
        <div role="alert" className={cn(state.success ? alertSuccess : alertError, 'flex items-center gap-2.5')}>
          {state.success ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {state.message}
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-5">
        <div>
          <label htmlFor="name" className={label}>{type === 'CUSTOMER' ? 'Company / customer name' : 'Creditor name'} *</label>
          <input id="name" name="name" required defaultValue={entity?.name ?? ''} className={input} />
        </div>
        <div>
          <label htmlFor="address" className={label}>Address</label>
          <textarea id="address" name="address" rows={2} defaultValue={entity?.address ?? ''} className={cn(input, 'resize-y')} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contact_number" className={label}>Contact number</label>
            <input id="contact_number" name="contact_number" type="tel" defaultValue={entity?.contact_number ?? ''} className={input} />
          </div>
          <div>
            <label htmlFor="email" className={label}>Email address</label>
            <input id="email" name="email" type="email" defaultValue={entity?.email ?? ''} className={input} />
          </div>
          {type === 'CUSTOMER' ? (
            <div>
              <label htmlFor="credit_terms" className={label}>Credit terms</label>
              <input id="credit_terms" name="credit_terms" defaultValue={entity?.credit_terms ?? ''} placeholder="e.g. 30 days" className={input} />
            </div>
          ) : (
            <div>
              <label htmlFor="opening_balance" className={label}>Opening balance (LKR)</label>
              <input
                id="opening_balance" name="opening_balance" type="number" step="0.01" min="0"
                defaultValue={entity ? Number(entity.opening_balance) || '' : ''}
                placeholder="0.00"
                className={cn(input, 'tabular-nums')}
              />
              <p className="mt-1 text-xs text-subtle">Amount owed before the first purchase recorded here. Used by the payables report.</p>
            </div>
          )}
        </div>
        <div>
          <label htmlFor="remarks" className={label}>Remarks</label>
          <textarea id="remarks" name="remarks" rows={2} defaultValue={entity?.remarks ?? ''} className={cn(input, 'resize-y')} />
        </div>
      </fieldset>

      {!readOnly && (
        <button type="submit" disabled={pending} className={cn(btnPrimary, 'min-w-40')}>
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : entity ? 'Save Changes' : `Add ${one}`}
        </button>
      )}
    </form>
  );
}
