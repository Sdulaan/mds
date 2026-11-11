'use server';

import { revalidatePath } from 'next/cache';
import { sql, transaction } from '@/lib/db';
import { canDelete, canEdit, getCurrentUser } from '@/lib/auth';
import { diff, logAudit } from '@/lib/audit';
import { formatDate } from '@/lib/dates';
import { isUuid } from '@/lib/filters';
import { formatAmount } from '@/lib/format';
import { FORBIDDEN, FormError, UNAUTHORIZED, money, optionalDate, optionalText, text } from '@/lib/forms';
import type { ActionResult } from '@/types';

export async function savePurchase(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  try {
    const id = text(formData, 'id', 36);
    const existing = isUuid(id)
      ? (await sql`SELECT *, purchase_date::text, amount::float AS amount FROM purchases WHERE id = ${id}`)[0]
      : null;
    if (isUuid(id) && !existing) return { success: false, message: 'Purchase not found.' };
    if (existing && !canEdit(user, existing.created_by)) return FORBIDDEN;

    const entityId = text(formData, 'entity_id', 36);
    if (!isUuid(entityId)) return { success: false, message: 'Please select a creditor.' };
    const purchaseDate = optionalDate(formData, 'purchase_date', 'Purchase date');
    if (!purchaseDate) return { success: false, message: 'Purchase date is required.' };
    const grnNumber = optionalText(formData, 'grn_number', 100);
    if (!grnNumber) return { success: false, message: 'GRN number is required.' };

    const values = {
      entity_id: entityId,
      grn_number: grnNumber,
      invoice_number: optionalText(formData, 'invoice_number', 100),
      purchase_date: purchaseDate,
      amount: money(formData, 'amount', 'Amount'),
      remarks: optionalText(formData, 'remarks', 2000),
    };

    const [entity] = await sql`SELECT name, type FROM entities WHERE id = ${entityId}`;
    if (!entity || entity.type !== 'VENDOR') return { success: false, message: 'Please select a creditor.' };

    // Duplicate control: a creditor can't have two GRNs with the same number.
    const [dup] = await sql`
      SELECT id, purchase_date::text AS purchase_date FROM purchases
      WHERE entity_id = ${entityId} AND LOWER(TRIM(grn_number)) = LOWER(${grnNumber}) AND id <> ${existing ? id : '00000000-0000-0000-0000-000000000000'}
      LIMIT 1`;
    if (dup) {
      return { success: false, message: `GRN ${grnNumber} already exists for ${entity.name} (dated ${formatDate(dup.purchase_date)}). Duplicate GRN numbers are not allowed — check the number or edit the existing GRN.` };
    }

    // GRNs already on cheques: the creditor can't change, and a lower amount (goods returned)
    // leaves the GRN over-paid until the old cheque is cancelled.
    let note = '';
    if (existing) {
      const [links] = await sql`
        SELECT COUNT(*)::int AS n, COALESCE(SUM(g.amount) FILTER (WHERE t.status <> 'CANCELLED'), 0)::float AS paid
        FROM cheque_grns g JOIN transactions t ON t.id = g.transaction_id WHERE g.purchase_id = ${id}
      `;
      if (links.n > 0 && entityId !== existing.entity_id) {
        return { success: false, message: 'This GRN is already on a cheque, so its creditor cannot be changed.' };
      }
      if (links.paid > values.amount + 0.005) {
        note = ` Cheques already pay ${formatAmount(links.paid)} on this GRN — cancel the old cheque, then issue a new one for the correct amount.`;
      }
    }

    if (existing) {
      await sql`
        UPDATE purchases SET entity_id = ${values.entity_id}, grn_number = ${values.grn_number}, invoice_number = ${values.invoice_number},
          purchase_date = ${values.purchase_date}, amount = ${values.amount}, remarks = ${values.remarks},
          updated_at = NOW(), updated_by = ${user.id}
        WHERE id = ${id}
      `;
      const changes = diff(existing, values);
      if (Object.keys(changes).length) {
        await logAudit({ table: 'purchases', recordId: id, action: 'UPDATE', user, changes, summary: `Edited purchase ${values.grn_number ?? ''} (${entity.name})` });
      }
    } else {
      const [row] = await sql`
        INSERT INTO purchases (entity_id, grn_number, invoice_number, purchase_date, amount, remarks, created_by)
        VALUES (${values.entity_id}, ${values.grn_number}, ${values.invoice_number}, ${values.purchase_date}, ${values.amount}, ${values.remarks}, ${user.id})
        RETURNING id
      `;
      await logAudit({
        table: 'purchases', recordId: row.id, action: 'CREATE', user,
        summary: `Added purchase ${values.grn_number ?? ''} — ${entity.name}, ${formatAmount(values.amount)}`,
      });
    }
    revalidatePath('/purchases');
    revalidatePath('/reports', 'layout');
    revalidatePath('/payables');
    return { success: true, message: (existing ? 'Purchase updated.' : 'Purchase added.') + note };
  } catch (error) {
    if (error instanceof FormError) return { success: false, message: error.message };
    console.error('[savePurchase]', error);
    return { success: false, message: 'Failed to save the purchase.' };
  }
}

export async function deletePurchase(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!canDelete(user)) return FORBIDDEN;
  if (!isUuid(id)) return { success: false, message: 'Purchase not found.' };

  // Cancelled cheques no longer pay anything, so they don't block deleting the GRN; only live cheques do.
  const [linked] = await sql`
    SELECT COUNT(*)::int AS n FROM cheque_grns g JOIN transactions t ON t.id = g.transaction_id
    WHERE g.purchase_id = ${id} AND t.status <> 'CANCELLED'`;
  if (linked?.n) {
    return { success: false, message: 'This GRN is on an active cheque, so it cannot be deleted. Cancel or delete the cheque first.' };
  }

  const [row] = await sql`
    SELECT p.grn_number, p.amount, e.name AS entity_name FROM purchases p JOIN entities e ON e.id = p.entity_id WHERE p.id = ${id}
  `;
  if (!row) return { success: false, message: 'Purchase not found.' };
  // Drop the links to cancelled cheques and delete the GRN together.
  await transaction([
    { text: 'DELETE FROM cheque_grns WHERE purchase_id = $1', params: [id] },
    { text: 'DELETE FROM purchases WHERE id = $1', params: [id] },
  ]);
  await logAudit({
    table: 'purchases', recordId: id, action: 'DELETE', user,
    summary: `Deleted purchase ${row.grn_number ?? ''} — ${row.entity_name}, ${formatAmount(row.amount)}`,
  });
  revalidatePath('/purchases');
  return { success: true, message: 'Purchase deleted.' };
}
