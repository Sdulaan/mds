import 'server-only';
import { jsPDF } from 'jspdf';
import autoTable, { type CellHookData } from 'jspdf-autotable';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { TRANSACTION_STATUSES, type TransactionStatus, type TransactionWithEntity } from '@/types';
import { summarize } from './summary';

type RGB = [number, number, number];

const VIOLET: RGB = [91, 33, 182];
const INK: RGB = [15, 23, 42];
const MUTED: RGB = [100, 116, 139];
const STATUS_COLOR: Record<TransactionStatus, RGB> = {
  PENDING: [180, 83, 9],
  CLEARED: [4, 120, 87],
  BOUNCED: [190, 18, 60],
};

// The built-in PDF fonts only cover Latin-1; replace anything else so text never renders as garbage.
function pdfText(value: string | null | undefined): string {
  if (!value) return '-';
  return value
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\xFF]/g, '?');
}

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

type Align = 'left' | 'center' | 'right';

/** Head/foot cells don't inherit columnStyles; align them with their column's body cells. */
function alignHeadFoot(aligns: Record<number, Align>) {
  return (data: CellHookData) => {
    if (data.section !== 'body') data.cell.styles.halign = aligns[data.column.index] ?? 'left';
  };
}

export function buildPdfReport(transactions: TransactionWithEntity[], filterLabel: string): Uint8Array {
  const summary = summarize(transactions);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, pageWidth, 3, 'F');

  doc.setTextColor(...VIOLET);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MDS PHARMACY', margin, 14);

  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Cheque Summary Report', margin, 19);

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pdfText(filterLabel), margin, 26);

  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Printed: ${formatDateTime(new Date())}`, pageWidth - margin, 26, { align: 'right' });

  // ── Stat boxes ─────────────────────────────────────────────────────────────
  const stats: { label: string; value: number; color: RGB }[] = [
    { label: `TOTAL (${summary.count})`, value: summary.total, color: INK },
    ...TRANSACTION_STATUSES.map((s) => ({
      label: `${s} (${summary.byStatus[s].count})`,
      value: summary.byStatus[s].amount,
      color: STATUS_COLOR[s],
    })),
  ];
  const gap = 4;
  const boxWidth = (pageWidth - margin * 2 - gap * (stats.length - 1)) / stats.length;
  stats.forEach((stat, i) => {
    const x = margin + i * (boxWidth + gap);
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, 31, boxWidth, 15, 2, 2, 'FD');
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(stat.label, x + 4, 37);
    doc.setTextColor(...stat.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`LKR ${formatNumber(stat.value)}`, x + 4, 43);
  });

  const tableBase = {
    theme: 'grid' as const,
    margin: { left: margin, right: margin, bottom: 14 },
    headStyles: { fillColor: VIOLET, textColor: [255, 255, 255] as RGB, fontSize: 8, fontStyle: 'bold' as const },
    bodyStyles: { textColor: INK, fontSize: 8, lineColor: [226, 232, 240] as RGB },
    alternateRowStyles: { fillColor: [248, 250, 252] as RGB },
    showFoot: 'lastPage' as const,
  };

  // ── Summary by type ────────────────────────────────────────────────────────
  const typeRow = (label: string, b: (s: TransactionStatus | 'ALL') => { count: number; amount: number }) => [
    label,
    ...[...TRANSACTION_STATUSES, 'ALL' as const].map((s) => `${formatNumber(b(s).amount)} (${b(s).count})`),
  ];
  autoTable(doc, {
    ...tableBase,
    startY: 51,
    head: [['', ...TRANSACTION_STATUSES.map(titleCase), 'Total']],
    body: [
      typeRow('Credits (received)', (s) => summary.byType.CREDIT[s]),
      typeRow('Debits (paid)', (s) => summary.byType.DEBIT[s]),
    ],
    foot: [typeRow('All', (s) => (s === 'ALL' ? { count: summary.count, amount: summary.total } : summary.byStatus[s]))],
    footStyles: { fillColor: [237, 233, 254], textColor: INK, fontSize: 8, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    didParseCell: alignHeadFoot({ 1: 'right', 2: 'right', 3: 'right', 4: 'right' }),
  });

  // ── Transactions ───────────────────────────────────────────────────────────
  autoTable(doc, {
    ...tableBase,
    startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
    head: [['Date', 'Entity', 'Type', 'Cheque No.', 'Amount (LKR)', 'Status', 'Cleared On', 'GRN No.', 'Remarks']],
    body: transactions.map((t) => [
      formatDate(t.cheque_date),
      pdfText(t.entity_name),
      t.transaction_type,
      pdfText(t.cheque_number),
      formatNumber(t.amount),
      t.status,
      t.cleared_at ? formatDate(t.cleared_at) : '-',
      pdfText(t.grn_number),
      pdfText(t.remarks),
    ]),
    foot: transactions.length ? [['', '', '', 'Total', formatNumber(summary.total), '', '', '', '']] : undefined,
    footStyles: { fillColor: [237, 233, 254], textColor: INK, fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'center', fontStyle: 'bold' },
      8: { cellWidth: 60 },
    },
    didParseCell: (data) => {
      alignHeadFoot({ 4: 'right', 5: 'center' })(data);
      if (data.section === 'body' && data.column.index === 5) {
        const color = STATUS_COLOR[data.cell.raw as TransactionStatus];
        if (color) data.cell.styles.textColor = color;
      }
    },
  });

  if (transactions.length === 0) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(10);
    doc.text('No transactions for this selection.', margin, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10);
  }

  // ── By entity ──────────────────────────────────────────────────────────────
  if (summary.byEntity.length > 0) {
    autoTable(doc, {
      ...tableBase,
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
      head: [['Entity', 'Type', 'Cheques', 'Pending', 'Cleared', 'Bounced', 'Total']],
      body: summary.byEntity.map((e) => [
        pdfText(e.name),
        e.type,
        String(e.count),
        formatNumber(e.pending),
        formatNumber(e.cleared),
        formatNumber(e.bounced),
        formatNumber(e.total),
      ]),
      columnStyles: {
        2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold' },
      },
      showHead: 'everyPage',
      didParseCell: alignHeadFoot({ 2: 'right', 3: 'right', 4: 'right', 5: 'right', 6: 'right' }),
    });
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${i} of ${pageCount} | MDS Pharmacy - Confidential`, pageWidth / 2, pageHeight - 6, {
      align: 'center',
    });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
