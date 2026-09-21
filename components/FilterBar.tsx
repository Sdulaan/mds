'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import type { TransactionType, TransactionStatus } from '@/types';

interface FilterBarProps {
  currentType: string;
  currentStatus: string;
  currentMonth: string;
}

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return { value, label };
});

export default function FilterBar({ currentType, currentStatus, currentMonth }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === 'ALL' || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      return params.toString();
    },
    [searchParams]
  );

  const handleChange = (key: string, value: string) => {
    router.push(`${pathname}?${createQueryString({ [key]: value })}`, { scroll: false });
  };

  const selectClass =
    'rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Type Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-400">Type</label>
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
        <label className="text-xs font-medium text-slate-400">Status</label>
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
        <label className="text-xs font-medium text-slate-400">Month</label>
        <select
          id="filter-month"
          value={currentMonth}
          onChange={(e) => handleChange('month', e.target.value)}
          className={selectClass}
        >
          <option value="">All Months</option>
          {MONTHS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters */}
      {(currentType !== 'ALL' || currentStatus !== 'ALL' || currentMonth !== '') && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-transparent">Clear</label>
          <button
            onClick={() => router.push(pathname, { scroll: false })}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
