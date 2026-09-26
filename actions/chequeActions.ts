'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { canDelete, canEdit, getCurrentUser, isAdmin } from '@/lib/auth';
import { diff, logAudit } from '@/lib/audit';
import { findDuplicates } from '@/lib/data/cheques';
import { todayKey, formatDate } from '@/lib/dates';
import { isUuid } from '@/lib/filters';
import { formatAmount } from '@/lib/format';
import { FORBIDDEN, FormError, UNAUTHORIZED, money, optionalDate, optionalText, text } from '@/lib/forms';
import {
  ENTITY_LABEL,
  ENTITY_TYPE_FOR,
  STATUS_LABEL,
  TRANSACTION_TYPES,
  type ActionResult,
  type StatusFlag,
  type TransactionType,
} from '@/types';

const BOOK_PATH: Record<TransactionType, string> = { CREDIT: '/receivables', DEBIT: '/payables' };

function revalidateCheques(type: TransactionType) {
  revalidatePath(BOOK_PATH[type]);
  revalidatePath('/');
  revalidatePath('/reports', 'layout');
}

interface StatusDates {
  deposited_date: string | null;
  cleared_date: string | null;
  returned_date: string | null;
  cancelled_date: string | null;
}

/** Enforces the workflow rules for each cheque type. Returns cleaned dates or throws FormError. */
function normaliseStatusDates(type: TransactionType, d: StatusDates): StatusDates {
  if (type === 'CREDIT') {
    if (d.cleared_date && d.returned_date) throw new FormError('A cheque cannot be both credited and returned.');
    // Credited or returned cheques must have been deposited first.
    const deposited = d.deposited_date ?? d.cleared_date ?? d.returned_date;
    return { deposited_date: deposited, cleared_date: d.cleared_date, returned_date: d.returned_date, cancelled_date: null };
  }
  if (d.cleared_date && d.cancelled_date) throw new FormError('A cheque cannot be both cleared and cancelled.');
  return { deposited_date: null, cleared_date: d.cleared_date, returned_date: null, cancelled_date: d.cancelled_date };
}

// ─── Create / edit ────────────────────────────────────────────────────────────

export async function saveCheque(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  try {
    const id = text(formData, 'id', 36);
    const isEdit = isUuid(id);
    const existing = isEdit
      ? (await sql`SELECT * , cheque_date::text, entry_date::text, deposited_date::text, cleared_date::text,
                          returned_date::text, cancelled_date::text FROM transactions WHERE id = ${id}`)[0]
      : null;
    if (isEdit && !existing) return { success: false, message: 'Cheque not found.' };
    if (existing && !canEdit(user, existing.created_by)) return FORBIDDEN;

    const type = (existing?.transaction_type ?? text(formData, 'transaction_type', 10)) as TransactionType;
    if (!TRANSACTION_TYPES.includes(type)) return { success: false, message: 'Invalid cheque type.' };

    const entityId = text(formData, 'entity_id', 36);
    if (!isUuid(entityId)) return { success: false, message: `Please select a ${ENTITY_LABEL[ENTITY_TYPE_FOR[type]].one.toLowerCase()}.` };

    const chequeNumber = text(formData, 'cheque_number', 100);
    if (!chequeNumber) return { success: false, message: 'Cheque number is required.' };
    const chequeDate = optionalDate(formData, 'cheque_date', 'Cheque date');
    if (!chequeDate) return { success: false, message: 'Cheque date is required.' };
    const amount = money(formData, 'amount', 'Amount');
    const entryDate = optionalDate(formData, 'entry_date', 'Entry date') ?? todayKey();
    const bankName = optionalText(formData, 'bank_name', 100);
    const grnNumber = optionalText(formData, 'grn_number', 100);
    const remarks = optionalText(formData, 'remarks', 2000);

    const entity = (await sql`SELECT type, name, is_active FROM entities WHERE id = ${entityId}`)[0];
    if (!entity) return { success: false, message: 'The selected entity no longer exists.' };
    const expected = ENTITY_TYPE_FOR[type];
    if (entity.type !== expected) {
      return { success: false, message: `This cheque must be linked to a ${ENTITY_LABEL[expected].one.toLowerCase()}.` };
    }
    if (!entity.is_active && entityId !== existing?.entity_id) {
      return { success: false, message: `${entity.name} is inactive. Reactivate it before adding new cheques.` };
    }

    // Status dates are only editable on existing cheques; new cheques always start pending / in hand.
    const dates = isEdit
      ? normaliseStatusDates(type, {
          deposited_date: optionalDate(formData, 'deposited_date', 'Deposited date'),
          cleared_date: optionalDate(formData, 'cleared_date', type === 'CREDIT' ? 'Credited date' : 'Cleared date'),
          returned_date: optionalDate(formData, 'returned_date', 'Returned date'),
          cancelled_date: optionalDate(formData, 'cancelled_date', 'Cancelled date'),
        })
      : { deposited_date: null, cleared_date: null, returned_date: null, cancelled_date: null };

    // SRS §7 duplicate control: warn, and only administrators may override.
    const duplicates = await findDuplicates({
      type, entityId, chequeNumber, bankName, grnNumber, excludeId: isEdit ? id : undefined,
    });
    const override = formData.get('override_duplicate') === 'on';
    if (duplicates.length > 0 && !(override && isAdmin(user))) {
      const details = duplicates
        .map((d) => `${d.field === 'grn_number' ? 'GRN' : 'Cheque no.'} ${d.value} (${d.entity_name}, ${formatDate(d.cheque_date)})`)
        .join('; ');
      return {
        success: false,
        duplicate: true,
        message: `Duplicate Entry Detected — ${details}. ${
          isAdmin(user) ? 'Tick "Save anyway" to override.' : 'Only a System Administrator can save a duplicate entry.'
        }`,
      };
    }

    const values = {
      entity_id: entityId, cheque_number: chequeNumber, cheque_date: chequeDate, amount, bank_name: bankName,
      grn_number: grnNumber, entry_date: entryDate, remarks, ...dates,
    };

    if (existing) {
      await sql`
        UPDATE transactions SET
          entity_id = ${entityId}, cheque_number = ${chequeNumber}, cheque_date = ${chequeDate}, amount = ${amount},
          bank_name = ${bankName}, grn_number = ${grnNumber}, entry_date = ${entryDate}, remarks = ${remarks},
          deposited_date = ${dates.deposited_date}, cleared_date = ${dates.cleared_date},
          returned_date = ${dates.returned_date}, cancelled_date = ${dates.cancelled_date},
          updated_at = NOW(), updated_by = ${user.id}
        WHERE id = ${id}
      `;
      const changes = diff(existing, values);
      if (Object.keys(changes).length > 0) {
        await logAudit({
          table: 'transactions', recordId: id, action: 'UPDATE', user, changes,
          summary: `Edited cheque ${chequeNumber} (${entity.name})${changes.cheque_date ? ` — rescheduled to ${formatDate(chequeDate)}` : ''}${
            duplicates.length ? ' — duplicate approved by administrator' : ''
          }`,
        });
      }
      revalidateCheques(type);
      return { success: true, message: 'Cheque updated.' };
    }

    const [row] = await sql`
      INSERT INTO transactions
        (transaction_type, entity_id, cheque_number, cheque_date, amount, bank_name, grn_number, entry_date, remarks, created_by)
      VALUES
        (${type}, ${entityId}, ${chequeNumber}, ${chequeDate}, ${amount}, ${bankName}, ${grnNumber}, ${entryDate}, ${remarks}, ${user.id})
      RETURNING id
    `;
    await logAudit({
      table: 'transactions', recordId: row.id, action: 'CREATE', user,
      summary: `Added ${type === 'CREDIT' ? 'customer' : 'creditor'} cheque ${chequeNumber} — ${entity.name}, ${formatAmount(amount)}${
        duplicates.length ? ' — duplicate approved by administrator' : ''
      }`,
    });
    revalidateCheques(type);
    return { success: true, message: `Cheque ${chequeNumber} added.` };
  } catch (error) {
    if (error instanceof FormError) return { success: false, message: error.message };
    console.error('[saveCheque]', error);
    return { success: false, message: 'Failed to save the cheque. Please try again.' };
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCheque(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!canDelete(user)) return FORBIDDEN;
  if (!isUuid(id)) return { success: false, message: 'Cheque not found.' };

  try {
    const [row] = await sql`
      DELETE FROM transactions t USING entities e
      WHERE t.id = ${id} AND e.id = t.entity_id
      RETURNING t.transaction_type, t.cheque_number, t.cheque_date::text, t.amount, t.status, t.bank_name, t.grn_number, e.name AS entity_name
    `;
    if (!row) return { success: false, message: 'Cheque not found.' };
    await logAudit({
      table: 'transactions', recordId: id, action: 'DELETE', user,
      summary: `Deleted cheque ${row.cheque_number} — ${row.entity_name}, ${formatAmount(row.amount)}`,
      changes: Object.fromEntries(Object.entries(row).map(([k, v]) => [k, { from: v, to: null }])),
    });
    revalidateCheques(row.transaction_type);
    return { success: true, message: 'Cheque deleted.' };
  } catch (error) {
    console.error('[deleteCheque]', error);
    return { success: false, message: 'Failed to delete the cheque.' };
  }
}

// ─── Status checkboxes ────────────────────────────────────────────────────────

const FLAG_COLUMN: Record<StatusFlag, keyof StatusDates> = {
  deposited: 'deposited_date',
  cleared: 'cleared_date',
  returned: 'returned_date',
  cancelled: 'cancelled_date',
};

/**
 * Tick or untick a status checkbox. Ticking records today's date automatically (SRS);
 * the resulting status is derived from the dates by the database.
 */
export async function setChequeFlag(id: string, flag: StatusFlag, checked: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!isUuid(id) || !(flag in FLAG_COLUMN)) return { success: false, message: 'Invalid request.' };

  try {
    const [row] = await sql`
      SELECT t.transaction_type, t.created_by, t.cheque_number, t.status, e.name AS entity_name,
             t.deposited_date::text, t.cleared_date::text, t.returned_date::text, t.cancelled_date::text
      FROM transactions t JOIN entities e ON e.id = t.entity_id WHERE t.id = ${id}
    `;
    if (!row) return { success: false, message: 'Cheque not found.' };
    if (!canEdit(user, row.created_by)) return FORBIDDEN;

    const type = row.transaction_type as TransactionType;
    const today = todayKey();
    const d: StatusDates = {
      deposited_date: row.deposited_date,
      cleared_date: row.cleared_date,
      returned_date: row.returned_date,
      cancelled_date: row.cancelled_date,
    };

    if (type === 'CREDIT') {
      if (flag === 'cancelled') return { success: false, message: 'Customer cheques cannot be cancelled.' };
      if (flag === 'deposited') {
        d.deposited_date = checked ? d.deposited_date ?? today : null;
        if (!checked) d.cleared_date = d.returned_date = null; // un-depositing undoes later steps
      } else if (flag === 'cleared') {
        d.cleared_date = checked ? d.cleared_date ?? today : null;
        if (checked) d.returned_date = null;
      } else {
        d.returned_date = checked ? d.returned_date ?? today : null;
        if (checked) d.cleared_date = null;
      }
    } else {
      if (flag === 'deposited' || flag === 'returned') return { success: false, message: 'Not applicable to creditor cheques.' };
      if (flag === 'cleared') {
        d.cleared_date = checked ? d.cleared_date ?? today : null;
        if (checked) d.cancelled_date = null;
      } else {
        d.cancelled_date = checked ? d.cancelled_date ?? today : null;
        if (checked) d.cleared_date = null;
      }
    }
    const next = normaliseStatusDates(type, d);

    const [updated] = await sql`
      UPDATE transactions SET
        deposited_date = ${next.deposited_date}, cleared_date = ${next.cleared_date},
        returned_date = ${next.returned_date}, cancelled_date = ${next.cancelled_date},
        updated_at = NOW(), updated_by = ${user.id}
      WHERE id = ${id}
      RETURNING status
    `;
    const changes = diff(row, next);
    if (updated.status !== row.status || Object.keys(changes).length) {
      await logAudit({
        table: 'transactions', recordId: id, action: 'STATUS', user,
        summary: `Cheque ${row.cheque_number} (${row.entity_name}): ${STATUS_LABEL[row.status as keyof typeof STATUS_LABEL]} → ${
          STATUS_LABEL[updated.status as keyof typeof STATUS_LABEL]
        }`,
        changes,
      });
    }
    revalidateCheques(type);
    return { success: true, message: `Status: ${STATUS_LABEL[updated.status as keyof typeof STATUS_LABEL]}`, data: updated.status };
  } catch (error) {
    if (error instanceof FormError) return { success: false, message: error.message };
    console.error('[setChequeFlag]', error);
    return { success: false, message: 'Failed to update the status.' };
  }
}
