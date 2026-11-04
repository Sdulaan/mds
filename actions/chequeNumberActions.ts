'use server';

import { revalidatePath } from 'next/cache';
import { query, sql } from '@/lib/db';
import { canEdit, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { todayKey } from '@/lib/dates';
import { isUuid } from '@/lib/filters';
import { FORBIDDEN, UNAUTHORIZED, optionalText, text } from '@/lib/forms';
import type { ActionResult } from '@/types';

const MAX_BATCH = 2000;

function revalidate() {
  revalidatePath('/blank-cheques');
  revalidatePath('/cheques/new');
  revalidatePath('/payables');
}

const usedOnCheque = async (numbers: string[]) =>
  (await query(
    `SELECT DISTINCT cheque_number FROM transactions WHERE transaction_type = 'DEBIT' AND cheque_number = ANY($1::text[])`,
    [numbers]
  )).map((r) => r.cheque_number as string);

/**
 * Bulk-generate cheque numbers: a start number plus either an end number or the number of cheques
 * received (several books at once). The start number's length is kept, so 005830 → 005831 …
 * The whole batch is refused if any number is already registered or used, so duplicates never get in.
 */
export async function generateChequeNumbers(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  const start = text(formData, 'start', 18);
  if (!/^\d+$/.test(start)) return { success: false, message: 'Enter the starting cheque number using digits only, e.g. 005830.' };
  const mode = text(formData, 'mode', 10) === 'count' ? 'count' : 'end';

  let total: number;
  if (mode === 'count') {
    const raw = text(formData, 'count', 10);
    if (!/^\d+$/.test(raw) || Number(raw) < 1) return { success: false, message: 'Enter the total number of cheques received (1 or more).' };
    total = Number(raw);
  } else {
    const end = text(formData, 'end', 18);
    if (!/^\d+$/.test(end)) return { success: false, message: 'Enter the ending cheque number using digits only, e.g. 005880.' };
    const diff = BigInt(end) - BigInt(start);
    if (diff < BigInt(0)) return { success: false, message: 'The ending number must not be lower than the starting number.' };
    if (diff >= BigInt(MAX_BATCH)) return { success: false, message: `Generate at most ${MAX_BATCH.toLocaleString()} cheque numbers at a time.` };
    total = Number(diff) + 1;
  }
  if (total > MAX_BATCH) return { success: false, message: `Generate at most ${MAX_BATCH.toLocaleString()} cheque numbers at a time.` };

  const width = start.length;
  const first = BigInt(start);
  const numbers = Array.from({ length: total }, (_, i) => (first + BigInt(i)).toString().padStart(width, '0'));
  const bank = optionalText(formData, 'bank_name', 100);
  const label = `${numbers[0]}${total > 1 ? ` – ${numbers[total - 1]}` : ''}`;

  try {
    const existing = (await query('SELECT cheque_number FROM cheque_numbers WHERE cheque_number = ANY($1::text[])', [numbers])).map((r) => r.cheque_number as string);
    const conflicts = [...new Set([...existing, ...(await usedOnCheque(numbers))])].sort();
    if (conflicts.length) {
      const shown = conflicts.slice(0, 8).join(', ') + (conflicts.length > 8 ? ` and ${conflicts.length - 8} more` : '');
      return { success: false, message: `Nothing was generated. ${conflicts.length} of these numbers already exist: ${shown}. Change the range and try again.` };
    }
    await query(
      `INSERT INTO cheque_numbers (cheque_number, bank_name, created_by)
       SELECT n, $2, $3 FROM UNNEST($1::text[]) AS n`,
      [numbers, bank, user.id]
    );
    await logAudit({ table: 'system', action: 'CREATE', user, summary: `Generated ${total} cheque numbers (${label})${bank ? ` — ${bank}` : ''}` });
    revalidate();
    return { success: true, message: `${total.toLocaleString()} cheque number${total === 1 ? '' : 's'} generated: ${label}.` };
  } catch (error) {
    console.error('[generateChequeNumbers]', error);
    return { success: false, message: 'Failed to generate the cheque numbers. Please try again.' };
  }
}

/**
 * Record a blank cheque: a cheque number handed to a creditor before its date and amount are known.
 * The number may come from the generated pool or be typed (it is then registered too).
 */
export async function issueBlankCheque(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  const entityId = text(formData, 'entity_id', 36);
  if (!isUuid(entityId)) return { success: false, message: 'Please select a creditor.' };
  const number = text(formData, 'cheque_number', 100);
  if (!number) return { success: false, message: 'Cheque number is required.' };
  const bank = optionalText(formData, 'bank_name', 100);

  try {
    const entity = (await sql`SELECT name, type, is_active FROM entities WHERE id = ${entityId}`)[0];
    if (!entity || entity.type !== 'VENDOR') return { success: false, message: 'Please select a creditor.' };
    if (!entity.is_active) return { success: false, message: `${entity.name} is inactive. Reactivate it first.` };

    if ((await usedOnCheque([number])).length) {
      return { success: false, message: `Cheque ${number} has already been added as a creditor cheque.` };
    }
    const row = (await sql`
      SELECT cn.id, cn.entity_id, e.name AS entity_name FROM cheque_numbers cn
      LEFT JOIN entities e ON e.id = cn.entity_id WHERE cn.cheque_number = ${number}`)[0];
    if (row?.entity_id) return { success: false, message: `Cheque ${number} is already recorded as a blank cheque for ${row.entity_name}.` };

    if (row) {
      await sql`UPDATE cheque_numbers SET entity_id = ${entityId}, issued_date = ${todayKey()}, bank_name = COALESCE(${bank}, bank_name) WHERE id = ${row.id}`;
    } else {
      await sql`INSERT INTO cheque_numbers (cheque_number, bank_name, entity_id, issued_date, created_by)
                VALUES (${number}, ${bank}, ${entityId}, ${todayKey()}, ${user.id})`;
    }
    await logAudit({ table: 'system', action: 'CREATE', user, summary: `Recorded blank cheque ${number} for ${entity.name}` });
    revalidate();
    return { success: true, message: `Blank cheque ${number} recorded for ${entity.name}.` };
  } catch (error) {
    console.error('[issueBlankCheque]', error);
    return { success: false, message: 'Failed to record the blank cheque. Please try again.' };
  }
}

/** Take a blank cheque back out of the register (the number returns to the available pool). */
export async function releaseBlankCheque(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!isUuid(id)) return { success: false, message: 'Cheque not found.' };
  try {
    const row = (await sql`SELECT cheque_number, created_by FROM cheque_numbers WHERE id = ${id}`)[0];
    if (!row) return { success: false, message: 'Cheque not found.' };
    if (!canEdit(user, row.created_by)) return FORBIDDEN;
    await sql`UPDATE cheque_numbers SET entity_id = NULL, issued_date = NULL WHERE id = ${id}`;
    await logAudit({ table: 'system', action: 'UPDATE', user, summary: `Removed blank cheque ${row.cheque_number} from the register` });
    revalidate();
    return { success: true, message: 'Removed from the blank-cheque register.' };
  } catch (error) {
    console.error('[releaseBlankCheque]', error);
    return { success: false, message: 'Failed to update the register.' };
  }
}
