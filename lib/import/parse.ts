import 'server-only';
import ExcelJS from 'exceljs';
import type { ChequeStatus, TransactionType } from '@/types';

// Reads the company's monthly cheque workbooks ("Monthly Credit/Debit Cheques Summary"):
// one sheet per month with a header row (Deposit | Date | Debtor's Name | Chq No | Amount |
// Status | Credit | Remarks, or Debit | GRN No | Chq Date | Creditor's Name | …), dates only
// on the first row of each day, and "Total" rows between days. Summary / dashboard sheets are
// skipped. Any other sheet with a similar header row (Chq No + Amount + a name column) works too.

export interface ParsedCheque {
  sheet: string;
  row: number;
  type: TransactionType;
  entityName: string;
  chequeNumber: string;
  chequeDate: string; // YYYY-MM-DD
  amount: number;
  grnNumber: string | null;
  bankName: string | null;
  remarks: string | null;
  status: ChequeStatus;
}

export interface ParseIssue {
  sheet: string;
  row: number;
  message: string;
}

export interface ParseResult {
  cheques: ParsedCheque[];
  issues: ParseIssue[];
  sheets: { name: string; type: TransactionType | null; rows: number; skipped?: string }[];
}

type Raw = ExcelJS.CellValue;

/** Unwraps formulas, rich text and hyperlinks to a plain value. */
function plain(v: Raw): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== 'object') return v as string | number | boolean | Date;
  if ('result' in v) return plain((v as ExcelJS.CellFormulaValue).result as Raw);
  if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
  if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text);
  return null;
}

const str = (v: Raw) => {
  const p = plain(v);
  if (p === null) return '';
  if (p instanceof Date) return p.toISOString().slice(0, 10);
  return String(p).replace(/\s+/g, ' ').trim();
};

const bool = (v: Raw): boolean | null => {
  const p = plain(v);
  if (typeof p === 'boolean') return p;
  if (typeof p === 'string') {
    if (/^(true|yes|y|1|x)$/i.test(p.trim())) return true;
    if (/^(false|no|n|0)$/i.test(p.trim())) return false;
  }
  return null;
};

const pad = (n: number) => String(n).padStart(2, '0');

function toDateKey(v: Raw): string | null {
  const p = plain(v);
  if (p instanceof Date) return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}`;
  if (typeof p === 'number' && p > 20000 && p < 80000) {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + p * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (typeof p === 'string') {
    const iso = p.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
    const dmy = p.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // Sri Lankan format: DD/MM/YYYY
    if (dmy) return `${dmy[3]}-${pad(+dmy[2])}-${pad(+dmy[1])}`;
  }
  return null;
}

function toAmount(v: Raw): number | null {
  const p = plain(v);
  if (typeof p === 'number') return p;
  if (typeof p === 'string') {
    const n = Number(p.replace(/[,\s]|rs\.?|lkr/gi, ''));
    return isNaN(n) ? null : n;
  }
  return null;
}

type Field = 'deposit' | 'credit' | 'debit' | 'date' | 'name' | 'chequeNo' | 'amount' | 'status' | 'remarks' | 'grn' | 'bank';

const HEADER_PATTERNS: [Field, RegExp][] = [
  ['chequeNo', /^(chq|cheque)\s*(no|number|#)/i],
  ['grn', /grn/i],
  ['deposit', /^deposit/i],
  ['debit', /^debit$/i],
  ['credit', /^credit(ed)?$/i],
  ['date', /date/i],
  ['name', /name|debtor|creditor|customer|supplier|payee/i],
  ['amount', /amount|value/i],
  ['status', /status/i],
  ['remarks', /remark|note/i],
  ['bank', /bank/i],
];

function mapHeaders(row: ExcelJS.Row): Partial<Record<Field, number>> | null {
  const map: Partial<Record<Field, number>> = {};
  row.eachCell((cell, col) => {
    const h = str(cell.value);
    if (!h) return;
    const field = HEADER_PATTERNS.find(([, re]) => re.test(h))?.[0];
    if (field && map[field] === undefined) map[field] = col;
  });
  return map.chequeNo && map.amount && map.name ? map : null;
}

function detectType(row: ExcelJS.Row, map: Partial<Record<Field, number>>): TransactionType {
  const headers: string[] = [];
  row.eachCell((c) => headers.push(str(c.value).toLowerCase()));
  const text = headers.join(' ');
  if (map.debit || map.grn || /creditor|supplier/.test(text)) return 'DEBIT';
  return 'CREDIT';
}

/** Status rules derived from how the spreadsheets are used. */
function deriveStatus(
  type: TransactionType,
  f: { deposit: boolean | null; credit: boolean | null; debit: boolean | null; status: string; remarks: string }
): ChequeStatus {
  const status = f.status.toLowerCase();
  const remarks = f.remarks.toLowerCase();
  if (type === 'CREDIT') {
    if (/return|bounce|dishonou?r/.test(remarks) || /return/.test(status)) return 'RETURNED';
    if (/not\s*deposit/.test(status) || /not\s*deposit/.test(remarks)) return 'IN_HAND';
    if (f.credit === true || /credited|paid/.test(status)) return f.deposit === false ? 'IN_HAND' : 'CREDITED';
    if (f.deposit === true || /pending|deposited/.test(status)) return 'DEPOSITED';
    return 'IN_HAND';
  }
  if (/cancel/.test(remarks) || /cancel/.test(status)) return 'CANCELLED';
  if (f.debit === true || (/^cleared/.test(status) && f.debit !== false)) return 'CLEARED';
  return 'PENDING';
}

const SKIP_SHEETS = /summary|calc|dashboard|chart|pivot/i;
const TOTAL_ROW = /\btotal\b/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "APRIL - 2026" → "2026-04"; null when the sheet isn't named after a month. */
function monthFromSheetName(name: string): string | null {
  const m = name.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\W*(\d{4})\b/i);
  if (!m) return null;
  return `${m[2]}-${pad(MONTHS.indexOf(m[1].toLowerCase()) + 1)}`;
}

export async function parseWorkbook(buffer: ArrayBuffer, forceType?: TransactionType): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const result: ParseResult = { cheques: [], issues: [], sheets: [] };

  wb.eachSheet((ws) => {
    const name = ws.name.trim();
    if (SKIP_SHEETS.test(name)) {
      result.sheets.push({ name, type: null, rows: 0, skipped: 'summary sheet' });
      return;
    }

    let map: Partial<Record<Field, number>> | null = null;
    let headerRow = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 30) && !map; r++) {
      map = mapHeaders(ws.getRow(r));
      if (map) headerRow = r;
    }
    if (!map) {
      result.sheets.push({ name, type: null, rows: 0, skipped: 'no "Chq No / Amount / Name" header row' });
      return;
    }

    const type = forceType ?? detectType(ws.getRow(headerRow), map);
    const get = (row: ExcelJS.Row, f: Field) => (map![f] ? row.getCell(map![f]!).value : null);
    const sheetMonth = monthFromSheetName(name);
    let lastDate: string | null = null;
    let count = 0;
    let yearFixes = 0;

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      // "Total" (daily) and "Grand Total" rows — the label can sit in any of the leading columns.
      if ([str(row.getCell(1).value), str(get(row, 'name')), str(get(row, 'chequeNo'))].some((v) => TOTAL_ROW.test(v))) continue;

      let date = toDateKey(get(row, 'date'));
      // Year typos: a date in the sheet's month but another year (e.g. 2025-04-03 on "APRIL - 2026").
      if (date && sheetMonth && date.slice(5, 7) === sheetMonth.slice(5, 7) && date.slice(0, 4) !== sheetMonth.slice(0, 4)) {
        date = `${sheetMonth.slice(0, 4)}${date.slice(4)}`;
        yearFixes++;
      }
      if (date) lastDate = date; // dates appear only on the first row of each day

      const entityName = str(get(row, 'name'));
      const chequeNumber = str(get(row, 'chequeNo'));
      const amount = toAmount(get(row, 'amount'));
      if (!entityName && !chequeNumber && !amount) continue; // blank / template row

      const problems: string[] = [];
      if (!entityName) problems.push('name is missing');
      if (!chequeNumber) problems.push('cheque number is missing');
      if (!amount || amount <= 0) problems.push('amount is missing or zero');
      if (!lastDate) problems.push('no date found above this row');
      if (problems.length) {
        result.issues.push({ sheet: name, row: r, message: problems.join(', ') });
        continue;
      }

      const remarks = str(get(row, 'remarks'));
      result.cheques.push({
        sheet: name,
        row: r,
        type,
        entityName,
        chequeNumber,
        chequeDate: lastDate!,
        amount: Math.round(amount! * 100) / 100,
        grnNumber: str(get(row, 'grn')) || null,
        bankName: str(get(row, 'bank')) || null,
        remarks: remarks || null,
        status: deriveStatus(type, {
          deposit: bool(get(row, 'deposit')),
          credit: bool(get(row, 'credit')),
          debit: bool(get(row, 'debit')),
          status: str(get(row, 'status')),
          remarks,
        }),
      });
      count++;
    }

    if (yearFixes > 0) {
      result.issues.push({
        sheet: name,
        row: 0,
        message: `year corrected to ${sheetMonth!.slice(0, 4)} on ${yearFixes} date(s) to match the sheet name (imported — please check)`,
      });
    }
    result.sheets.push({ name, type, rows: count });
  });

  return result;
}
