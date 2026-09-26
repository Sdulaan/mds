'use client';

import { useRouter, usePathname } from 'next/navigation';
import { filtersToQuery } from '@/lib/filters';
import type { TransactionFilters } from '@/types';

interface FilterBarProps {
  currentType: string;
  currentStatus: string;
  currentMonth: string;
  /** Month options computed on the server (app timezone), so server and client render identically. */
  months: { value: string; label: string }[];
}

export default function FilterBar({ currentType, currentStatus, currentMonth, months }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (key: keyof TransactionFilters, value: string) => {
    const next = { type: currentType, status: currentStatus, month: currentMonth, [key]: value } as TransactionFilters;
    const qs = filtersToQuery(next);
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const selectClass =
    'rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors cursor-pointer';

  // Keep an out-of-range month (e.g. from an old link) selectable.
  const monthOptions =
    currentMonth && !months.some((m) => m.value === currentMonth)
      ? [{ value: currentMonth, label: currentMonth }, ...months]
      : months;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Type Filter */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-type" className="text-xs font-medium text-slate-400">Type</label>
        <select
          id="filter-type"
          value={currentType}
          onChange={(e) => handleChange('type', e.target.value)}
          className={selectClass}
        >
          <option value="ALL">All Types</option>
          <option value="CREDIT">Credit</option>
          <option value="DEBIT">Debit</option>
        </select>
      </div>

      {/* Status Filter */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-status" className="text-xs font-medium text-slate-400">Status</label>
        <select
          id="filter-status"
          value={currentStatus}
          onChange={(e) => handleChange('status', e.target.value)}
          className={selectClass}
        >
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CLEARED">Cleared</option>
          <option value="BOUNCED">Bounced</option>
        </select>
      </div>

      {/* Month Filter */}
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-month" className="text-xs font-medium text-slate-400">Month</label>
        <select
          id="filter-month"
          value={currentMonth}
          onChange={(e) => handleChange('month', e.target.value)}
          className={selectClass}
        >
          <option value="">All Months</option>
          {monthOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {(currentType !== 'ALL' || currentStatus !== 'ALL' || currentMonth !== '') && (
        <button
          onClick={() => router.push(pathname, { scroll: false })}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
