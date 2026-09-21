'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { addEntity } from '@/actions/entityActions';
import type { ActionResult } from '@/types';

const initialState: ActionResult = { success: false, message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      id="add-entity-btn"
      type="submit"
      disabled={pending}
      className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] whitespace-nowrap"
    >
      {pending ? 'Adding...' : '+ Add Entity'}
    </button>
  );
}

export default function AddEntityForm() {
  const [state, formAction] = useActionState(addEntity, initialState);

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors';

  return (
    <div className="glass-card p-5">
      <h2 className="mb-4 text-base font-semibold text-white">Add New Entity</h2>

      {state.message && (
        <div
          role="alert"
          className={`mb-4 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
            state.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {state.message}
        </div>
      )}

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-40">
          <label htmlFor="entity-name" className="mb-1.5 block text-xs font-medium text-slate-400">
            Name *
          </label>
          <input
            id="entity-name"
            type="text"
            name="name"
            required
            placeholder="e.g. Darley Butler"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="entity-type" className="mb-1.5 block text-xs font-medium text-slate-400">
            Type *
          </label>
          <select id="entity-type" name="type" required className={inputClass}>
            <option value="VENDOR">Vendor (Creditor)</option>
            <option value="CUSTOMER">Customer (Debtor)</option>
          </select>
        </div>
        <SubmitButton />
      </form>
    </div>
  );
}
