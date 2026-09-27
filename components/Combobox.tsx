'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn, input } from '@/lib/ui';

export interface ComboboxOption {
  value: string;
  /** Small grey tag shown on the right, e.g. "Inactive". */
  hint?: string;
}

interface ComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  /** Submitted with the form under this name (optional — some callers submit a separate hidden id). */
  name?: string;
  placeholder?: string;
  required?: boolean;
  /** Shown in the list when nothing matches the typed text. */
  emptyText?: string;
  /** Extra content at the bottom of the list, e.g. an "Add new" link. */
  footer?: React.ReactNode;
}

// Searchable dropdown that replaces the browser's <datalist> (which looks like autofill history).
// The text box stays free-typing; the list filters as you type and supports mouse and keyboard.
export default function Combobox({ id, value, onChange, options, name, placeholder, required, emptyText = 'No matches', footer }: ComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  // True once the user types; until then the full list is shown even if a value is already selected.
  const [typing, setTyping] = useState(false);
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value.toLowerCase() === value.trim().toLowerCase());
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!typing || !q) return options;
    const starts = options.filter((o) => o.value.toLowerCase().startsWith(q));
    const contains = options.filter((o) => !o.value.toLowerCase().startsWith(q) && o.value.toLowerCase().includes(q));
    return [...starts, ...contains];
  }, [options, value, typing]);

  // Keep the highlighted row visible while moving with the arrow keys.
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (open) return;
    const i = selected ? options.indexOf(selected) : 0;
    setTyping(false);
    setActive(Math.max(0, i));
    setOpen(true);
  };

  const choose = (option: ComboboxOption) => {
    onChange(option.value);
    setOpen(false);
    setTyping(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openList();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (filtered.length ? (a + step + filtered.length) % filtered.length : 0));
    } else if (e.key === 'Enter' && open) {
      // Pick the highlighted option instead of submitting the form.
      if (filtered[active]) {
        e.preventDefault();
        choose(filtered[active]);
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTyping(true);
          setActive(0);
          setOpen(true);
        }}
        onFocus={openList}
        onClick={openList}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        className={cn(input, 'pl-10 pr-16')}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {value && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setTyping(false);
              setActive(0);
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Close list' : 'Open list'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) setOpen(false);
            else {
              inputRef.current?.focus();
              openList();
            }
          }}
          className="rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div
          // Keep focus in the input while clicking inside the panel.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
        >
          <ul ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.map((option, i) => {
              const isSelected = option === selected;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(option)}
                  className={cn(
                    'mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-fg',
                    i === active && 'bg-surface-2',
                    isSelected && 'font-medium text-brand'
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1 truncate">
                    <Highlight text={option.value} query={typing ? value.trim() : ''} />
                  </span>
                  {option.hint && (
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-subtle">{option.hint}</span>
                  )}
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-4 py-3 text-sm text-muted">{emptyText}</li>}
          </ul>
          {footer && <div className="border-t border-line px-2 py-1.5">{footer}</div>}
        </div>
      )}
    </div>
  );
}

/** Bolds the part of `text` that matches the typed query. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-fg">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}
