'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, BookOpen, Check, Pencil, RotateCcw, X } from 'lucide-react';
import { cancelChequeNumber, restoreChequeNumber, updateChequeNumber } from '@/actions/chequeNumberActions';
import { btnSmall, card, cn, input } from '@/lib/ui';
import type { ActionResult } from '@/types';

export interface BookNumber {
  id: string;
  number: string;
  bank: string | null;
}

export interface BookView {
  start: string;
  size: number;
  left: number;
  /** Runs of unused numbers, already formatted, e.g. "008681 – 008730". */
  rangeLabels: string[];
  numbers: BookNumber[];
}

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const run = (action: () => Promise<ActionResult>, onDone?: () => void) => {
    setError('');
    startTransition(async () => {
      const r = await action();
      if (r.success) {
        onDone?.();
        router.refresh();
      } else setError(r.message);
    });
  };
  return { pending, error, setError, run };
}

/** Cancel button: asks for a reason (kept in the audit trail). */
export function CancelNumberButton({ id, number }: { id: string; number: string }) {
  const { pending, error, run } = useRun();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button" disabled={pending} className={btnSmall}
        onClick={() => {
          const reason = window.prompt(`Cancel cheque number ${number}?\n\nReason (e.g. spoiled, lost, voided):`);
          if (reason === null) return;
          run(() => cancelChequeNumber(id, reason));
        }}
      >
        <Ban className="h-3.5 w-3.5" /> {pending ? 'Working…' : 'Cancel'}
      </button>
      {error && <span role="alert" className="max-w-60 text-xs text-bounced">{error}</span>}
    </span>
  );
}

function NumberRow({ n }: { n: BookNumber }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(n.number);
  const [bank, setBank] = useState(n.bank ?? '');
  const { pending, error, setError, run } = useRun();

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2 px-4 py-2">
        <input
          aria-label="Cheque number" value={value} onChange={(e) => setValue(e.target.value)} maxLength={100}
          className={cn(input, 'w-40 py-1.5 tabular-nums')}
        />
        <input aria-label="Bank name" value={bank} onChange={(e) => setBank(e.target.value)} maxLength={100} placeholder="Bank (optional)" className={cn(input, 'w-48 py-1.5')} />
        <button
          type="button" disabled={pending} className={btnSmall}
          onClick={() => {
            const fd = new FormData();
            fd.set('id', n.id);
            fd.set('cheque_number', value);
            fd.set('bank_name', bank);
            run(() => updateChequeNumber({ success: false, message: '' }, fd), () => setEditing(false));
          }}
        >
          <Check className="h-3.5 w-3.5" /> Save
        </button>
        <button type="button" className={btnSmall} onClick={() => { setEditing(false); setValue(n.number); setBank(n.bank ?? ''); setError(''); }}>
          <X className="h-3.5 w-3.5" /> Discard
        </button>
        {error && <span role="alert" className="basis-full text-xs text-bounced">{error}</span>}
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="tabular-nums text-fg">
        {n.number} {n.bank && <span className="ml-2 text-xs text-muted">{n.bank}</span>}
      </span>
      <span className="flex items-center gap-2">
        <button type="button" className={btnSmall} onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
        <CancelNumberButton id={n.id} number={n.number} />
      </span>
    </li>
  );
}

/** Stock grouped into cheque books of 50; open a book to edit or cancel individual numbers. */
export function ChequeBookList({ books }: { books: BookView[] }) {
  return (
    <div className={`${card} divide-y divide-line text-sm`}>
      {books.map((b) => (
        <details key={b.start} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-2.5 hover:bg-surface-2/60">
            <span className="flex min-w-0 items-center gap-2 text-fg">
              <BookOpen className="h-4 w-4 shrink-0 text-subtle" />
              <span className="tabular-nums">{b.rangeLabels.join(', ')}</span>
            </span>
            <span className="shrink-0 text-muted">
              {b.left === b.size ? `${b.left.toLocaleString()} cheque${b.left === 1 ? '' : 's'}` : `${b.left.toLocaleString()} of ${b.size.toLocaleString()} left`}
            </span>
          </summary>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto border-t border-line bg-surface-2/40">
            {b.numbers.map((n) => <NumberRow key={n.id} n={n} />)}
          </ul>
        </details>
      ))}
    </div>
  );
}

export interface CancelledView {
  id: string;
  number: string;
  bank: string | null;
  reason: string | null;
  cancelledOn: string;
}

export function CancelledList({ rows }: { rows: CancelledView[] }) {
  const { pending, error, run } = useRun();
  return (
    <div className={`${card} divide-y divide-line text-sm`}>
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <span className="tabular-nums text-fg line-through decoration-subtle">{r.number}</span>
            {r.bank && <span className="ml-2 text-xs text-muted">{r.bank}</span>}
            <p className="text-xs text-muted">Cancelled {r.cancelledOn}{r.reason ? ` — ${r.reason}` : ''}</p>
          </div>
          <button type="button" disabled={pending} className={btnSmall} onClick={() => run(() => restoreChequeNumber(r.id))}>
            <RotateCcw className="h-3.5 w-3.5" /> Restore
          </button>
        </div>
      ))}
      {error && <p role="alert" className="px-4 py-2 text-xs text-bounced">{error}</p>}
    </div>
  );
}
