import { FileSpreadsheet, FileText } from 'lucide-react';
import { filtersToQuery } from '@/lib/filters';
import type { TransactionFilters } from '@/types';

interface ExportButtonsProps {
  filters: TransactionFilters;
  disabled?: boolean;
}

// Plain download links to the authenticated report route handlers.
export default function ExportButtons({ filters, disabled = false }: ExportButtonsProps) {
  const qs = filtersToQuery(filters);
  const href = (format: 'pdf' | 'excel') => `/api/reports/${format}${qs ? `?${qs}` : ''}`;

  const base =
    'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all active:scale-95';
  const disabledClass = 'pointer-events-none opacity-40';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={href('excel')}
        download
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        className={`${base} bg-gradient-to-r from-emerald-600 to-green-600 shadow-emerald-500/20 hover:from-emerald-500 hover:to-green-500 ${disabled ? disabledClass : ''}`}
      >
        <FileSpreadsheet className="h-4 w-4" />
        Export Excel
      </a>
      <a
        href={href('pdf')}
        download
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        className={`${base} bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500 ${disabled ? disabledClass : ''}`}
      >
        <FileText className="h-4 w-4" />
        Export PDF
      </a>
    </div>
  );
}
