'use client';

import { useState } from 'react';
import { CalendarDays, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/ui';

interface PeriodPickerProps {
  initial: 'month' | 'date';
  month?: string;
  from?: string;
  to?: string;
  months: { value: string; label: string }[];
  labelClass: string;
  field: string;
}

// Month-wise or date-wise, never both: the inputs of the mode not chosen are disabled,
// so the browser leaves them out of the submitted report parameters.
export default function PeriodPicker({ initial, month, from, to, months, labelClass, field }: PeriodPickerProps) {
  const [mode, setMode] = useState(initial);
  const byMonth = mode === 'month';
  const tab = (value: 'month' | 'date', text: string, Icon: typeof CalendarDays) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        mode === value ? 'bg-surface text-fg shadow-card' : 'text-muted hover:text-fg'
      )}
    >
      <Icon className="h-4 w-4" /> {text}
    </button>
  );
  const dim = (disabled: boolean) => cn(disabled && 'opacity-45');

  return (
    <>
      <input type="hidden" name="mode" value={mode} />
      <div>
        <span className={labelClass}>Filter by</span>
        <div className="inline-flex rounded-lg bg-surface-2 p-1">
          {tab('month', 'Month', CalendarDays)}
          {tab('date', 'Date range', CalendarRange)}
        </div>
      </div>
      <div className={dim(!byMonth)}>
        <label htmlFor="r-month" className={labelClass}>Month</label>
        <select id="r-month" name="month" defaultValue={month ?? months[0]?.value} disabled={!byMonth} className={field}>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className={dim(byMonth)}>
        <label htmlFor="r-from" className={labelClass}>From</label>
        <input id="r-from" type="date" name="from" defaultValue={from ?? ''} disabled={byMonth} required={!byMonth} className={field} />
      </div>
      <div className={dim(byMonth)}>
        <label htmlFor="r-to" className={labelClass}>To</label>
        <input id="r-to" type="date" name="to" defaultValue={to ?? ''} disabled={byMonth} required={!byMonth} className={field} />
      </div>
    </>
  );
}
