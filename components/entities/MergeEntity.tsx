'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GitMerge } from 'lucide-react';
import { mergeEntity } from '@/actions/entityActions';
import { btnSecondary, cn, input } from '@/lib/ui';

interface MergeEntityProps {
  sourceId: string;
  sourceName: string;
  options: { id: string; name: string }[];
  basePath: string;
}

/** Admin tool for cleaning up duplicates created by typos (e.g. "Healthgurad" → "Healthguard"). */
export default function MergeEntity({ sourceId, sourceName, options, basePath }: MergeEntityProps) {
  const router = useRouter();
  const [target, setTarget] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const targetName = options.find((o) => o.id === target)?.name;

  const merge = () => {
    if (!target || !window.confirm(`Move every cheque and purchase from "${sourceName}" to "${targetName}", then delete "${sourceName}"?`)) return;
    startTransition(async () => {
      const r = await mergeEntity(sourceId, target);
      setMessage(r.message);
      if (r.success) router.push(`${basePath}/${target}`);
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Duplicate record? Merge it into the correct one. All its cheques and purchases move across.</p>
      <div className="flex gap-2">
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={cn(input, 'py-2')} aria-label="Merge into">
          <option value="">Merge into…</option>
          {options.filter((o) => o.id !== sourceId).map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        <button type="button" onClick={merge} disabled={!target || isPending} className={cn(btnSecondary, 'shrink-0 py-2')}>
          <GitMerge className="h-4 w-4" /> {isPending ? 'Merging…' : 'Merge'}
        </button>
      </div>
      {message && <p className="text-xs text-muted">{message}</p>}
    </div>
  );
}
