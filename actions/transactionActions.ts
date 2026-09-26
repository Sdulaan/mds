'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  ENTITY_TYPE_FOR,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type ActionResult,
  type TransactionStatus,
  type TransactionType,
} from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 99_999_999.99; // DECIMAL(10, 2)
const UNAUTHORIZED: ActionResult = { success: false, message: 'Your session has expired. Please sign in again.' };

// ─── addTransaction ───────────────────────────────────────────────────────────

export async function addTransaction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTHORIZED;

  try {
    const transaction_type = formData.get('transaction_type') as TransactionType;
    const entity_id = String(formData.get('entity_id') ?? '');
    const cheque_number = String(formData.get('cheque_number') ?? '').trim();
    const cheque_date = String(formData.get('cheque_date') ?? '');
    const amount = parseFloat(formData.get('amount') as string);
    const grn_number = String(formData.get('grn_number') ?? '').trim() || null;
    const remarks = String(formData.get('remarks') ?? '').trim() || null;

    if (!transaction_type || !entity_id || !cheque_number || !cheque_date || isNaN(amount)) {
      return { success: false, message: 'Please fill in all required fields.' };
    }

    if (!TRANSACTION_TYPES.includes(transaction_type)) {
      return { success: false, message: 'Invalid transaction type.' };
    }

    if (!UUID_RE.test(entity_id)) {
      return { success: false, message: 'Please select a valid entity.' };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cheque_date)) {
      return { success: false, message: 'Invalid cheque date.' };
    }

    if (amount <= 0) {
      return { success: false, message: 'Amount must be greater than zero.' };
    }

    if (amount > MAX_AMOUNT) {
      return { success: false, message: 'Amount is too large (maximum Rs. 99,999,999.99).' };
    }

    // Credits must come from a customer, debits must go to a vendor.
    const entity = await sql`SELECT type FROM entities WHERE id = ${entity_id}`;
    if (entity.length === 0) {
      return { success: false, message: 'Selected entity no longer exists.' };
    }
    const expectedType = ENTITY_TYPE_FOR[transaction_type];
    if (entity[0].type !== expectedType) {
      return {
        success: false,
        message: `A ${transaction_type.toLowerCase()} cheque must be linked to a ${expectedType.toLowerCase()}.`,
      };
    }

    await sql`
      INSERT INTO transactions
        (transaction_type, entity_id, cheque_number, cheque_date, amount, status, grn_number, remarks)
      VALUES
        (${transaction_type}, ${entity_id}, ${cheque_number}, ${cheque_date}, ${amount}, 'PENDING', ${grn_number}, ${remarks})
    `;

    revalidatePath('/ledger');
    revalidatePath('/');

    return { success: true, message: 'Cheque added successfully.' };
  } catch (error) {
    console.error('[addTransaction]', error);
    return { success: false, message: 'Failed to add cheque. Please try again.' };
  }
}

// ─── updateTransactionStatus ──────────────────────────────────────────────────

export async function updateTransactionStatus(
  id: string,
  newStatus: TransactionStatus
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTHORIZED;

  try {
    if (!TRANSACTION_STATUSES.includes(newStatus)) {
      return { success: false, message: 'Invalid status.' };
    }

    if (!UUID_RE.test(id)) {
      return { success: false, message: 'Transaction not found.' };
    }

    // cleared_at records when the cheque actually cleared (used by "Cleared This Month").
    const result = await sql`
      UPDATE transactions
      SET status = ${newStatus},
          cleared_at = CASE
            WHEN ${newStatus}::text = 'CLEARED' THEN COALESCE(CASE WHEN status = 'CLEARED' THEN cleared_at END, NOW())
            ELSE NULL
          END
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return { success: false, message: 'Transaction not found.' };
    }

    revalidatePath('/ledger');
    revalidatePath('/');

    return { success: true, message: `Status updated to ${newStatus}.` };
  } catch (error) {
    console.error('[updateTransactionStatus]', error);
    return { success: false, message: 'Failed to update status.' };
  }
}
