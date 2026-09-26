import 'server-only';
import ExcelJS from 'exceljs';
import { formatDateTime } from '@/lib/dates';
import { TRANSACTION_STATUSES, type TransactionWithEntity } from '@/types';
import { summarize } from './summary';

const MONEY = '#,##0.00';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B21B6' } };
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };

/** 'YYYY-MM-DD' → a Date that Excel shows as that calendar day. */
function excelDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 20;
}

function styleTotal(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = TOTAL_FILL;
  });
}

export async function buildExcelReport(
  transactions: TransactionWithEntity[],
  filterLabel: string
): Promise<Uint8Array> {
  const summary = summarize(transactions);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MDS Pharmacy';
  wb.created = new Date();

  // ── Summary sheet ──────────────────────────────────────────────────────────
  const s = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
  s.columns = [
    { width: 32 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 18 },
  ];

  s.addRow(['MDS Pharmacy — Cheque Summary Report']).font = { bold: true, size: 16, color: { argb: 'FF5B21B6' } };
  s.addRow([filterLabel]).font = { bold: true, size: 12 };
  s.addRow([`Generated ${formatDateTime(new Date())}`]).font = { italic: true, color: { argb: 'FF64748B' } };
  s.addRow([]);

  styleHeader(s.addRow(['Status', 'Credits', 'Credit Amount', 'Debits', 'Debit Amount', 'Total', 'Total Amount']));
  for (const status of TRANSACTION_STATUSES) {
    const c = summary.byType.CREDIT[status];
    const d = summary.byType.DEBIT[status];
    const row = s.addRow([
      status.charAt(0) + status.slice(1).toLowerCase(),
      c.count, c.amount, d.count, d.amount,
      summary.byStatus[status].count, summary.byStatus[status].amount,
    ]);
    [3, 5, 7].forEach((i) => (row.getCell(i).numFmt = MONEY));
  }
  const all = s.addRow([
    'Total',
    summary.byType.CREDIT.ALL.count, summary.byType.CREDIT.ALL.amount,
    summary.byType.DEBIT.ALL.count, summary.byType.DEBIT.ALL.amount,
    summary.count, summary.total,
  ]);
  [3, 5, 7].forEach((i) => (all.getCell(i).numFmt = MONEY));
  styleTotal(all);

  s.addRow([]);
  s.addRow(['By Entity']).font = { bold: true, size: 12 };
  styleHeader(s.addRow(['Entity', 'Type', 'Cheques', 'Pending', 'Cleared', 'Bounced', 'Total']));
  for (const e of summary.byEntity) {
    const row = s.addRow([e.name, e.type, e.count, e.pending, e.cleared, e.bounced, e.total]);
    [4, 5, 6, 7].forEach((i) => (row.getCell(i).numFmt = MONEY));
  }
  if (summary.byEntity.length === 0) s.addRow(['No transactions for this selection.']);

  // ── Transactions sheet ─────────────────────────────────────────────────────
  const t = wb.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 1 }] });
  t.columns = [
    { header: 'Cheque Date', key: 'date', width: 13, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'Entity', key: 'entity', width: 30 },
    { header: 'Entity Type', key: 'entityType', width: 12 },
    { header: 'Type', key: 'type', width: 9 },
    { header: 'Cheque No.', key: 'cheque', width: 14 },
    { header: 'Amount (LKR)', key: 'amount', width: 16, style: { numFmt: MONEY } },
    { header: 'Status', key: 'status', width: 11 },
    { header: 'Cleared On', key: 'cleared', width: 13, style: { numFmt: 'dd-mmm-yyyy' } },
    { header: 'GRN No.', key: 'grn', width: 16 },
    { header: 'Remarks', key: 'remarks', width: 40 },
  ];
  styleHeader(t.getRow(1));

  for (const tx of transactions) {
    t.addRow({
      date: excelDate(tx.cheque_date),
      entity: tx.entity_name,
      entityType: tx.entity_type,
      type: tx.transaction_type,
      cheque: tx.cheque_number,
      amount: Number(tx.amount),
      status: tx.status,
      cleared: excelDate(tx.cleared_at),
      grn: tx.grn_number ?? '',
      remarks: tx.remarks ?? '',
    });
  }

  const lastDataRow = transactions.length + 1;
  if (transactions.length > 0) {
    t.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastDataRow, column: t.columns.length } };
    // SUBTOTAL(9, …) respects the auto-filter, so the total follows whatever the user filters in Excel.
    const totalRow = t.addRow({
      entity: 'Total (visible rows)',
      amount: { formula: `SUBTOTAL(9,F2:F${lastDataRow})`, result: summary.total },
    });
    styleTotal(totalRow);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
