'use client';

import { useRef, useState } from 'react';
import { Eye, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react';
import { btnSecondary, cn } from '@/lib/ui';

interface ReportActionsProps {
  /** Report slug, e.g. 'customer-cheques' → /api/reports/customer-cheques/{pdf|excel} */
  slug: string;
  /** Query string with the report's filters/parameters (no leading '?'). */
  query: string;
  disabled?: boolean;
}

// SRS §9: every report exports to PDF and Excel, with print preview and direct print.
export default function ReportActions({ slug, query, disabled = false }: ReportActionsProps) {
  const [printing, setPrinting] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const url = (format: 'pdf' | 'excel', extra = '') => {
    const qs = [query, extra].filter(Boolean).join('&');
    return `/api/reports/${slug}/${format}${qs ? `?${qs}` : ''}`;
  };

  // Direct print: load the PDF in a hidden frame and open the print dialog.
  const directPrint = () => {
    setPrinting(true);
    frame.current?.remove();
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.src = url('pdf', 'inline=1');
    iframe.onload = () => {
      setPrinting(false);
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(iframe.src, '_blank'); // fall back to the preview if the browser blocks frame printing
      }
    };
    document.body.appendChild(iframe);
    frame.current = iframe;
  };

  const off = disabled ? 'pointer-events-none opacity-50' : '';
  const btn = cn(btnSecondary, 'py-2');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={url('excel')} download aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} className={`${btn} ${off}`}>
        <FileSpreadsheet className="h-4 w-4 text-cleared" /> Excel
      </a>
      <a href={url('pdf')} download aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} className={`${btn} ${off}`}>
        <FileText className="h-4 w-4 text-bounced" /> PDF
      </a>
      <a
        href={url('pdf', 'inline=1')}
        target="_blank"
        rel="noopener"
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : undefined}
        className={`${btn} ${off}`}
        title="Open a print preview in a new tab"
      >
        <Eye className="h-4 w-4 text-credit" /> Preview
      </a>
      <button type="button" onClick={directPrint} disabled={disabled || printing} className={btn} title="Print directly">
        {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 text-muted" />} Print
      </button>
    </div>
  );
}
