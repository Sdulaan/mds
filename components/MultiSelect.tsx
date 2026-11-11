'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn, input } from '@/lib/ui';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  /** Submitted as repeated fields with this name (for plain GET/POST forms). */
  name?: string;
  /** Text shown when nothing is selected, e.g. "All". */
  allLabel?: string;
  /** Plural noun for the summary, e.g. "customers". */
  noun?: string;
  className?: string;
  /** Let the user add a value that is not in the list by typing it (shown as an "Add …" row). */
  allowCustom?: boolean;
  /** Placeholder for the search box. */
  searchPlaceholder?: string;
}

/** Searchable checkbox dropdown: tick one or many entries; nothing ticked means "all". */
export default function MultiSelect({ id, options, selected, onChange, name, allLabel = 'All', noun = 'selected', className, allowCustom, searchPlaceholder = 'Search…' }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const chosen = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, q]);
  const typed = q.trim();
  const canAddTyped = !!allowCustom && typed !== '' && !options.some((o) => o.value.toLowerCase() === typed.toLowerCase()) && !chosen.has(typed);
  const shownValues = filtered.map((o) => o.value);
  const allShownOn = shownValues.length > 0 && shownValues.every((v) => chosen.has(v));
  const toggleShown = () => onChange(allShownOn ? selected.filter((v) => !shownValues.includes(v)) : [...new Set([...selected, ...shownValues])]);
  const toggle = (value: string) => onChange(chosen.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  const summary =
    selected.length === 0 ? allLabel
    : selected.length === 1 ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
    : `${selected.length} ${noun}`;

  return (
    <div ref={root} className="relative">
      {name && selected.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      <button
        type="button" id={id} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className={cn(input, 'flex w-full items-center justify-between gap-2 py-2 text-left', className)}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-fg')}>{summary}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 max-w-[85vw] overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} aria-label="Search list"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (canAddTyped) { onChange([...selected, typed]); setQ(''); }
                }
                if (e.key === 'Escape') setOpen(false);
              }}
              className={cn(input, 'py-1.5 pl-9 text-sm')}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted">
            <span>{selected.length === 0 ? (allowCustom ? 'None selected' : 'Showing all') : `${selected.length} selected`}</span>
            <span className="flex items-center gap-3">
              {allowCustom && filtered.length > 1 && (
                <button type="button" onClick={toggleShown} className="font-medium text-brand hover:underline">
                  {allShownOn ? 'Unselect shown' : `Select ${q.trim() ? 'shown' : 'all'} (${filtered.length})`}
                </button>
              )}
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="flex items-center gap-1 font-medium text-brand hover:underline">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </span>
          </div>
          <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto pb-1">
            {filtered.map((o) => {
              const on = chosen.has(o.value);
              return (
                <li key={o.value} role="option" aria-selected={on}>
                  <label className="mx-1 flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg hover:bg-surface-2">
                    <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="sr-only" />
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand bg-brand text-white' : 'border-line-strong')}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  </label>
                </li>
              );
            })}
            {canAddTyped && (
              <li>
                <button type="button" onClick={() => { onChange([...selected, typed]); setQ(''); }} className="mx-1 w-[calc(100%-0.5rem)] rounded-md px-2.5 py-2 text-left text-sm font-medium text-brand hover:bg-surface-2">
                  Add &ldquo;{typed}&rdquo; (not in the generated list — it will be registered as typed)
                </button>
              </li>
            )}
            {filtered.length === 0 && !canAddTyped && <li className="px-4 py-3 text-sm text-muted">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Uncontrolled MultiSelect for server-rendered GET forms: submits one `name=value` per ticked entry. */
export function MultiSelectField({ defaultSelected = [], ...props }: Omit<MultiSelectProps, 'selected' | 'onChange'> & { defaultSelected?: string[] }) {
  const [selected, setSelected] = useState(defaultSelected);
  return <MultiSelect {...props} selected={selected} onChange={setSelected} />;
}
