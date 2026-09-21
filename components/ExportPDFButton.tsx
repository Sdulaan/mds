'use client';

import { useCallback } from 'react';
import type { TransactionWithEntity } from '@/types';

interface ExportPDFButtonProps {
  transactions: TransactionWithEntity[];
  filterLabel: string;
}

function formatAmount(amount: string | number) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ExportPDFButton({ transactions, filterLabel }: ExportPDFButtonProps) {
  const handleExport = useCallback(async () => {
    // Dynamically import to avoid SSR issues
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const now = new Date();
    const printedAt = now.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    // ── Header ───────────────────────────────────────────────────────────────
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(167, 139, 250); // violet-400
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('MDS PHARMACY', 14, 11);

    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Monthly Cheque Summary Report', 14, 17);

    doc.setTextColor(226, 232, 240); // slate-200
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(filterLabel, 14, 24);

    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Printed: ${printedAt}`, pageWidth - 14, 24, { align: 'right' });

    // ── Summary Stats ─────────────────────────────────────────────────────────
    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const pending = transactions.filter((t) => t.status === 'PENDING').reduce((s, t) => s + Number(t.amount), 0);
    const cleared = transactions.filter((t) => t.status === 'CLEARED').reduce((s, t) => s + Number(t.amount), 0);
    const bounced = transactions.filter((t) => t.status === 'BOUNCED').reduce((s, t) => s + Number(t.amount), 0);

    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(14, 31, 62, 14, 2, 2, 'F');
    doc.roundedRect(80, 31, 62, 14, 2, 2, 'F');
    doc.roundedRect(146, 31, 62, 14, 2, 2, 'F');
    doc.roundedRect(212, 31, 62, 14, 2, 2, 'F');

    const statLabel = (x: number, label: string, value: string, color: [number, number, number]) => {
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(label, x + 4, 37);
      doc.setTextColor(...color);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(value, x + 4, 43);
    };

    statLabel(14, `TOTAL (${transactions.length})`, formatAmount(total), [226, 232, 240]);
    statLabel(80, 'PENDING', formatAmount(pending), [251, 191, 36]);
    statLabel(146, 'CLEARED', formatAmount(cleared), [52, 211, 153]);
    statLabel(212, 'BOUNCED', formatAmount(bounced), [248, 113, 113]);

    // ── Table ─────────────────────────────────────────────────────────────────
    const tableData = transactions.map((t) => [
      formatDate(t.cheque_date),
      t.entity_name,
      t.transaction_type,
      t.cheque_number,
      formatAmount(t.amount),
      t.status,
      t.grn_number || '—',
      t.remarks || '—',
    ]);

    autoTable(doc, {
      startY: 49,
      head: [['Date', 'Entity', 'Type', 'Cheque No.', 'Amount (LKR)', 'Status', 'GRN No.', 'Remarks']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [91, 33, 182], // violet-800
        textColor: [237, 233, 254], // violet-100
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      bodyStyles: {
        fillColor: [30, 41, 59], // slate-800
        textColor: [203, 213, 225], // slate-300
        fontSize: 8,
        cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      },
      alternateRowStyles: {
        fillColor: [15, 23, 42], // slate-900
      },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const status = data.cell.raw as string;
          const colors: Record<string, [number, number, number]> = {
            PENDING: [251, 191, 36],
            CLEARED: [52, 211, 153],
            BOUNCED: [248, 113, 113],
          };
          const c = colors[status] ?? colors.PENDING;
          doc.setTextColor(...c);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(
            status,
            data.cell.x + data.cell.width / 2,
            data.cell.y + data.cell.height / 2 + 1,
            { align: 'center' }
          );
          return false; // don't draw default text
        }
      },
      margin: { left: 14, right: 14 },
    });

    // ── Footer ────────────────────────────────────────────────────────────────
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Page ${i} of ${pageCount} | MDS Pharmacy - Confidential`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    const filename = `MDS_Cheques_${filterLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  }, [transactions, filterLabel]);

  return (
    <button
      id="export-pdf-btn"
      onClick={handleExport}
      disabled={transactions.length === 0}
      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-500 hover:shadow-violet-500/40 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export PDF
    </button>
  );
}
