'use client';

import { useState, useTransition } from 'react';
import { deleteEntity } from '@/actions/entityActions';

export default function DeleteEntityButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setError('');
    startTransition(async () => {
      const result = await deleteEntity(id);
      if (!result.success) setError(result.message);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? '...' : 'Delete'}
      </button>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
