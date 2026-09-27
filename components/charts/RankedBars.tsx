import { formatAmount } from '@/lib/format';

interface RankedBarsProps {
  data: { name: string; amount: number; count: number }[];
  barClass: string;
}

/** Horizontal bars for "amount per creditor": direct labels, one hue, largest first. */
export default function RankedBars({ data, barClass }: RankedBarsProps) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-subtle">No uncleared cheques.</p>;
  const max = Math.max(...data.map((d) => d.amount));

  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
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
  );
}
