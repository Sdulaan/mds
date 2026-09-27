'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { formatDate } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import type { GrnOption } from '@/lib/grn-allocation';
import { cn, input } from '@/lib/ui';

interface GrnPickerProps {
  id: string;
  /** The selected creditor's GRNs (unpaid, plus any already on this cheque). */
  options: GrnOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** No creditor chosen yet. */
  disabled?: boolean;
}

// Multi-select dropdown of a creditor's unpaid GRNs. Selected ids are submitted as `grn_ids`.
export default function GrnPicker({ id, options, selected, onChange, disabled }: GrnPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const listId = useId();

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const chosen = options.filter((o) => selected.includes(o.id));
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? options.filter((o) => o.grn_number.toLowerCase().includes(term)) : options;
  }, [options, q]);
  const toggle = (grnId: string) =>
    onChange(selected.includes(grnId) ? selected.filter((s) => s !== grnId) : [...selected, grnId]);

  return (
    <div ref={ref} className="relative">
      {selected.map((s) => <input key={s} type="hidden" name="grn_ids" value={s} />)}

      <div
        id={id}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-controls={listId}
        aria-disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === 'Escape') setOpen(false);
        }}
        className={cn(input, 'flex min-h-[2.75rem] cursor-pointer flex-wrap items-center gap-1.5 py-1.5 pr-10', disabled && 'cursor-not-allowed opacity-60')}
      >
        {chosen.length === 0 && (
          <span className="text-subtle">{disabled ? 'Select the creditor first' : 'Select GRN(s)…'}</span>
        )}
        {chosen.map((g) => (
          <span key={g.id} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-1 text-xs font-medium text-brand">
            GRN {g.grn_number}
            <button
              type="button"
              aria-label={`Remove GRN ${g.grn_number}`}
              onClick={(e) => {
                e.stopPropagation();
                toggle(g.id);
              }}
              className="rounded hover:bg-brand/15"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <ChevronDown className={cn('pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          {options.length > 5 && (
            <div className="relative border-b border-line p-2">
              <Search className="pointer-events-none absolute left-4.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                placeholder="Search GRN number…"
                className={cn(input, 'py-2 pl-9')}
              />
            </div>
          )}
          <ul id={listId} role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto py-1">
            {filtered.map((g) => {
              const isSelected = selected.includes(g.id);
              const part = g.remaining < g.amount;
              return (
                <li
                  key={g.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(g.id)}
                  className="mx-1 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-surface-2"
                >
                  <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', isSelected ? 'border-brand bg-brand text-brand-fg' : 'border-line-strong')}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-fg">GRN {g.grn_number}</span>
                    <span className="ml-2 text-xs text-subtle">{formatDate(g.purchase_date)}</span>
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-medium text-fg">{formatNumber(Math.max(0, g.remaining))}</span>
                    {part && <span className="block text-[11px] text-subtle">unpaid of {formatNumber(g.amount)}</span>}
                  </span>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">{options.length ? 'No GRN matches' : 'This creditor has no unpaid GRNs.'}</li>
            )}
          </ul>
          <div className="border-t border-line px-2 py-1.5">
            <Link href="/purchases" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-brand hover:bg-surface-2">
              <Plus className="h-4 w-4" /> Add a GRN in Purchases
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
