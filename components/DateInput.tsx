'use client';

import { useState } from 'react';
import { dmyToIso, isoToDmy } from '@/lib/dates';
import { cn, input } from '@/lib/ui';

interface DateInputProps {
  id?: string;
  /** Submitted as 'YYYY-MM-DD' (empty until a full valid date is typed). */
  name: string;
  /** 'YYYY-MM-DD' */
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Date field typed as DD/MM/YYYY (browser date pickers follow the OS locale); submits ISO. */
export default function DateInput({ id, name, defaultValue, required, disabled, className, 'aria-label': ariaLabel }: DateInputProps) {
  const [text, setText] = useState(isoToDmy(defaultValue));
  const iso = dmyToIso(text) ?? '';
  const invalid = text !== '' && !iso;
  return (
    <>
      <input type="hidden" name={name} value={iso} disabled={disabled} />
      <input
        id={id} value={text} onChange={(e) => setText(e.target.value)} required={required} disabled={disabled}
        inputMode="numeric" maxLength={10} placeholder="DD/MM/YYYY" aria-label={ariaLabel} aria-invalid={invalid || undefined}
        title="Use DD/MM/YYYY" pattern="\d{1,2}/\d{1,2}/\d{4}"
        className={cn(input, className, invalid && text.length >= 10 && 'border-bounced')}
      />
    </>
  );
}
