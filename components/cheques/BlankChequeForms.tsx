'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { generateChequeNumbers, issueBlankCheque } from '@/actions/chequeNumberActions';
import Combobox from '@/components/Combobox';
import MultiSelect from '@/components/MultiSelect';
import { useFormAction } from '@/components/useFormAction';
import { alertError, alertSuccess, btnPrimary, card, cn, input, label } from '@/lib/ui';
import type { ActionResult } from '@/types';

function Message({ state }: { state: ActionResult }) {
  if (!state.message) return null;
  return (
    <div role="alert" className={cn(state.success ? alertSuccess : alertError, 'flex items-start gap-2.5')}>
      {state.success ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{state.message}</span>
    </div>
  );
}

interface RecordProps {
  creditors: { id: string; name: string; is_active: boolean }[];
  /** Registered numbers still free (not on a creditor cheque and not already given to a creditor). */
  freeNumbers: string[];
  banks: string[];
}

/** Record a blank cheque handed to a creditor: creditor + cheque number. */
export function RecordBlankCheque({ creditors, freeNumbers, banks }: RecordProps) {
  const router = useRouter();
  const [creditor, setCreditor] = useState('');
  const [numbers, setNumbers] = useState<string[]>([]);
  const [bank, setBank] = useState('');
  const { state, pending, formRef, onSubmit } = useFormAction(async (prev, fd) => {
    const result = await issueBlankCheque(prev, fd);
    if (result.success) {
      setCreditor('');
      setNumbers([]);
      setBank('');
      router.refresh();
    }
    return result;
  });
  const match = creditors.find((c) => c.name.toLowerCase() === creditor.trim().toLowerCase());
  const creditorOptions = useMemo(() => creditors.map((c) => ({ value: c.name, hint: c.is_active ? undefined : 'Inactive' })), [creditors]);
  const numberOptions = useMemo(() => freeNumbers.map((n) => ({ value: n, label: n })), [freeNumbers]);
  const bankOptions = useMemo(() => banks.map((b) => ({ value: b })), [banks]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className={`${card} space-y-4 p-5`}>
      <div>
        <h2 className="text-base font-semibold text-fg">Record a blank cheque</h2>
        <p className="mt-0.5 text-xs text-muted">A signed cheque given to a creditor before its date and amount are known.</p>
      </div>
      <Message state={state} />
      <input type="hidden" name="entity_id" value={match?.id ?? ''} />
      <div>
        <label htmlFor="blank_creditor" className={label}>Creditor *</label>
        <Combobox id="blank_creditor" value={creditor} onChange={setCreditor} options={creditorOptions} placeholder="Search creditors…" emptyText="No creditor matches this name" required />
      </div>
      <div>
        <label htmlFor="blank_number" className={label}>Cheque Number(s) *</label>
        <MultiSelect
          id="blank_number" name="cheque_number" selected={numbers} onChange={setNumbers} options={numberOptions}
          allLabel="Select one or more cheque numbers" noun="cheques selected" allowCustom searchPlaceholder="Search or type a cheque number…"
        />
        {numbers.length > 0 && (
          <p className="mt-1.5 text-xs text-muted">
            {numbers.length} cheque{numbers.length === 1 ? '' : 's'} will be recorded for this creditor
            {numbers.length <= 6 ? `: ${numbers.join(', ')}` : ''}.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="blank_bank" className={label}>Bank Name</label>
        <Combobox id="blank_bank" name="bank_name" value={bank} onChange={setBank} options={bankOptions} placeholder="Optional" emptyText="New bank — it will be saved as typed" />
      </div>
      <button type="submit" disabled={pending || !match || numbers.length === 0} className={cn(btnPrimary, 'w-full')}>
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Record Blank Cheque'}
      </button>
    </form>
  );
}

/** Bulk-generate cheque numbers from a start/end range or a total count. */
export function GenerateNumbers({ banks }: { banks: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<'end' | 'count'>('end');
  const [bank, setBank] = useState('');
  const { state, pending, formRef, onSubmit } = useFormAction(async (prev, fd) => {
    const result = await generateChequeNumbers(prev, fd);
    if (result.success) {
      setBank('');
      router.refresh();
    }
    return result;
  });
  const bankOptions = useMemo(() => banks.map((b) => ({ value: b })), [banks]);
  const digits = (e: React.ChangeEvent<HTMLInputElement>) => { e.target.value = e.target.value.replace(/\D/g, ''); };

  return (
    <form ref={formRef} onSubmit={onSubmit} className={`${card} space-y-4 p-5`}>
      <div>
        <h2 className="text-base font-semibold text-fg">Generate cheque numbers</h2>
        <p className="mt-0.5 text-xs text-muted">
          Register a whole cheque book at once, in ascending order, keeping the leading zeros. They become selectable when adding a creditor cheque.
        </p>
      </div>
      <Message state={state} />
      <input type="hidden" name="mode" value={mode} />
      <div>
        <label htmlFor="gen_start" className={label}>Starting cheque number *</label>
        <input id="gen_start" name="start" required inputMode="numeric" placeholder="e.g. 005830" onChange={digits} maxLength={18} className={cn(input, 'tabular-nums')} />
      </div>
      <div className="inline-flex rounded-lg bg-surface-2 p-1 text-sm">
        {([['end', 'Ending number'], ['count', 'Total cheques received']] as const).map(([value, text]) => (
          <button
            key={value} type="button" onClick={() => setMode(value)} aria-pressed={mode === value}
            className={cn('rounded-md px-3 py-1.5 font-medium transition-colors', mode === value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg')}
          >
            {text}
          </button>
        ))}
      </div>
      {mode === 'end' ? (
        <div>
          <label htmlFor="gen_end" className={label}>Ending cheque number *</label>
          <input key="end" id="gen_end" name="end" required inputMode="numeric" placeholder="e.g. 005880" onChange={digits} maxLength={18} className={cn(input, 'tabular-nums')} />
        </div>
      ) : (
        <div>
          <label htmlFor="gen_count" className={label}>Total number of cheques received *</label>
          <input key="count" id="gen_count" name="count" required inputMode="numeric" placeholder="e.g. 100 (several books at once)" onChange={digits} maxLength={5} className={cn(input, 'tabular-nums')} />
        </div>
      )}
      <div>
        <label htmlFor="gen_bank" className={label}>Bank Name</label>
        <Combobox id="gen_bank" name="bank_name" value={bank} onChange={setBank} options={bankOptions} placeholder="Optional" emptyText="New bank — it will be saved as typed" />
      </div>
      <button type="submit" disabled={pending} className={cn(btnPrimary, 'w-full')}>
        {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : 'Generate Numbers'}
      </button>
    </form>
  );
}
