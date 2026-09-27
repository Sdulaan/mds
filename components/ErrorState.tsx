'use client';

import { useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { btnPrimary, card, cn } from '@/lib/ui';

interface ErrorStateProps {
  error: Error & { digest?: string };
  retry: () => void;
}

// Friendly fallback for page errors. Almost always a temporary problem reaching the
// database (unstable internet), so the main action is simply to try again.
export default function ErrorState({ error, retry }: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className={cn(card, 'w-full max-w-md p-8 text-center')}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pending-soft text-pending">
          <WifiOff className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold text-fg">Couldn&apos;t load this page</h1>
        <p className="mt-2 text-sm text-muted">
          The system couldn&apos;t reach the database. This is usually a brief internet connection problem — nothing has been lost.
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => {
            setRetrying(true);
            retry();
            setTimeout(() => setRetrying(false), 4000);
          }}
          disabled={retrying}
          className={cn(btnPrimary, 'mt-6')}
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} /> {retrying ? 'Trying again…' : 'Try again'}
        </button>
        {error.digest && <p className="mt-4 text-xs text-subtle">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
