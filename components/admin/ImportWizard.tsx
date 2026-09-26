'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import { alertError, alertSuccess, btnPrimary, btnSecondary, card, cn, input, label } from '@/lib/ui';
import { STATUS_LABEL, type ChequeStatus, type EntityType, type TransactionType } from '@/types';

interface Summary {
  fileName: string;
  sheets: { name: string; type: TransactionType | null; rows: number; skipped?: string }[];
  issues: { sheet: string; row: number; message: string }[];
  issueCount: number;
  parsed: number;
  toImport: number;
  skippedExisting: number;
  skippedInFile: number;
  byStatus: Partial<Record<ChequeStatus, { count: number; amount: number }>>;
  byType: Record<TransactionType, { count: number; amount: number }>;
  newEntities: { name: string; type: EntityType }[];
}

export default function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('auto');
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [done, setDone] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  const send = async (mode: 'preview' | 'import') => {
    if (!file) return;
    setBusy(mode);
    setError('');
    const fd = new FormData();
    fd.set('file', file);
    fd.set('type', type);
    fd.set('mode', mode);
    try {
      const res = await fetch('/api/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Import failed.');
      if (data.imported) {
        setDone(data.summary);
        setSummary(null);
        setFile(null);
      } else setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className={`${card} p-5`}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_16rem_auto] md:items-end">
          <div>
            <label htmlFor="imp-file" className={label}>Excel workbook (.xlsx)</label>
            <input
              id="imp-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setSummary(null);
                setDone(null);
                setError('');
              }}
              className={cn(input, 'file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand')}
            />
          </div>
          <div>
            <label htmlFor="imp-type" className={label}>Cheque type</label>
            <select id="imp-type" value={type} onChange={(e) => { setType(e.target.value); setSummary(null); }} className={input}>
              <option value="auto">Detect from headers</option>
              <option value="CREDIT">Customer cheques (credit)</option>
              <option value="DEBIT">Creditor cheques (debit)</option>
            </select>
          </div>
          <button type="button" onClick={() => send('preview')} disabled={!file || !!busy} className={btnSecondary}>
            {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Preview
          </button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Reads the monthly cheque workbooks (one sheet per month, &ldquo;Chq No&rdquo; header row, dates on the first row of each day).
          Summary and dashboard sheets are skipped. Nothing is saved until you confirm. Re-importing the same file is safe — cheques already in the system are skipped.
        </p>
      </section>

      {error && <div role="alert" className={alertError}>{error}</div>}

      {done && (
        <div role="status" className={cn(alertSuccess, 'flex items-start gap-3')}>
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Imported {done.toImport.toLocaleString()} cheques from {done.fileName}.</p>
            <p>
              {done.newEntities.length} new customers/creditors created.{' '}
              <Link href="/receivables" className="underline">Customer cheques</Link> · <Link href="/payables" className="underline">Creditor cheques</Link> ·{' '}
              <Link href="/customers" className="underline">Review names</Link> (use Merge to fix spelling variations).
            </p>
          </div>
        </div>
      )}

      {summary && (
        <section className={`${card} space-y-5 p-5`}>
          <h2 className="text-base font-semibold text-fg">Preview — {summary.fileName}</h2>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Cheques to import" value={summary.toImport.toLocaleString()} />
            <Stat label="Customer cheques" value={`${summary.byType.CREDIT.count.toLocaleString()} · ${formatAmount(summary.byType.CREDIT.amount)}`} />
            <Stat label="Creditor cheques" value={`${summary.byType.DEBIT.count.toLocaleString()} · ${formatAmount(summary.byType.DEBIT.amount)}`} />
            <Stat label="New customers / creditors" value={summary.newEntities.length.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-fg">Statuses</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(summary.byStatus).map(([s, v]) => (
                  <li key={s} className="flex justify-between gap-3">
                    <span className="text-muted">{STATUS_LABEL[s as ChequeStatus]}</span>
                    <span className="tabular-nums text-fg">{v!.count.toLocaleString()} · {formatAmount(v!.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-subtle">
                &ldquo;Returned&rdquo; and &ldquo;Cancelled&rdquo; come from the Remarks column; &ldquo;Not Deposited&rdquo; rows import as In Hand.
                Status dates aren&apos;t in the sheets, so the cheque date is used.
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-fg">Sheets</h3>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {summary.sheets.map((s) => (
                  <li key={s.name} className="flex justify-between gap-3">
                    <span className="truncate text-muted">{s.name}</span>
                    <span className="shrink-0 text-fg">{s.skipped ? <span className="text-subtle">skipped — {s.skipped}</span> : `${s.rows} rows · ${s.type === 'CREDIT' ? 'customer' : 'creditor'}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {(summary.skippedExisting > 0 || summary.skippedInFile > 0) && (
            <p className="text-sm text-muted">
              Skipping {summary.skippedExisting.toLocaleString()} already in the system and {summary.skippedInFile.toLocaleString()} exact repeats within the file.
            </p>
          )}

          {summary.newEntities.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-fg">New customers / creditors that will be created ({summary.newEntities.length})</summary>
              <p className="mt-2 max-h-40 overflow-y-auto text-muted">{summary.newEntities.map((e) => e.name).join(' · ')}</p>
            </details>
          )}

          {summary.issueCount > 0 && (
            <details className="text-sm" open={summary.issueCount < 20}>
              <summary className="flex cursor-pointer items-center gap-2 font-medium text-pending">
                <AlertTriangle className="h-4 w-4" /> {summary.issueCount} row(s) will be skipped because they are incomplete
              </summary>
              <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted">
                {summary.issues.map((i, k) => <li key={k}>{i.sheet}, row {i.row}: {i.message}</li>)}
              </ul>
            </details>
          )}

          <button type="button" onClick={() => send('import')} disabled={!!busy || summary.toImport === 0} className={btnPrimary}>
            {busy === 'import' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import {summary.toImport.toLocaleString()} cheques
          </button>
        </section>
      )}
    </div>
  );
}

function Stat({ label: text, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-xs text-subtle">{text}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-fg">{value}</p>
    </div>
  );
}
