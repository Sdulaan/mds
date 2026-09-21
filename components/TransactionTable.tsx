'use client';

import { useState, useTransition } from 'react';
import { updateTransactionStatus } from '@/actions/transactionActions';
import StatusBadge from '@/components/StatusBadge';
import type { TransactionWithEntity, TransactionStatus } from '@/types';

interface TransactionTableProps {
  transactions: TransactionWithEntity[];
}

function formatAmount(amount: string | number) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_CYCLE: Record<TransactionStatus, TransactionStatus> = {
  PENDING: 'CLEARED',
  CLEARED: 'BOUNCED',
  BOUNCED: 'PENDING',
};

function StatusToggle({ id, status }: { id: string; status: TransactionStatus }) {
  const [isPending, startTransition] = useTransition();
  const nextStatus = STATUS_CYCLE[status];

  return (
    <button
      onClick={() => {
        startTransition(() => {
          updateTransactionStatus(id, nextStatus);
        });
      }}
      disabled={isPending}
      title={`Mark as ${nextStatus}`}
      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? '...' : `→ ${nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}`}
    </button>
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
                  <StatusToggle id={tx.id} status={tx.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
