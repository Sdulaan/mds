'use server';

import { revalidatePath } from 'next/cache';
import { query, sql, transaction } from '@/lib/db';
import { canEdit, getCurrentUser } from '@/lib/auth';
import { diff, logAudit } from '@/lib/audit';
import { todayKey } from '@/lib/dates';
import { isUuid } from '@/lib/filters';
import { FORBIDDEN, UNAUTHORIZED, optionalText, text } from '@/lib/forms';
import type { ActionResult } from '@/types';

const MAX_BATCH = 2000;
/** Every cheque book holds 50 cheques; generated ranges are cut into separate books of 50. */
const BOOK_SIZE = 50;

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
    const books = numbers.map((_, i) => numbers[i - (i % BOOK_SIZE)]);
    await query(
      `INSERT INTO cheque_numbers (cheque_number, book_start, bank_name, created_by)
       SELECT n, b, $3, $4 FROM UNNEST($1::text[], $2::text[]) AS x(n, b)`,
      [numbers, books, bank, user.id]
    );
    await logAudit({ table: 'system', action: 'CREATE', user, summary: `Generated ${total} cheque numbers (${label}) in ${Math.ceil(total / BOOK_SIZE)} book${total > BOOK_SIZE ? 's' : ''}${bank ? ` — ${bank}` : ''}` });
    revalidate();
    return { success: true, message: `${total.toLocaleString()} cheque number${total === 1 ? '' : 's'} generated: ${label}.` };
  } catch (error) {
    console.error('[generateChequeNumbers]', error);
    return { success: false, message: 'Failed to generate the cheque numbers. Please try again.' };
  }
}


/**
 * Record blank cheques: one or more cheque numbers handed to a creditor before their date and amount
 * are known. Numbers may come from the generated pool or be typed (they are then registered too).
 * All-or-nothing: if any number is already used, assigned to a creditor or cancelled, nothing is saved.
 */
export async function issueBlankCheque(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  const entityId = text(formData, 'entity_id', 36);
  if (!isUuid(entityId)) return { success: false, message: 'Please select a creditor.' };
  const numbers = [...new Set(formData.getAll('cheque_number').map((v) => String(v).trim().slice(0, 100)).filter(Boolean))];
  if (numbers.length === 0) return { success: false, message: 'Select at least one cheque number.' };
  if (numbers.length > MAX_BATCH) return { success: false, message: `Record at most ${MAX_BATCH.toLocaleString()} cheques at a time.` };
  const bank = optionalText(formData, 'bank_name', 100);

  try {
    const entity = (await sql`SELECT name, type, is_active FROM entities WHERE id = ${entityId}`)[0];
    if (!entity || entity.type !== 'VENDOR') return { success: false, message: 'Please select a creditor.' };
    if (!entity.is_active) return { success: false, message: `${entity.name} is inactive. Reactivate it first.` };

    const problems: string[] = [];
    const used = new Set(await usedOnCheque(numbers));
    const rows = await query(
      `SELECT cn.id, cn.cheque_number, cn.entity_id, cn.cancelled_at, e.name AS entity_name FROM cheque_numbers cn
       LEFT JOIN entities e ON e.id = cn.entity_id WHERE cn.cheque_number = ANY($1::text[])`,
      [numbers]
    );
    const byNumber = new Map(rows.map((r) => [r.cheque_number as string, r]));
    for (const n of numbers) {
      const row = byNumber.get(n);
      if (used.has(n)) problems.push(`${n} has already been added as a creditor cheque`);
      else if (row?.cancelled_at) problems.push(`${n} has been cancelled`);
      else if (row?.entity_id) problems.push(`${n} is already recorded as a blank cheque for ${row.entity_name}`);
    }
    if (problems.length) {
      const shown = problems.slice(0, 5).join('; ') + (problems.length > 5 ? `; and ${problems.length - 5} more` : '');
      return { success: false, message: `Nothing was saved — ${shown}.` };
    }

    const today = todayKey();
    const existingIds = numbers.filter((n) => byNumber.has(n)).map((n) => byNumber.get(n).id as string);
    const fresh = numbers.filter((n) => !byNumber.has(n));
    await transaction([
      ...(existingIds.length
        ? [{ text: `UPDATE cheque_numbers SET entity_id = $2, issued_date = $3, bank_name = COALESCE($4, bank_name) WHERE id = ANY($1::uuid[]) AND entity_id IS NULL`, params: [existingIds, entityId, today, bank] }]
        : []),
      ...(fresh.length
        ? [{ text: `INSERT INTO cheque_numbers (cheque_number, bank_name, entity_id, issued_date, created_by)
                    SELECT n, $2, $3, $4, $5 FROM UNNEST($1::text[]) AS n ON CONFLICT (cheque_number) DO NOTHING`, params: [fresh, bank, entityId, today, user.id] }]
        : []),
    ]);
    const label = numbers.length === 1 ? `cheque ${numbers[0]}` : `${numbers.length} cheques (${numbers.slice(0, 5).join(', ')}${numbers.length > 5 ? ', …' : ''})`;
    await logAudit({ table: 'system', action: 'CREATE', user, summary: `Recorded blank ${label} for ${entity.name}` });
    revalidate();
    return { success: true, message: `Blank ${label} recorded for ${entity.name}.` };
  } catch (error) {
    console.error('[issueBlankCheque]', error);
    return { success: false, message: 'Failed to record the blank cheques. Please try again.' };
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

/**
 * Edit a registered cheque number that has not been used: its number and bank. Only the person who
 * registered it or an administrator may do so. Every change is written to the audit log.
 */
export async function updateChequeNumber(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  const id = text(formData, 'id', 36);
  if (!isUuid(id)) return { success: false, message: 'Cheque number not found.' };
  const number = text(formData, 'cheque_number', 100);
  if (!number) return { success: false, message: 'Cheque number is required.' };
  const bank = optionalText(formData, 'bank_name', 100);

  try {
    const row = (await sql`SELECT cheque_number, bank_name, entity_id, cancelled_at, created_by FROM cheque_numbers WHERE id = ${id}`)[0];
    if (!row) return { success: false, message: 'Cheque number not found.' };
    if (!canEdit(user, row.created_by)) return FORBIDDEN;
    if (row.cancelled_at) return { success: false, message: 'A cancelled cheque number cannot be edited. Restore it first.' };
    if ((await usedOnCheque([row.cheque_number])).length) return { success: false, message: `${row.cheque_number} is already on a creditor cheque, so it cannot be edited.` };
    if (number !== row.cheque_number) {
      if (row.entity_id) return { success: false, message: 'This number is recorded as a blank cheque. Remove it from the blank-cheque register before changing the number.' };
      const clash = (await sql`SELECT 1 FROM cheque_numbers WHERE cheque_number = ${number} AND id <> ${id}`).length || (await usedOnCheque([number])).length;
      if (clash) return { success: false, message: `Cheque number ${number} already exists.` };
    }
    const changes = diff({ cheque_number: row.cheque_number, bank_name: row.bank_name }, { cheque_number: number, bank_name: bank });
    if (!Object.keys(changes).length) return { success: true, message: 'No changes to save.' };
    await sql`UPDATE cheque_numbers SET cheque_number = ${number}, bank_name = ${bank}, updated_at = NOW(), updated_by = ${user.id} WHERE id = ${id}`;
    await logAudit({ table: 'system', recordId: id, action: 'UPDATE', user, changes, summary: `Edited cheque number ${row.cheque_number}${number !== row.cheque_number ? ` → ${number}` : ''}` });
    revalidate();
    return { success: true, message: 'Cheque number updated.' };
  } catch (error) {
    console.error('[updateChequeNumber]', error);
    return { success: false, message: 'Failed to update the cheque number.' };
  }
}

/**
 * Cancel an unused or invalid cheque number (spoiled, lost, voided). It leaves the available pool and
 * the blank-cheque register and can no longer be used. A number already on a creditor cheque cannot
 * be cancelled here — cancel that cheque instead. A reason is required and logged.
 */
export async function cancelChequeNumber(id: string, reason: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!isUuid(id)) return { success: false, message: 'Cheque number not found.' };
  const why = reason.trim().slice(0, 500);
  if (!why) return { success: false, message: 'Enter a reason for cancelling this cheque number.' };
  try {
    const row = (await sql`
      SELECT cn.cheque_number, cn.created_by, cn.cancelled_at, e.name AS entity_name FROM cheque_numbers cn
      LEFT JOIN entities e ON e.id = cn.entity_id WHERE cn.id = ${id}`)[0];
    if (!row) return { success: false, message: 'Cheque number not found.' };
    if (!canEdit(user, row.created_by)) return FORBIDDEN;
    if (row.cancelled_at) return { success: false, message: 'This cheque number is already cancelled.' };
    if ((await usedOnCheque([row.cheque_number])).length) {
      return { success: false, message: `${row.cheque_number} is already on a creditor cheque. Cancel that cheque instead.` };
    }
    await sql`UPDATE cheque_numbers SET cancelled_at = NOW(), cancelled_by = ${user.id}, cancel_reason = ${why},
                entity_id = NULL, issued_date = NULL, updated_at = NOW(), updated_by = ${user.id} WHERE id = ${id}`;
    await logAudit({
      table: 'system', recordId: id, action: 'UPDATE', user,
      summary: `Cancelled cheque number ${row.cheque_number}${row.entity_name ? ` (was a blank cheque for ${row.entity_name})` : ''} — ${why}`,
    });
    revalidate();
    return { success: true, message: `Cheque number ${row.cheque_number} cancelled.` };
  } catch (error) {
    console.error('[cancelChequeNumber]', error);
    return { success: false, message: 'Failed to cancel the cheque number.' };
  }
}

/** Bring a cancelled cheque number back into the available pool. */
export async function restoreChequeNumber(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!isUuid(id)) return { success: false, message: 'Cheque number not found.' };
  try {
    const row = (await sql`SELECT cheque_number, created_by, cancelled_at FROM cheque_numbers WHERE id = ${id}`)[0];
    if (!row) return { success: false, message: 'Cheque number not found.' };
    if (!canEdit(user, row.created_by)) return FORBIDDEN;
    if (!row.cancelled_at) return { success: false, message: 'This cheque number is not cancelled.' };
    await sql`UPDATE cheque_numbers SET cancelled_at = NULL, cancelled_by = NULL, cancel_reason = NULL, updated_at = NOW(), updated_by = ${user.id} WHERE id = ${id}`;
    await logAudit({ table: 'system', recordId: id, action: 'UPDATE', user, summary: `Restored cancelled cheque number ${row.cheque_number}` });
    revalidate();
    return { success: true, message: `Cheque number ${row.cheque_number} restored.` };
  } catch (error) {
    console.error('[restoreChequeNumber]', error);
    return { success: false, message: 'Failed to restore the cheque number.' };
  }
}
