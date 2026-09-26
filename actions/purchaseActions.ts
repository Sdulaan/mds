'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { canDelete, canEdit, getCurrentUser } from '@/lib/auth';
import { diff, logAudit } from '@/lib/audit';
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

    const values = {
      entity_id: entityId,
      grn_number: optionalText(formData, 'grn_number', 100),
      invoice_number: optionalText(formData, 'invoice_number', 100),
      purchase_date: purchaseDate,
      amount: money(formData, 'amount', 'Amount'),
      remarks: optionalText(formData, 'remarks', 2000),
    };

    const [entity] = await sql`SELECT name, type FROM entities WHERE id = ${entityId}`;
    if (!entity || entity.type !== 'VENDOR') return { success: false, message: 'Please select a creditor.' };

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
    return { success: true, message: existing ? 'Purchase updated.' : 'Purchase added.' };
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

  const [row] = await sql`
    DELETE FROM purchases p USING entities e WHERE p.id = ${id} AND e.id = p.entity_id
    RETURNING p.grn_number, p.amount, e.name AS entity_name
  `;
  if (!row) return { success: false, message: 'Purchase not found.' };
  await logAudit({
    table: 'purchases', recordId: id, action: 'DELETE', user,
    summary: `Deleted purchase ${row.grn_number ?? ''} — ${row.entity_name}, ${formatAmount(row.amount)}`,
  });
  revalidatePath('/purchases');
  return { success: true, message: 'Purchase deleted.' };
}
