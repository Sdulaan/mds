'use client';

import { useState } from 'react';
import { formatAmount } from '@/lib/format';

interface RankedBarsProps {
  data: { name: string; amount: number; count: number }[];
  barClass: string;
  /** Rows shown before "Show all" (the rest stay hidden until expanded). */
  initialLimit?: number;
}

/** Horizontal bars for "amount per creditor": direct labels, one hue, largest first. */
export default function RankedBars({ data, barClass, initialLimit = 10 }: RankedBarsProps) {
  const [showAll, setShowAll] = useState(false);
  if (data.length === 0) return <p className="py-10 text-center text-sm text-subtle">No uncleared cheques.</p>;
  const max = Math.max(...data.map((d) => d.amount));
  const hidden = Math.max(0, data.length - initialLimit);
  const shown = showAll ? data : data.slice(0, initialLimit);
  const totalAmount = data.reduce((s, d) => s + d.amount, 0);
  const totalCount = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <ul className="space-y-2.5">
        {shown.map((d) => (
          <li key={d.name} title={`${d.name}: ${formatAmount(d.amount)} (${d.count} cheques)`}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate font-medium text-fg">{d.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {formatAmount(d.amount)} <span className="text-subtle">· {d.count}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${Math.max((d.amount / max) * 100, 1)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span>
          {data.length.toLocaleString()} creditor{data.length === 1 ? '' : 's'} · {totalCount.toLocaleString()} cheque{totalCount === 1 ? '' : 's'} ·{' '}
          <span className="font-semibold tabular-nums text-fg">{formatAmount(totalAmount)}</span>
        </span>
        {hidden > 0 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="font-medium text-brand hover:underline">
            {showAll ? 'Show top 10 only' : `Show all ${data.length.toLocaleString()} creditors`}
          </button>
        )}
      </div>
    </div>
  );
}
