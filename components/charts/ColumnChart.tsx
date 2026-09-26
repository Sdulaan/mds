'use client';

import { useState } from 'react';
import { formatAmount } from '@/lib/format';

export interface ColumnDatum {
  key: string;
  label: string; // axis label, e.g. "Sep"
  title: string; // tooltip heading, e.g. "September 2026"
  value: number;
  count?: number;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  /** Tailwind background class for the columns (a theme token), e.g. 'bg-credit'. */
  barClass: string;
  countLabel?: string;
  ariaLabel: string;
}

/** 42_400_000 → "42.4M" */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
}

/** A "nice" axis maximum and 4 gridlines. */
function niceScale(max: number): number[] {
  if (max <= 0) return [0, 1, 2, 3, 4];
  const step = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s * 4 >= max) ?? step * 10;
  return [0, 1, 2, 3, 4].map((i) => i * nice);
}

// Single-series column chart: one hue, thin columns with rounded tops anchored to the
// baseline, recessive gridlines, and a hover tooltip per column. Text uses text tokens.
export default function ColumnChart({ data, barClass, countLabel = 'cheques', ariaLabel }: ColumnChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceScale(Math.max(...data.map((d) => d.value), 0));
  const top = ticks[ticks.length - 1];
  const hovered = active !== null ? data[active] : null;

  return (
    <div className="relative select-none" role="img" aria-label={ariaLabel}>
      <div className="flex">
        {/* Y axis labels */}
        <div className="relative mr-2 h-48 w-10 shrink-0 text-right text-[10px] tabular-nums text-subtle">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>

        <div className="relative h-48 flex-1">
          {/* Gridlines */}
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? 'border-line-strong' : 'border-line/70 border-dashed'}`} style={{ bottom: `${(t / top) * 100}%` }} />
          ))}

          {/* Columns — each hit area spans the full slot height, wider than the mark */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div
                key={d.key}
                className="group relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                aria-label={`${d.title}: ${formatAmount(d.value)}${d.count !== undefined ? `, ${d.count} ${countLabel}` : ''}`}
              >
                {active === i && <div className="absolute inset-0 rounded-md bg-surface-2/70" aria-hidden="true" />}
                <div
                  className={`relative w-[55%] max-w-9 rounded-t transition-opacity ${barClass} ${active !== null && active !== i ? 'opacity-50' : ''}`}
                  style={{ height: d.value > 0 ? `max(${(d.value / top) * 100}%, 2px)` : 0 }}
                />
              </div>
            ))}
          </div>

          {/* Tooltip */}
          {hovered && active !== null && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
              style={{ left: `${((active + 0.5) / data.length) * 100}%`, bottom: `calc(${Math.min((hovered.value / top) * 100, 80)}% + 10px)` }}
            >
              <p className="font-medium text-fg">{hovered.title}</p>
              <p className="tabular-nums text-fg">{formatAmount(hovered.value)}</p>
              {hovered.count !== undefined && (
                <p className="text-muted">{hovered.count.toLocaleString()} {countLabel}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* X axis labels */}
      <div className="ml-12 mt-1.5 flex gap-[2px]">
        {data.map((d, i) => (
          <span key={d.key} className={`flex-1 text-center text-[10px] ${active === i ? 'font-medium text-fg' : 'text-subtle'}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
