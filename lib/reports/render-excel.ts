import 'server-only';
import ExcelJS from 'exceljs';
import { COMPANY } from '@/lib/company';
import { formatDateTime } from '@/lib/dates';
import { STATUS_LABEL, type ChequeStatus } from '@/types';
import { LOGO_ASPECT, LOGO_PNG_BASE64 } from './logoData';
import { columnLabel } from './columns';
import type { Cell, Column, ReportData } from './types';

// Letterhead palette
const GREEN = 'FF168A43';
const INK = 'FF132B3F';
const BLACK = 'FF000000';
const MUTED = 'FF53667A';
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const MONEY = '#,##0.00';

/** 'YYYY-MM-DD' → a Date that Excel shows as that calendar day. */
function excelDate(v: string): Date {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function cellValue(value: Cell, col: Column): ExcelJS.CellValue {
  if (value === null || value === undefined || value === '') return null;
  if (col.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return excelDate(value);
  if (col.type === 'status') return STATUS_LABEL[value as ChequeStatus] ?? value;
  return value;
}

export async function renderExcel(report: ReportData, username: string): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY.legalName;
  wb.company = COMPANY.legalName;
  wb.created = new Date();

  const ws = wb.addWorksheet('Report', {
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  const widest = Math.max(...report.sections.map((s) => s.columns.length), 4);

  // ── Letterhead ─────────────────────────────────────────────────────────────
  const logoId = wb.addImage({ base64: LOGO_PNG_BASE64, extension: 'png' });
  ws.addImage(logoId, { tl: { col: 0.1, row: 0.2 }, ext: { width: Math.round(70 * LOGO_ASPECT), height: 70 } });
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 15;
  [COMPANY.legalName, COMPANY.address, `${COMPANY.phone} | ${COMPANY.email}`].forEach((text, i) => {
    const cell = ws.getCell(i + 1, widest);
    cell.value = text;
    cell.alignment = { horizontal: 'right' };
    cell.font = { size: 9, color: { argb: INK }, bold: i === 0 };
  });

  // ── Title block: company, report title, generated date/time, user ────────
  ws.getCell(6, 1).value = report.title;
  ws.getCell(6, 1).font = { bold: true, size: 15, color: { argb: BLACK } };
  ws.getCell(7, 1).value = report.subtitle;
  ws.getCell(7, 1).font = { bold: true, size: 11, color: { argb: INK } };
  ws.getCell(8, 1).value = `Generated ${formatDateTime(new Date())} by ${username}`;
  ws.getCell(8, 1).font = { italic: true, size: 9, color: { argb: MUTED } };

  let r = 10;
  for (const s of report.summary) {
    ws.getCell(r, 1).value = s.label;
    ws.getCell(r, 1).font = { color: { argb: MUTED } };
    ws.getCell(r, 2).value = s.value;
    ws.getCell(r, 2).font = { bold: true, color: { argb: INK } };
    r++;
  }
  r++;

  // ── Sections ───────────────────────────────────────────────────────────────
  const widths: number[] = Array(widest).fill(12);
  for (const section of report.sections) {
    if (section.rows.length === 0) continue;
    if (section.title) {
      ws.getCell(r, 1).value = section.title;
      ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: BLACK } };
      r++;
    }
    const header = ws.getRow(r);
    section.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = columnLabel(c);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = fill(GREEN);
      cell.alignment = { horizontal: c.type === 'money' || c.type === 'number' ? 'right' : 'left', vertical: 'middle' };
      widths[i] = Math.max(widths[i], columnLabel(c).length + 2);
    });
    header.height = 18;
    r++;

    for (const row of section.rows) {
      const xr = ws.getRow(r);
      section.columns.forEach((c, i) => {
        const cell = xr.getCell(i + 1);
        cell.value = cellValue(row.cells[c.key] ?? null, c);
        if (c.type === 'money') cell.numFmt = MONEY;
        if (c.type === 'date') cell.numFmt = 'dd-mmm-yyyy';
        if (c.type === 'money' || c.type === 'number') cell.alignment = { horizontal: 'right' };
        if (row.kind === 'subtotal' || row.kind === 'total') {
          cell.font = { bold: true, color: { argb: INK } };
          cell.fill = fill(row.kind === 'total' ? 'FFCDEAD6' : 'FFE6F5EB');
        }
        const len = c.type === 'money' ? 16 : c.type === 'date' ? 13 : String(cell.value ?? '').length + 2;
        widths[i] = Math.min(Math.max(widths[i], len), 48);
      });
      r++;
    }
    r++;
  }
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
