import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';

// Read-only data access for the cheque number pool and the blank-cheque register.
// A number is "assigned" once a creditor cheque with that number exists in transactions.

const UNASSIGNED = `NOT EXISTS (SELECT 1 FROM transactions t WHERE t.transaction_type = 'DEBIT' AND t.cheque_number = cn.cheque_number)`;

export interface ChequeNumberRow {
  id: string;
  cheque_number: string;
  bank_name: string | null;
  entity_id: string | null;
  entity_name: string | null;
  issued_date: string | null;
  created_at: string;
  created_by_name: string | null;
}

async function unassigned(extra: string): Promise<ChequeNumberRow[]> {
  await requireUser();
  return (await query(
    `SELECT cn.id, cn.cheque_number, cn.bank_name, cn.entity_id, e.name AS entity_name,
            cn.issued_date::text, cn.created_at::text, u.username AS created_by_name
     FROM cheque_numbers cn
     LEFT JOIN entities e ON e.id = cn.entity_id
     LEFT JOIN users u ON u.id = cn.created_by
     WHERE ${UNASSIGNED} ${extra}
     ORDER BY cn.cheque_number`
  )) as ChequeNumberRow[];
}

/** Blank cheques: issued to a creditor, still without a cheque date and amount. */
export const getBlankCheques = () => unassigned('AND cn.entity_id IS NOT NULL');

/** Every registered number not yet used on a creditor cheque (blank or still in stock). */
export const getAvailableNumbers = () => unassigned('');

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
