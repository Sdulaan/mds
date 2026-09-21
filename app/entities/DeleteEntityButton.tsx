'use client';

import { useTransition } from 'react';
import { deleteEntity } from '@/actions/entityActions';

export default function DeleteEntityButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    startTransition(() => {
      deleteEntity(id);
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? '...' : 'Delete'}
    </button>
  );
}
