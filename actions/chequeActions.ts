'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { query, sql, transaction } from '@/lib/db';
import { canDelete, canEdit, getCurrentUser, isAdmin } from '@/lib/auth';
import { diff, logAudit } from '@/lib/audit';
import { findDuplicates } from '@/lib/data/cheques';
import { getGrnBalances, paidOn } from '@/lib/data/grns';
import { allocate, unpaidTotal, type Allocation } from '@/lib/grn-allocation';
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
  if (type === 'DEBIT') revalidatePath('/purchases', 'layout');
}

/**
 * Creditor cheques pay one or more GRNs (purchases) of the same creditor. The amount is applied
 * oldest GRN first, each up to its unpaid balance; a GRN can be part-paid by several cheques.
 * Cancelled cheques don't count, so cancelling one frees its GRNs for a new cheque.
 */
async function allocateGrns(
  formData: FormData, entityId: string, amount: number, chequeId: string | undefined, cancelled: boolean
): Promise<Allocation[]> {
  const ids = [...new Set(formData.getAll('grn_ids').map(String).filter(isUuid))];
  if (ids.length === 0) throw new FormError('Select at least one GRN for this cheque. Add the GRN under Purchases first if it is not listed.');
  const grns = await getGrnBalances(ids, entityId, chequeId);
  if (grns.length !== ids.length) throw new FormError('One of the selected GRNs no longer exists or belongs to another creditor. Please reselect.');

  // A cancelled cheque pays nothing, so its GRN amounts are only kept for the record.
  if (cancelled) return allocate(amount, grns.map((g) => ({ ...g, remaining: g.amount }))).allocations;

  const paid = grns.filter((g) => g.remaining <= 0);
  if (paid.length) throw new FormError(`GRN ${paid.map((g) => g.grn_number).join(', ')} is already fully paid. Remove it from this cheque.`);
  const { allocations, unallocated, unused } = allocate(amount, grns);
  if (unallocated > 0) {
    throw new FormError(`The amount is more than the unpaid total of the selected GRNs (${formatAmount(unpaidTotal(grns))}). Select more GRNs or reduce the amount.`);
  }
  if (unused.length) {
    throw new FormError(`The amount doesn't reach GRN ${unused.map((g) => g.grn_number).join(', ')}. Remove it or increase the amount.`);
  }
  return allocations;
}

/** Statements that replace a cheque's GRN links. */
function grnLinkStatements(chequeId: string, allocations: Allocation[]) {
  return [
    { text: 'DELETE FROM cheque_grns WHERE transaction_id = $1', params: [chequeId] },
    ...(allocations.length
      ? [{
          text: `INSERT INTO cheque_grns (transaction_id, purchase_id, amount)
                 SELECT $1, UNNEST($2::uuid[]), UNNEST($3::numeric[])`,
          params: [chequeId, allocations.map((a) => a.grn.id), allocations.map((a) => a.amount)],
        }]
      : []),
  ];
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
    if (type === 'CREDIT' && !/^\d{6}$/.test(chequeNumber)) {
      return { success: false, message: 'Cheque number must be exactly 6 digits.' };
    }
    const chequeDate = optionalDate(formData, 'cheque_date', 'Cheque date');
    if (!chequeDate) return { success: false, message: 'Cheque date is required.' };
    const amount = money(formData, 'amount', 'Amount');
    const entryDate = optionalDate(formData, 'entry_date', 'Entry date') ?? todayKey();
    const bankName = optionalText(formData, 'bank_name', 100);
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

    // Creditor cheques: the GRNs they pay (the GRN text is kept for display, search and reports).
    const allocations = type === 'DEBIT'
      ? await allocateGrns(formData, entityId, amount, isEdit ? id : undefined, !!dates.cancelled_date)
      : [];
    const grnNumber = type === 'DEBIT' ? allocations.map((a) => a.grn.grn_number).join(', ') : null;

    // SRS §7 duplicate control: warn with the earlier cheque's details. Creditor cheques can only be
    // overridden by administrators; a repeated customer cheque number may be saved by anyone after the warning.
    const duplicates = await findDuplicates({ type, entityId, chequeNumber, bankName, excludeId: isEdit ? id : undefined });
    const override = formData.get('override_duplicate') === 'on';
    const canOverride = type === 'CREDIT' || isAdmin(user);
    if (duplicates.length > 0 && !(override && canOverride)) {
      const details = duplicates
        .map((d) => type === 'CREDIT'
          ? `previously used by ${d.entity_name} (cheque date ${formatDate(d.cheque_date)})`
          : `Cheque no. ${d.value} (${d.entity_name}, ${formatDate(d.cheque_date)})`)
        .join('; ');
      return {
        success: false,
        duplicate: true,
        message: `Duplicate Entry Detected — cheque number ${chequeNumber} ${type === 'CREDIT' ? '' : 'already exists: '}${details}. ${
          canOverride ? 'Tick "Save anyway" to override.' : 'Only a System Administrator can save a duplicate entry.'
        }`,
      };
    }
    const duplicateNote = duplicates.length ? ' — duplicate approved' : '';

    const values = {
      entity_id: entityId, cheque_number: chequeNumber, cheque_date: chequeDate, amount, bank_name: bankName,
      grn_number: grnNumber, entry_date: entryDate, remarks, ...dates,
    };

    if (existing) {
      await transaction([
        {
          text: `UPDATE transactions SET
                   entity_id = $2, cheque_number = $3, cheque_date = $4, amount = $5, bank_name = $6, grn_number = $7,
                   entry_date = $8, remarks = $9, deposited_date = $10, cleared_date = $11, returned_date = $12,
                   cancelled_date = $13, updated_at = NOW(), updated_by = $14
                 WHERE id = $1`,
          params: [id, entityId, chequeNumber, chequeDate, amount, bankName, grnNumber, entryDate, remarks,
            dates.deposited_date, dates.cleared_date, dates.returned_date, dates.cancelled_date, user.id],
        },
        ...(type === 'DEBIT' ? grnLinkStatements(id, allocations) : []),
      ]);
      const changes = diff(existing, values);
      if (Object.keys(changes).length > 0) {
        await logAudit({
          table: 'transactions', recordId: id, action: 'UPDATE', user, changes,
          summary: `Edited cheque ${chequeNumber} (${entity.name})${changes.cheque_date ? ` — rescheduled to ${formatDate(chequeDate)}` : ''}${duplicateNote}`,
        });
      }
      revalidateCheques(type);
      return { success: true, message: 'Cheque updated.' };
    }

    const newId = randomUUID();
    await transaction([
      {
        text: `INSERT INTO transactions
                 (id, transaction_type, entity_id, cheque_number, cheque_date, amount, bank_name, grn_number, entry_date, remarks, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        params: [newId, type, entityId, chequeNumber, chequeDate, amount, bankName, grnNumber, entryDate, remarks, user.id],
      },
      ...(type === 'DEBIT' ? grnLinkStatements(newId, allocations) : []),
    ]);
    await logAudit({
      table: 'transactions', recordId: newId, action: 'CREATE', user,
      summary: `Added ${type === 'CREDIT' ? 'customer' : 'creditor'} cheque ${chequeNumber} — ${entity.name}, ${formatAmount(amount)}${duplicateNote}`,
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

    if (type === 'DEBIT' && row.cancelled_date && !next.cancelled_date) {
      const over = await query(
        `SELECT p.grn_number FROM cheque_grns g JOIN purchases p ON p.id = g.purchase_id
         WHERE g.transaction_id = $1 AND ${paidOn('$1')} + g.amount > p.amount + 0.005`,
        [id]
      );
      if (over.length) {
        return {
          success: false,
          message: `Can't restore this cheque: GRN ${over.map((r) => r.grn_number).join(', ')} has since been paid by another cheque.`,
        };
      }
    }

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
