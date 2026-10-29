'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, AlertTriangle, Check, Loader2, Plus } from 'lucide-react';
import { saveCheque } from '@/actions/chequeActions';
import Combobox from '@/components/Combobox';
import GrnPicker from '@/components/cheques/GrnPicker';
import { useFormAction } from '@/components/useFormAction';
import { allocate, unpaidTotal, type GrnOption } from '@/lib/grn-allocation';
import { formatNumber } from '@/lib/format';
import { alertError, alertSuccess, btnPrimary, btnSecondary, cn, input, label } from '@/lib/ui';
import { ENTITY_LABEL, ENTITY_TYPE_FOR, type TransactionType, type TransactionWithEntity } from '@/types';
import DateInput from '@/components/DateInput';

interface ChequeFormProps {
  type: TransactionType;
  cheque?: TransactionWithEntity;
  entities: { id: string; name: string; is_active: boolean }[];
  banks: string[];
  today: string;
  isAdmin: boolean;
  readOnly?: boolean;
  /** Creditor cheques: GRNs that can be paid (all creditors), and those already on this cheque. */
  grnOptions?: GrnOption[];
  initialGrnIds?: string[];
}

export default function ChequeForm({
  type, cheque, entities, banks, today, isAdmin, readOnly = false, grnOptions = [], initialGrnIds = [],
}: ChequeFormProps) {
  const router = useRouter();
  const [entityName, setEntityName] = useState(cheque?.entity_name ?? '');
  const [bankName, setBankName] = useState(cheque?.bank_name ?? '');
  const [grnIds, setGrnIds] = useState<string[]>(initialGrnIds);
  const [amount, setAmount] = useState(cheque ? String(Number(cheque.amount)) : '');
  const { state, pending, formRef, onSubmit } = useFormAction(async (prev, fd) => {
    const result = await saveCheque(prev, fd);
    if (result.success && cheque) router.refresh();
    // After adding, start the next cheque with empty dropdowns (the form reset only clears plain inputs).
    if (result.success && !cheque) {
      setEntityName('');
      setBankName('');
      setGrnIds([]);
      setAmount('');
    }
    return result;
  });
  const entityLabel = ENTITY_LABEL[ENTITY_TYPE_FOR[type]].one;
  const match = entities.find((e) => e.name.toLowerCase() === entityName.trim().toLowerCase());
  const entityOptions = useMemo(() => entities.map((e) => ({ value: e.name, hint: e.is_active ? undefined : 'Inactive' })), [entities]);
  const newEntityHref = type === 'CREDIT' ? '/customers/new' : '/creditors/new';
  const bankOptions = useMemo(() => banks.map((b) => ({ value: b })), [banks]);
  const isEdit = !!cheque;

  // Creditor cheques pay the selected GRNs; picking GRNs fills in their unpaid total (still editable).
  const isDebit = type === 'DEBIT';
  const creditorGrns = useMemo(() => grnOptions.filter((g) => g.entity_id === match?.id), [grnOptions, match?.id]);
  const selectedGrns = creditorGrns.filter((g) => grnIds.includes(g.id));
  const onEntityChange = (name: string) => {
    setEntityName(name);
    const next = entities.find((e) => e.name.toLowerCase() === name.trim().toLowerCase());
    if (next?.id !== match?.id) setGrnIds([]);
  };
  const onGrnChange = (ids: string[]) => {
    setGrnIds(ids);
    const total = unpaidTotal(creditorGrns.filter((g) => ids.includes(g.id)));
    setAmount(total > 0 ? total.toFixed(2) : '');
  };
  const split = isDebit && selectedGrns.length ? allocate(Number(amount) || 0, selectedGrns) : null;

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
          <Combobox
            id="entity_name"
            value={entityName}
            onChange={onEntityChange}
            options={entityOptions}
            placeholder={`Search ${entityLabel.toLowerCase()}s…`}
            emptyText={`No ${entityLabel.toLowerCase()} matches this name`}
            footer={
              <Link href={newEntityHref} className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-brand hover:bg-surface-2">
                <Plus className="h-4 w-4" /> Add a new {entityLabel.toLowerCase()}
              </Link>
            }
            required
          />
          {entityName && !match && (
            <p className="mt-1.5 text-xs text-pending">
              No {entityLabel.toLowerCase()} with this name.{' '}
              <Link href={newEntityHref} className="font-medium underline">
                Add a new {entityLabel.toLowerCase()} →
              </Link>
            </p>
          )}
        </div>

        {isDebit && (
          <div>
            <label htmlFor="grn_ids" className={label}>GRN(s) *</label>
            <GrnPicker id="grn_ids" options={creditorGrns} selected={grnIds} onChange={onGrnChange} disabled={!match} />
            {match && creditorGrns.length === 0 && (
              <p className="mt-1.5 text-xs text-pending">
                {match.name} has no unpaid GRNs.{' '}
                <Link href="/purchases" className="font-medium underline">Add the GRN in Purchases →</Link>
              </p>
            )}
            {split && (
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                {split.allocations.map(({ grn, amount: paid }) => (
                  <li key={grn.id}>
                    GRN {grn.grn_number}: <span className="tabular-nums text-fg">{formatNumber(paid)}</span>
                    {paid < grn.remaining ? ` — part payment, ${formatNumber(grn.remaining - paid)} left unpaid` : ' — fully paid'}
                  </li>
                ))}
                {split.unused.map((grn) => (
                  <li key={grn.id} className="text-bounced">GRN {grn.grn_number}: not reached by this amount — remove it or increase the amount</li>
                ))}
                {split.unallocated > 0 && (
                  <li className="text-bounced">
                    {formatNumber(split.unallocated)} more than the unpaid total of the selected GRNs ({formatNumber(unpaidTotal(selectedGrns))})
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cheque_number" className={label}>Cheque Number *</label>
            <input
              id="cheque_number" name="cheque_number" required defaultValue={cheque?.cheque_number ?? ''} placeholder="e.g. 004521" className={input}
              {...(type === 'CREDIT' ? { inputMode: 'numeric' as const, pattern: '[0-9]{6}', maxLength: 6, title: 'Exactly 6 digits' } : {})}
            />
          </div>
          <div>
            <label htmlFor="cheque_date" className={label}>Cheque Date *</label>
            <DateInput id="cheque_date" name="cheque_date" required defaultValue={cheque?.cheque_date ?? ''} />
            {isEdit && <p className="mt-1 text-xs text-subtle">Change this to reschedule the cheque.</p>}
          </div>
          <div>
            <label htmlFor="amount" className={label}>Amount (LKR) *</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-subtle">Rs.</span>
              <input
                id="amount" name="amount" type="number" required min="0.01" step="0.01" placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(input, 'pl-11 tabular-nums')}
              />
            </div>
          </div>
          <div>
            <label htmlFor="bank_name" className={label}>Bank Name</label>
            <Combobox
              id="bank_name"
              name="bank_name"
              value={bankName}
              onChange={setBankName}
              options={bankOptions}
              placeholder="e.g. Commercial Bank"
              emptyText="New bank — it will be saved as typed"
            />
          </div>
          <div>
            <label htmlFor="entry_date" className={label}>Entry Date</label>
            <DateInput id="entry_date" name="entry_date" defaultValue={cheque?.entry_date ?? today} />
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

        {state.duplicate && (isAdmin || type === 'CREDIT') && (
          <label className="flex items-center gap-2 rounded-lg border border-pending/40 bg-pending-soft px-4 py-3 text-sm text-pending">
            <input type="checkbox" name="override_duplicate" className="h-4 w-4 accent-[var(--pending)]" />
            Save anyway{type === 'CREDIT' ? '' : ' (administrator override)'}
          </label>
        )}
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pending || !match || (isDebit && grnIds.length === 0)} className={cn(btnPrimary, 'min-w-40 py-3')}>
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
      <DateInput id={name} name={name} defaultValue={value ?? ''} />
    </div>
  );
}
