import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import SortHeader from '@/components/SortHeader';
import StatusBadge from '@/components/StatusBadge';
import { formatDate } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { columnLabel } from '@/lib/reports/columns';
import type { Sort } from '@/lib/sort';
import { card, cn, td, th } from '@/lib/ui';
import type { ChequeStatus } from '@/types';
import type { Cell, Column, ReportData } from '@/lib/reports/types';

function display(value: Cell, col: Column) {
  if (value === null || value === undefined || value === '') return <span className="text-subtle">{col.type === 'money' || col.type === 'number' ? '' : '—'}</span>;
  switch (col.type) {
    case 'money':
      return typeof value === 'number' ? formatNumber(value) : value;
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value;
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? formatDate(String(value)) : value;
    case 'status':
      return <StatusBadge status={value as ChequeStatus} />;
    default:
      return value;
  }
}

const MAX_PREVIEW_ROWS = 400;

interface ReportViewProps {
  report: ReportData;
  sort: Sort;
  /** Header link that sorts by a column (keeps the report parameters). */
  sortHref: (key: string) => string;
  /** Link back to the report's own order, when a sort is applied. */
  resetHref?: string;
}

/** On-screen preview of a report (the PDF / Excel downloads contain everything, in the same order). */
export default function ReportView({ report, sort, sortHref, resetHref }: ReportViewProps) {
  let shown = 0;
  const empty = report.sections.every((s) => s.rows.every((r) => r.kind === 'total'));

  return (
    <div className="space-y-5">
      {report.summary.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {report.summary.map((s) => (
            <div key={s.label} className={`${card} p-4`}>
              <p className="text-xs font-medium uppercase tracking-wide text-subtle">{s.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-fg">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {resetHref && !empty && (
        <p className="flex items-center justify-end gap-2 text-xs text-muted">
          Sorted by {report.sections.flatMap((s) => s.columns).find((c) => c.key === sort.sort)?.label ?? sort.sort}, {sort.dir === 'asc' ? 'ascending' : 'descending'} — subtotals and totals stay in place.
          <Link href={resetHref} scroll={false} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
            <RotateCcw className="h-3 w-3" /> Default order
          </Link>
        </p>
      )}

      {empty ? (
        <p className={`${card} py-16 text-center text-sm text-subtle`}>No records match the selected options.</p>
      ) : (
        report.sections.map((section, i) => {
          if (section.rows.length === 0 || shown >= MAX_PREVIEW_ROWS) return null;
          const rows = section.rows.slice(0, Math.max(0, MAX_PREVIEW_ROWS - shown));
          shown += rows.length;
          return (
            <section key={i} className={`${card} overflow-hidden`}>
              {section.title && <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-fg">{section.title}</h3>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface-2">
                      {section.columns.map((c) => section.noSort ? (
                        <th key={c.key} className={cn(th, (c.type === 'money' || c.type === 'number') && 'text-right')}>{columnLabel(c)}</th>
                      ) : (
                        <SortHeader
                          key={c.key}
                          label={columnLabel(c)}
                          column={c.key}
                          current={sort}
                          href={sortHref(c.key)}
                          align={c.type === 'money' || c.type === 'number' ? 'right' : 'left'}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row, j) => (
                      <tr
                        key={j}
                        className={row.kind === 'total' ? 'bg-brand-soft font-semibold' : row.kind === 'subtotal' ? 'bg-surface-2 font-medium' : undefined}
                      >
                        {section.columns.map((c) => (
                          <td
                            key={c.key}
                            className={`${td} py-2 ${c.type === 'money' || c.type === 'number' ? 'whitespace-nowrap text-right tabular-nums' : ''} ${
                              c.type === 'date' ? 'whitespace-nowrap' : ''
                            } text-fg`}
                          >
                            {display(row.cells[c.key] ?? null, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
      {shown >= MAX_PREVIEW_ROWS && (
        <p className="text-center text-sm text-muted">Preview limited to {MAX_PREVIEW_ROWS} rows — download the PDF or Excel file for the full report.</p>
      )}
    </div>
  );
}
