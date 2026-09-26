import { History } from 'lucide-react';
import { getRecordHistory } from '@/lib/data/admin';
import { formatDateTime } from '@/lib/dates';
import { card } from '@/lib/ui';
import type { AuditColumns } from '@/types';

const FIELD_LABEL: Record<string, string> = {
  entity_id: 'Customer / creditor',
  cheque_number: 'Cheque no.',
  cheque_date: 'Cheque date',
  bank_name: 'Bank',
  grn_number: 'GRN no.',
  entry_date: 'Entry date',
  deposited_date: 'Deposited',
  cleared_date: 'Credited / cleared',
  returned_date: 'Returned',
  cancelled_date: 'Cancelled',
  contact_number: 'Contact no.',
  credit_terms: 'Credit terms',
  opening_balance: 'Opening balance',
  invoice_number: 'Invoice no.',
  purchase_date: 'Purchase date',
  is_active: 'Active',
};

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

/** SRS §8: created/modified by and when, plus every recorded change. */
export default async function RecordHistory({ table, record }: { table: string; record: AuditColumns & { id: string } }) {
  const history = await getRecordHistory(table, record.id);

  return (
    <section className={`${card} p-5`}>
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-fg">
        <History className="h-4 w-4 text-brand" /> Audit trail
      </h2>
      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-subtle">Created by</dt>
          <dd className="font-medium text-fg">{record.created_by_name ?? 'Imported / system'}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Created</dt>
          <dd className="text-fg">{formatDateTime(record.created_at)}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Modified by</dt>
          <dd className="font-medium text-fg">{record.updated_by_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Modified</dt>
          <dd className="text-fg">{record.updated_at ? formatDateTime(record.updated_at) : '—'}</dd>
        </div>
      </dl>

      {history.length === 0 ? (
        <p className="text-sm text-subtle">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-3 border-l border-line pl-4">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-brand" />
              <p className="text-sm text-fg">{h.summary}</p>
              <p className="text-xs text-subtle">
                {h.username ?? 'system'} · {formatDateTime(h.created_at)}
              </p>
              {h.changes && h.action === 'UPDATE' && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted">
                  {Object.entries(h.changes).map(([field, c]) => (
                    <li key={field}>
                      {FIELD_LABEL[field] ?? field.replace(/_/g, ' ')}: <span className="line-through">{show(c.from)}</span> → {show(c.to)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
