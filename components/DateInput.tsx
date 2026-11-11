'use client';

import { useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { dmyToIso, isoToDmy } from '@/lib/dates';
import { cn, input } from '@/lib/ui';

interface DateInputProps {
  id?: string;
  /** Submitted as 'YYYY-MM-DD' (empty until a full valid date is typed). */
  name?: string;
  /** 'YYYY-MM-DD' */
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Called with 'YYYY-MM-DD' once a full valid date is typed or picked, or undefined when cleared. */
  onValueChange?: (iso: string | undefined) => void;
  'aria-label'?: string;
}

/** Date field typed as DD/MM/YYYY (browser date pickers follow the OS locale); submits ISO. */
export default function DateInput({ id, name, defaultValue, required, disabled, className, onValueChange, 'aria-label': ariaLabel }: DateInputProps) {
  const [text, setText] = useState(isoToDmy(defaultValue));
  const [synced, setSynced] = useState(defaultValue ?? '');
  // Follow external changes (e.g. a filter's Clear button) without disturbing what is being typed.
  if ((defaultValue ?? '') !== synced) {
    setSynced(defaultValue ?? '');
    if ((dmyToIso(text) ?? '') !== (defaultValue ?? '')) setText(isoToDmy(defaultValue));
  }
  const update = (v: string) => {
    setText(v);
    if (!onValueChange) return;
    if (v.trim() === '') onValueChange(undefined);
    else {
      const d = dmyToIso(v);
      if (d) onValueChange(d);
    }
  };
  const iso = dmyToIso(text) ?? '';
  const invalid = text !== '' && !iso;
  const pickerRef = useRef<HTMLInputElement>(null);
  // Opens the browser's calendar only from the calendar button: opening it on focus/click of the text
  // box grabbed the keyboard and stopped people typing the date. Throws if the browser forbids it.
  const openPicker = () => {
    if (disabled) return;
    try { pickerRef.current?.showPicker(); } catch { /* typing still works */ }
  };
  return (
    <div className="relative w-full">
      {name && <input type="hidden" name={name} value={iso} disabled={disabled} />}
      <input
        id={id} value={text} onChange={(e) => update(e.target.value)} required={required} disabled={disabled}
        autoComplete="off"
        inputMode="numeric" maxLength={10} placeholder="DD/MM/YYYY" aria-label={ariaLabel} aria-invalid={invalid || undefined}
        title="Use DD/MM/YYYY" pattern="\d{1,2}/\d{1,2}/\d{4}"
        className={cn(input, 'pr-10', className, invalid && text.length >= 10 && 'border-bounced')}
      />
      {/* Hidden native date field: supplies the calendar popup, anchored below the text box. */}
      <input
        ref={pickerRef} type="date" tabIndex={-1} aria-hidden="true" disabled={disabled} value={iso}
        onChange={(e) => update(isoToDmy(e.target.value))}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full opacity-0"
      />
      <button
        type="button" tabIndex={-1} aria-label="Open calendar" disabled={disabled}
        onMouseDown={(e) => e.preventDefault()} onClick={openPicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
    </div>
  );
}
