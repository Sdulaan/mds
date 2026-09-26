'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionResult } from '@/types';

interface ConfirmButtonProps {
  /** Server action to run once confirmed. */
  action: () => Promise<ActionResult>;
  confirm: string;
  children: React.ReactNode;
  className?: string;
  /** Where to go after success (otherwise the page refreshes). */
  redirectTo?: string;
}

export default function ConfirmButton({ action, confirm: message, children, className, redirectTo }: ConfirmButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const run = () => {
    if (!window.confirm(message)) return;
    setResult(null);
    startTransition(async () => {
      const r = await action();
      setResult(r);
      if (r.success) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }
    });
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button type="button" onClick={run} disabled={isPending} className={className}>
        {isPending ? 'Working…' : children}
      </button>
      {result && !result.success && (
        <p role="alert" className="max-w-72 text-xs text-bounced">{result.message}</p>
      )}
    </div>
  );
}
