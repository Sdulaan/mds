'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { FileSearch, Pencil } from 'lucide-react';
import { setChequeFlag } from '@/actions/chequeActions';
import SortHeader from '@/components/SortHeader';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import type { Sort } from '@/lib/sort';
import { card, cn, td as tdBase, th as thBase } from '@/lib/ui';

// This register has many columns: slightly tighter cells so it fits beside the sidebar.
const th = cn(thBase, 'px-3');
const td = cn(tdBase, 'px-3');
import { FLAGS_FOR, type StatusFlag, type TransactionType, type TransactionWithEntity } from '@/types';

const FLAG_DATE: Record<StatusFlag, keyof TransactionWithEntity> = {
  deposited: 'deposited_date',
  cleared: 'cleared_date',
  returned: 'returned_date',
  cancelled: 'cancelled_date',
};

interface ChequeRegisterProps {
  type: TransactionType;
  rows: TransactionWithEntity[];
  /** IDs of rows the current user may edit (admins: all; standard users: their own). */
  editableIds: string[];
  entityLabel: string;
  sort: Sort;
  /** Header link for each sortable column (built on the server, keeping the filters). */
  sortLinks: Record<string, string>;
}

function StatusCheckboxes({ cheque, editable }: { cheque: TransactionWithEntity; editable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const toggle = (flag: StatusFlag, checked: boolean) => {
    setError('');
    startTransition(async () => {
      const result = await setChequeFlag(cheque.id, flag, checked);
      if (!result.success) setError(result.message);
    });
  };

  return (
    <div className={isPending ? 'opacity-50' : undefined}>
      <div className="flex flex-col gap-1.5">
        {FLAGS_FOR[cheque.transaction_type].map(({ flag, label }) => {
          const date = cheque[FLAG_DATE[flag]] as string | null;
          return (
            <label
              key={flag}
              title={date ? `${label} on ${formatDate(date)}` : editable ? `Mark as ${label.toLowerCase()}` : 'You can only change your own entries'}
              className={`flex items-center gap-1.5 whitespace-nowrap text-xs ${editable ? 'cursor-pointer text-fg' : 'cursor-not-allowed text-subtle'}`}
            >
              <input
                type="checkbox"
                checked={!!date}
                disabled={!editable || isPending}
                onChange={(e) => toggle(flag, e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-line-strong accent-[var(--brand)] disabled:cursor-not-allowed"
              />
              {label}
            </label>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-1 max-w-64 text-xs text-bounced">{error}</p>}
    </div>
  );
}

/** The date shown under the status badge: when the current status was reached. */
function statusDate(c: TransactionWithEntity): string | null {
  return c.returned_date ?? c.cancelled_date ?? c.cleared_date ?? c.deposited_date;
}

export default function ChequeRegister({ type, rows, editableIds, entityLabel, sort, sortLinks }: ChequeRegisterProps) {
  if (rows.length === 0) {
    return (
      <div className={`${card} flex flex-col items-center justify-center py-20 text-center`}>
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
          <FileSearch className="h-7 w-7 text-subtle" />
        </div>
        <p className="text-sm font-medium text-fg">No cheques found</p>
        <p className="mt-1 text-xs text-muted">Try adjusting the search or filters, or add a new cheque.</p>
      </div>
    );
  }

  const editable = new Set(editableIds);

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2">
              {type === 'DEBIT' && <SortHeader label="GRN No." column="grn" className="px-3" current={sort} href={sortLinks.grn} />}
              <SortHeader label={entityLabel} column="entity" className="px-3" current={sort} href={sortLinks.entity} />
              <SortHeader label="Cheque No." column="cheque_number" className="px-3" current={sort} href={sortLinks.cheque_number} />
              <SortHeader label="Cheque Date" column="cheque_date" className="px-3" current={sort} href={sortLinks.cheque_date} />
              <SortHeader label="Amount (LKR)" column="amount" className="px-3" current={sort} href={sortLinks.amount} align="right" />
              <SortHeader label="Status" column="status" className="px-3" current={sort} href={sortLinks.status} />
              <th className={th}>{type === 'CREDIT' ? 'Deposit / Credit / Return' : 'Clear / Cancel'}</th>
              <SortHeader label="Entry Date" column="entry_date" className="px-3" current={sort} href={sortLinks.entry_date} />
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => {
              const date = statusDate(c);
              return (
                <tr key={c.id} className="align-top transition-colors hover:bg-surface-2/60">
                  {type === 'DEBIT' && <td className={`${td} whitespace-nowrap font-mono text-xs text-muted`}>{c.grn_number || '—'}</td>}
                  <td className={`${td} min-w-44`}>
                    <p className="font-medium text-fg">{c.entity_name}</p>
                    {(c.bank_name || c.remarks) && (
                      <p className="max-w-64 truncate text-xs text-subtle" title={[c.bank_name, c.remarks].filter(Boolean).join(' · ')}>
                        {[c.bank_name, c.remarks].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap font-mono text-muted`}>{c.cheque_number}</td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(c.cheque_date)}</td>
                  <td className={`${td} whitespace-nowrap text-right font-medium tabular-nums text-fg`}>{formatNumber(c.amount)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <StatusBadge status={c.status} />
                    {date && <p className="mt-1 whitespace-nowrap text-[11px] text-subtle">{formatDate(date)}</p>}
                  </td>
                  <td className={td}>
                    <StatusCheckboxes cheque={c} editable={editable.has(c.id)} />
                  </td>
                  <td className={`${td} whitespace-nowrap text-xs text-muted`}>{formatDate(c.entry_date)}</td>
                  <td className={`${td} text-right`}>
                    <Link
                      href={`/cheques/${c.id}`}
                      title={editable.has(c.id) ? 'Edit' : 'View'}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">{editable.has(c.id) ? 'Edit' : 'View'}</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
