import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';

// Read-only data access for the cheque number pool and the blank-cheque register.
// A number is "assigned" once a creditor cheque with that number exists in transactions.
// Cancelled numbers are excluded from everything except the cancelled list.

export interface ChequeNumberRow {
  id: string;
  cheque_number: string;
  bank_name: string | null;
  entity_id: string | null;
  entity_name: string | null;
  issued_date: string | null;
  created_at: string;
  created_by_name: string | null;
  /** First number of the 50-cheque book this number belongs to (null for hand-typed numbers). */
  book_start: string | null;
  /** How many numbers the whole book holds (used or not). */
  book_size: number;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

async function numbers(where: string): Promise<ChequeNumberRow[]> {
  await requireUser();
  return (await query(
    `SELECT * FROM (
       SELECT cn.id, cn.cheque_number, cn.bank_name, cn.entity_id, e.name AS entity_name,
              cn.issued_date::text, cn.created_at::text, u.username AS created_by_name,
              cn.book_start, COUNT(*) OVER (PARTITION BY cn.book_start)::int AS book_size,
              cn.cancelled_at::text, cn.cancel_reason
       FROM cheque_numbers cn
       LEFT JOIN entities e ON e.id = cn.entity_id
       LEFT JOIN users u ON u.id = cn.created_by
     ) cn
     WHERE ${where}
     ORDER BY cn.cheque_number`
  )) as ChequeNumberRow[];
}

const FREE = `cn.cancelled_at IS NULL AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.transaction_type = 'DEBIT' AND t.cheque_number = cn.cheque_number)`;

/** Blank cheques: issued to a creditor, still without a cheque date and amount. */
export const getBlankCheques = () => numbers(`${FREE} AND cn.entity_id IS NOT NULL`);

/** Every registered number not yet used on a creditor cheque and not cancelled (blank or still in stock). */
export const getAvailableNumbers = () => numbers(FREE);

/** Cancelled cheque numbers (kept for the audit trail; they can be restored). */
export const getCancelledNumbers = () => numbers(`cn.cancelled_at IS NOT NULL`);

export interface ChequeBook {
  /** First number of the book, e.g. 008681. */
  start: string;
  /** Cheques in the book (normally 50). */
  size: number;
  /** Unused runs inside the book. A fresh book is one run covering the whole book. */
  ranges: { from: string; to: string; count: number }[];
  left: number;
  numbers: ChequeNumberRow[];
}

/** Groups stock into cheque books of 50 so back-to-back books (008681–008730, 008731–008780) stay separate. */
export function toBooks(stock: ChequeNumberRow[]): ChequeBook[] {
  const groups = new Map<string, ChequeNumberRow[]>();
  for (const n of stock) {
    const key = n.book_start ?? `single:${n.cheque_number}`;
    const list = groups.get(key);
    if (list) list.push(n);
    else groups.set(key, [n]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      start: key.startsWith('single:') ? list[0].cheque_number : key,
      size: key.startsWith('single:') ? 1 : list[0].book_size,
      ranges: toRanges(list.map((n) => n.cheque_number)),
      left: list.length,
      numbers: list,
    }))
    .sort((a, b) => (a.start.length - b.start.length) || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/** Collapses sorted numbers into runs, e.g. 005830–005880 (51), so a generated book reads as one line. */
export function toRanges(numbers: string[]): { from: string; to: string; count: number }[] {
  const ranges: { from: string; to: string; count: number; next: bigint | null; width: number }[] = [];
  for (const n of numbers) {
    const last = ranges[ranges.length - 1];
    const value = /^\d{1,18}$/.test(n) ? BigInt(n) : null;
    if (last && value !== null && last.next === value && last.width === n.length) {
      last.to = n;
      last.count++;
      last.next = value + BigInt(1);
    } else {
      ranges.push({ from: n, to: n, count: 1, next: value === null ? null : value + BigInt(1), width: n.length });
    }
  }
  return ranges.map(({ from, to, count }) => ({ from, to, count }));
}
