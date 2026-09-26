'use client';

import { useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { alertError, alertSuccess, btnPrimary, btnSecondary, card, cn, input, label } from '@/lib/ui';

export default function BackupPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const restore = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.set('file', file);
    fd.set('confirm', confirm);
    try {
      const res = await fetch('/api/backup/restore', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ ok: true, text: `Restored ${data.counts.transactions.toLocaleString()} cheques, ${data.counts.entities.toLocaleString()} customers/creditors and ${data.counts.purchases.toLocaleString()} purchases.` });
      setConfirm('');
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Restore failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section className={`${card} p-5`}>
        <h2 className="mb-1 text-base font-semibold text-fg">Manual backup</h2>
        <p className="mb-4 text-sm text-muted">
          Download everything — customers, creditors, cheques, purchases, users (without passwords) and the activity log — as one file. Keep it somewhere safe.
        </p>
        <a href="/api/backup" download className={btnPrimary}>
          <Download className="h-4 w-4" /> Download backup
        </a>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-1 text-base font-semibold text-fg">Restore</h2>
        <p className="mb-4 text-sm text-muted">
          Replaces <strong className="text-fg">all</strong> customers, creditors, cheques and purchases with the contents of a backup file. User accounts are kept. This is recorded in the activity log.
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="bk-file" className={label}>Backup file (.json)</label>
            <input id="bk-file" type="file" accept=".json,application/json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={input} />
          </div>
          <div>
            <label htmlFor="bk-confirm" className={label}>Type RESTORE to confirm</label>
            <input id="bk-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={input} />
          </div>
          <button type="button" onClick={restore} disabled={!file || confirm !== 'RESTORE' || busy} className={cn(btnSecondary, 'text-bounced')}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Restore backup
          </button>
          {result && <div role="status" className={result.ok ? alertSuccess : alertError}>{result.text}</div>}
        </div>
      </section>
    </div>
  );
}
