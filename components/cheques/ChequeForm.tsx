'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { saveCheque } from '@/actions/chequeActions';
import { useFormAction } from '@/components/useFormAction';
import { alertError, alertSuccess, btnPrimary, btnSecondary, cn, input, label } from '@/lib/ui';
import { ENTITY_LABEL, ENTITY_TYPE_FOR, type TransactionType, type TransactionWithEntity } from '@/types';

interface ChequeFormProps {
  type: TransactionType;
  cheque?: TransactionWithEntity;
  entities: { id: string; name: string; is_active: boolean }[];
  banks: string[];
  today: string;
  isAdmin: boolean;
  readOnly?: boolean;
}

export default function ChequeForm({ type, cheque, entities, banks, today, isAdmin, readOnly = false }: ChequeFormProps) {
  const router = useRouter();
  const { state, pending, formRef, onSubmit } = useFormAction(async (prev, fd) => {
    const result = await saveCheque(prev, fd);
    if (result.success && cheque) router.refresh();
    return result;
  });
  const entityLabel = ENTITY_LABEL[ENTITY_TYPE_FOR[type]].one;
  const [entityName, setEntityName] = useState(cheque?.entity_name ?? '');
  const match = entities.find((e) => e.name.toLowerCase() === entityName.trim().toLowerCase());
  const isEdit = !!cheque;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      {cheque && <input type="hidden" name="id" value={cheque.id} />}
      <input type="hidden" name="transaction_type" value={type} />
      <input type="hidden" name="entity_id" value={match?.id ?? ''} />

      {state.message && (
        <div role="alert" className={cn(state.success ? alertSuccess : alertError, 'flex items-start gap-2.5')}>
          {state.success ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : state.duplicate ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{state.message}</span>
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-6">
        {/* Entity */}
        <div>
          <label htmlFor="entity_name" className={label}>{entityLabel} *</label>
          <input
            id="entity_name"
            list="entity-options"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            placeholder={`Start typing a ${entityLabel.toLowerCase()} name…`}
            autoComplete="off"
            required
            className={input}
          />
          <datalist id="entity-options">
            {entities.map((e) => (
              <option key={e.id} value={e.name}>{e.is_active ? '' : 'Inactive'}</option>
            ))}
          </datalist>
          {entityName && !match && (
            <p className="mt-1.5 text-xs text-pending">
              No {entityLabel.toLowerCase()} with this name.{' '}
              <Link href={type === 'CREDIT' ? '/customers/new' : '/creditors/new'} className="font-medium underline">
                Add a new {entityLabel.toLowerCase()} →
              </Link>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {type === 'DEBIT' && (
            <div>
              <label htmlFor="grn_number" className={label}>GRN Number</label>
              <input id="grn_number" name="grn_number" defaultValue={cheque?.grn_number ?? ''} placeholder="e.g. 11492" className={input} />
            </div>
          )}
          <div>
            <label htmlFor="cheque_number" className={label}>Cheque Number *</label>
            <input id="cheque_number" name="cheque_number" required defaultValue={cheque?.cheque_number ?? ''} placeholder="e.g. 004521" className={input} />
          </div>
          <div>
            <label htmlFor="cheque_date" className={label}>Cheque Date *</label>
            <input id="cheque_date" name="cheque_date" type="date" required defaultValue={cheque?.cheque_date ?? ''} className={input} />
            {isEdit && <p className="mt-1 text-xs text-subtle">Change this to reschedule the cheque.</p>}
          </div>
          <div>
            <label htmlFor="amount" className={label}>Amount (LKR) *</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-subtle">Rs.</span>
              <input
                id="amount" name="amount" type="number" required min="0.01" step="0.01" placeholder="0.00"
                defaultValue={cheque ? Number(cheque.amount) : ''}
                className={cn(input, 'pl-11 tabular-nums')}
              />
            </div>
          </div>
          <div>
            <label htmlFor="bank_name" className={label}>Bank Name</label>
            <input id="bank_name" name="bank_name" list="bank-options" defaultValue={cheque?.bank_name ?? ''} placeholder="e.g. Commercial Bank" className={input} />
            <datalist id="bank-options">
              {banks.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="entry_date" className={label}>Entry Date</label>
            <input id="entry_date" name="entry_date" type="date" defaultValue={cheque?.entry_date ?? today} className={input} />
          </div>
        </div>

        <div>
          <label htmlFor="remarks" className={label}>Remarks</label>
          <textarea id="remarks" name="remarks" rows={2} defaultValue={cheque?.remarks ?? ''} placeholder="Any additional notes…" className={cn(input, 'resize-y')} />
        </div>

        {/* Status dates (edit only). Ticking the checkboxes in the register fills these automatically. */}
        {isEdit && (
          <fieldset className="rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-medium text-fg">Status dates</legend>
            <p className="mb-3 text-xs text-muted">
              Filled automatically when the status checkboxes are ticked. Adjust only to correct a date; clear a date to undo that step.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {type === 'CREDIT' ? (
                <>
                  <DateField name="deposited_date" label="Deposited" value={cheque.deposited_date} />
                  <DateField name="cleared_date" label="Credited" value={cheque.cleared_date} />
                  <DateField name="returned_date" label="Returned" value={cheque.returned_date} />
                </>
              ) : (
                <>
                  <DateField name="cleared_date" label="Cleared" value={cheque.cleared_date} />
                  <DateField name="cancelled_date" label="Cancelled" value={cheque.cancelled_date} />
                </>
              )}
            </div>
          </fieldset>
        )}

        {state.duplicate && isAdmin && (
          <label className="flex items-center gap-2 rounded-lg border border-pending/40 bg-pending-soft px-4 py-3 text-sm text-pending">
            <input type="checkbox" name="override_duplicate" className="h-4 w-4 accent-[var(--pending)]" />
            Save anyway (administrator override)
          </label>
        )}
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending || !match} className={cn(btnPrimary, 'min-w-40 py-3')}>
            {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : isEdit ? 'Save Changes' : 'Add Cheque'}
          </button>
          <Link href={type === 'CREDIT' ? '/receivables' : '/payables'} className={cn(btnSecondary, 'py-3')}>
            {isEdit ? 'Back to register' : 'Cancel'}
          </Link>
        </div>
      )}
    </form>
  );
}

function DateField({ name, label: text, value }: { name: string; label: string; value: string | null }) {
  return (
    <div>
      <label htmlFor={name} className={label}>{text}</label>
      <input id={name} name={name} type="date" defaultValue={value ?? ''} className={input} />
    </div>
  );
}
