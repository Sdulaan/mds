'use client';

import { useState, useTransition } from 'react';
import { updateTransactionStatus } from '@/actions/transactionActions';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { formatAmount } from '@/lib/format';
import { TRANSACTION_STATUSES, type TransactionWithEntity, type TransactionStatus } from '@/types';

interface TransactionTableProps {
  transactions: TransactionWithEntity[];
}

const STATUS_ACTIONS: Record<TransactionStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'hover:border-amber-400/40 hover:text-amber-300' },
  CLEARED: { label: 'Cleared', className: 'hover:border-emerald-400/40 hover:text-emerald-300' },
  BOUNCED: { label: 'Bounced', className: 'hover:border-rose-400/40 hover:text-rose-300' },
};

function StatusActions({ id, status }: { id: string; status: TransactionStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const change = (next: TransactionStatus) => {
    setError('');
    startTransition(async () => {
      const result = await updateTransactionStatus(id, next);
      if (!result.success) setError(result.message);
    });
  };

  return (
    <div>
      <div className="flex gap-1.5">
        {TRANSACTION_STATUSES.filter((s) => s !== status).map((next) => (
          <button
            key={next}
            onClick={() => change(next)}
            disabled={isPending}
            title={`Mark as ${STATUS_ACTIONS[next].label}`}
            className={`whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${STATUS_ACTIONS[next].className}`}
          >
            {isPending ? '...' : `→ ${STATUS_ACTIONS[next].label}`}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

export default function TransactionTable({ transactions }: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-800/40 py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-700/60">
          <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-400">No transactions found</p>
        <p className="mt-1 text-xs text-slate-600">Try adjusting your filters or add a new cheque.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/40">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-slate-800/60">
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Entity</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Cheque No.</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Amount</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">GRN</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="group transition-colors hover:bg-white/5"
              >
                <td className="whitespace-nowrap px-4 py-3.5 text-slate-300">
                  {formatDate(tx.cheque_date)}
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-medium text-white">{tx.entity_name}</p>
                  <p className="text-xs text-slate-500">{tx.entity_type}</p>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                      tx.transaction_type === 'CREDIT'
                        ? 'bg-sky-400/10 text-sky-400'
                        : 'bg-orange-400/10 text-orange-400'
                    }`}
                  >
                    {tx.transaction_type}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 font-mono text-slate-300">
                  {tx.cheque_number}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-white">
                  {formatAmount(tx.amount)}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={tx.status} />
                </td>
                <td className="px-4 py-3.5 text-slate-400 text-xs font-mono">
                  {tx.grn_number || <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3.5">
                  <StatusActions id={tx.id} status={tx.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
