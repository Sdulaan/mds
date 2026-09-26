'use client';

import { useState } from 'react';
import Link from 'next/link';
import { addTransaction } from '@/actions/transactionActions';
import { useFormAction } from '@/components/useFormAction';
import { ENTITY_TYPE_FOR, type Entity } from '@/types';

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      id="submit-cheque-btn"
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-500 hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Saving...
        </span>
      ) : (
        'Add Cheque'
      )}
    </button>
  );
}

interface AddChequeFormProps {
  entities: Entity[];
}

export default function AddChequeForm({ entities }: AddChequeFormProps) {
  const { state, pending, formRef, onSubmit } = useFormAction(addTransaction);
  const [txType, setTxType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';

  // Credits come from customers, debits go to vendors (also enforced on the server).
  const eligible = entities.filter((e) => e.type === ENTITY_TYPE_FOR[txType]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      {/* Feedback Toast */}
      {state.message && (
        <div
          role="alert"
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            state.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {state.success ? (
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {state.message}
        </div>
      )}

      {/* Transaction Type */}
      <div>
        <label className={labelClass}>Transaction Type *</label>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Transaction type">
          {(['CREDIT', 'DEBIT'] as const).map((type) => (
            <label
              key={type}
              htmlFor={`type-${type.toLowerCase()}`}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${
                txType === type
                  ? type === 'CREDIT'
                    ? 'border-sky-500/50 bg-sky-500/10'
                    : 'border-orange-500/50 bg-orange-500/10'
                  : 'border-white/10 bg-slate-800/60 hover:border-white/20'
              }`}
            >
              <input
                id={`type-${type.toLowerCase()}`}
                type="radio"
                name="transaction_type"
                value={type}
                checked={txType === type}
                onChange={() => setTxType(type)}
                className="sr-only"
                required
              />
              <div
                className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                  txType === type
                    ? type === 'CREDIT'
                      ? 'border-sky-400'
                      : 'border-orange-400'
                    : 'border-slate-600'
                }`}
              >
                {txType === type && (
                  <div
                    className={`h-2 w-2 rounded-full ${
                      type === 'CREDIT' ? 'bg-sky-400' : 'bg-orange-400'
                    }`}
                  />
                )}
              </div>
              <div>
                <p className={`font-semibold ${txType === type ? (type === 'CREDIT' ? 'text-sky-300' : 'text-orange-300') : 'text-slate-300'}`}>
                  {type}
                </p>
                <p className="text-xs text-slate-500">
                  {type === 'CREDIT' ? 'Payment received' : 'Payment made'}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Entity */}
      <div>
        <label htmlFor="entity_id" className={labelClass}>
          {txType === 'CREDIT' ? 'Customer / Debtor' : 'Vendor / Creditor'} *
        </label>
        {/* key resets the selection when the transaction type changes */}
        <select key={txType} id="entity_id" name="entity_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select a {txType === 'CREDIT' ? 'customer' : 'vendor'}...
          </option>
          {eligible.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        {eligible.length === 0 && (
          <p className="mt-1.5 text-xs text-amber-400">
            No {txType === 'CREDIT' ? 'customers' : 'vendors'} found.{' '}
            <Link href="/entities" className="underline hover:text-amber-300">Add one first →</Link>
          </p>
        )}
      </div>

      {/* Row: Cheque No + Date */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cheque_number" className={labelClass}>Cheque Number *</label>
          <input
            id="cheque_number"
            type="text"
            name="cheque_number"
            required
            placeholder="e.g. 004521"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="cheque_date" className={labelClass}>Cheque Date *</label>
          <input
            id="cheque_date"
            type="date"
            name="cheque_date"
            required
            className={inputClass}
          />
        </div>
      </div>

      {/* Row: Amount + GRN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className={labelClass}>Amount (LKR) *</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">Rs.</span>
            <input
              id="amount"
              type="number"
              name="amount"
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
        <div>
          <label htmlFor="grn_number" className={labelClass}>GRN Number <span className="text-slate-500">(Optional)</span></label>
          <input
            id="grn_number"
            type="text"
            name="grn_number"
            placeholder="e.g. GRN-2026-001"
            className={inputClass}
          />
        </div>
      </div>

      {/* Remarks */}
      <div>
        <label htmlFor="remarks" className={labelClass}>Remarks <span className="text-slate-500">(Optional)</span></label>
        <textarea
          id="remarks"
          name="remarks"
          rows={3}
          placeholder="Any additional notes..."
          className={`${inputClass} resize-none`}
        />
      </div>

      <SubmitButton pending={pending} />
    </form>
  );
}
