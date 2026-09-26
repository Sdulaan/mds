'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Search, X } from 'lucide-react';
import { filtersToQuery } from '@/lib/filters';
import { btnSecondary, cn, input } from '@/lib/ui';
import { STATUSES_FOR, STATUS_LABEL, type ChequeFilters, type TransactionType } from '@/types';

interface ChequeFilterBarProps {
  type: TransactionType;
  filters: ChequeFilters;
  entities: { id: string; name: string }[];
  banks: string[];
  months: { value: string; label: string }[];
  entityLabel: string;
}

// SRS §4: search by name / GRN / cheque number / amount / date range, filter by status,
// entity, month and date. Results update as you type.
export default function ChequeFilterBar({ type, filters, entities, banks, months, entityLabel }: ChequeFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q ?? '');
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const apply = (patch: Partial<ChequeFilters>) => {
    const qs = filtersToQuery({ ...filters, ...patch });
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Debounced "instant" search.
  const onSearch = (value: string) => {
    setQ(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value.trim() || undefined }), 300);
  };
  useEffect(() => () => clearTimeout(debounce.current), []);

  const select = cn(input, 'w-auto min-w-0 cursor-pointer py-2');
  const labelClass = 'mb-1 block text-xs font-medium text-muted';
  const hasFilters = Boolean(filters.q || (filters.status && filters.status !== 'ALL') || filters.entityId || filters.month || filters.from || filters.to || filters.bank);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={`Search ${entityLabel.toLowerCase()} name, cheque no.,${type === 'DEBIT' ? ' GRN,' : ''} bank or amount…`}
          className={cn(input, 'pl-10 pr-10')}
          aria-label="Search cheques"
        />
        {isPending && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-subtle" />}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-status" className={labelClass}>Status</label>
          <select id="f-status" value={filters.status ?? 'ALL'} onChange={(e) => apply({ status: e.target.value as ChequeFilters['status'] })} className={select}>
            <option value="ALL">All statuses</option>
            {STATUSES_FOR[type].map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-entity" className={labelClass}>{entityLabel}</label>
          <select id="f-entity" value={filters.entityId ?? ''} onChange={(e) => apply({ entityId: e.target.value || undefined })} className={cn(select, 'max-w-56')}>
            <option value="">All</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-month" className={labelClass}>Month</label>
          <select id="f-month" value={filters.month ?? ''} onChange={(e) => apply({ month: e.target.value || undefined })} className={select}>
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-from" className={labelClass}>From</label>
          <input id="f-from" type="date" value={filters.from ?? ''} onChange={(e) => apply({ from: e.target.value || undefined })} className={cn(input, 'w-auto py-2')} />
        </div>
        <div>
          <label htmlFor="f-to" className={labelClass}>To</label>
          <input id="f-to" type="date" value={filters.to ?? ''} onChange={(e) => apply({ to: e.target.value || undefined })} className={cn(input, 'w-auto py-2')} />
        </div>
        {banks.length > 0 && (
          <div>
            <label htmlFor="f-bank" className={labelClass}>Bank</label>
            <select id="f-bank" value={filters.bank ?? ''} onChange={(e) => apply({ bank: e.target.value || undefined })} className={select}>
              <option value="">All banks</option>
              {banks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
            className={cn(btnSecondary, 'py-2 font-medium text-muted')}
          >
            <X className="h-4 w-4" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
