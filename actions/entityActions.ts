'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { canDelete, canEdit, getCurrentUser, isAdmin } from '@/lib/auth';
import { diff, logAudit } from '@/lib/audit';
import { nameKey } from '@/lib/names';
import { isUuid } from '@/lib/filters';
import { FORBIDDEN, FormError, UNAUTHORIZED, money, optionalText, text } from '@/lib/forms';
import { ENTITY_LABEL, type ActionResult, type EntityType } from '@/types';

const LIST_PATH: Record<EntityType, string> = { CUSTOMER: '/customers', VENDOR: '/creditors' };

function revalidateEntities(type: EntityType) {
  revalidatePath(LIST_PATH[type]);
  revalidatePath(type === 'CUSTOMER' ? '/receivables' : '/payables');
}

// ─── Create / edit ────────────────────────────────────────────────────────────

export async function saveEntity(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;

  try {
    const id = text(formData, 'id', 36);
    const existing = isUuid(id)
      ? (await sql`SELECT *, opening_balance::float AS opening_balance FROM entities WHERE id = ${id}`)[0]
      : null;
    if (isUuid(id) && !existing) return { success: false, message: 'Record not found.' };
    if (existing && !canEdit(user, existing.created_by)) return FORBIDDEN;

    const type = (existing?.type ?? text(formData, 'type', 10)) as EntityType;
    if (!['VENDOR', 'CUSTOMER'].includes(type)) return { success: false, message: 'Invalid type.' };
    const label = ENTITY_LABEL[type].one;

    const name = text(formData, 'name', 255).replace(/\s+/g, ' ');
    if (!name) return { success: false, message: `${label} name is required.` };
    const email = optionalText(formData, 'email', 255);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, message: 'Email address is not valid.' };

    const values = {
      name,
      address: optionalText(formData, 'address', 1000),
      contact_number: optionalText(formData, 'contact_number', 50),
      email,
      credit_terms: optionalText(formData, 'credit_terms', 100),
      opening_balance: text(formData, 'opening_balance') ? money(formData, 'opening_balance', 'Opening balance', { allowZero: true }) : 0,
      remarks: optionalText(formData, 'remarks', 2000),
    };

    // Same name ignoring case/spacing/punctuation counts as a duplicate.
    const clash = await sql`
      SELECT name FROM entities
      WHERE type = ${type} AND id <> ${existing?.id ?? '00000000-0000-0000-0000-000000000000'}
        AND regexp_replace(LOWER(name), '[^a-z0-9]', '', 'g') = ${nameKey(name)}
      LIMIT 1
    `;
    if (clash.length > 0) return { success: false, message: `A ${label.toLowerCase()} named "${clash[0].name}" already exists.` };

    if (existing) {
      await sql`
        UPDATE entities SET name = ${values.name}, address = ${values.address}, contact_number = ${values.contact_number},
          email = ${values.email}, credit_terms = ${values.credit_terms}, opening_balance = ${values.opening_balance},
          remarks = ${values.remarks}, updated_at = NOW(), updated_by = ${user.id}
        WHERE id = ${id}
      `;
      const changes = diff(existing, values);
      if (Object.keys(changes).length) {
        await logAudit({ table: 'entities', recordId: id, action: 'UPDATE', user, changes, summary: `Edited ${label.toLowerCase()} ${name}` });
      }
      revalidateEntities(type);
      return { success: true, message: `${label} updated.` };
    }

    const [row] = await sql`
      INSERT INTO entities (name, type, address, contact_number, email, credit_terms, opening_balance, remarks, created_by)
      VALUES (${values.name}, ${type}, ${values.address}, ${values.contact_number}, ${values.email}, ${values.credit_terms},
              ${values.opening_balance}, ${values.remarks}, ${user.id})
      RETURNING id
    `;
    await logAudit({ table: 'entities', recordId: row.id, action: 'CREATE', user, summary: `Added ${label.toLowerCase()} ${name}` });
    revalidateEntities(type);
    return { success: true, message: `${label} "${name}" added.`, data: row.id };
  } catch (error) {
    if (error instanceof FormError) return { success: false, message: error.message };
    console.error('[saveEntity]', error);
    return { success: false, message: 'Failed to save. Please try again.' };
  }
}

// ─── Active / inactive (SRS: inactive records stay in historical reports) ────

export async function setEntityActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!isUuid(id)) return { success: false, message: 'Record not found.' };

  const [row] = await sql`SELECT name, type, created_by FROM entities WHERE id = ${id}`;
  if (!row) return { success: false, message: 'Record not found.' };
  if (!canEdit(user, row.created_by)) return FORBIDDEN;

  await sql`UPDATE entities SET is_active = ${active}, updated_at = NOW(), updated_by = ${user.id} WHERE id = ${id}`;
  await logAudit({
    table: 'entities', recordId: id, action: 'UPDATE', user,
    summary: `${active ? 'Activated' : 'Deactivated'} ${ENTITY_LABEL[row.type as EntityType].one.toLowerCase()} ${row.name}`,
    changes: { is_active: { from: !active, to: active } },
  });
  revalidateEntities(row.type);
  return { success: true, message: `${row.name} is now ${active ? 'active' : 'inactive'}.` };
}

// ─── Delete (with safety check) ──────────────────────────────────────────────

export async function deleteEntity(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!canDelete(user)) return FORBIDDEN;
  if (!isUuid(id)) return { success: false, message: 'Record not found.' };

  try {
    const [counts] = await sql`
      SELECT (SELECT COUNT(*) FROM transactions WHERE entity_id = ${id})::int AS cheques,
             (SELECT COUNT(*) FROM purchases WHERE entity_id = ${id})::int AS purchases
    `;
    if (counts.cheques > 0 || counts.purchases > 0) {
      return {
        success: false,
        message: `Cannot delete: ${counts.cheques} cheque(s) and ${counts.purchases} purchase(s) are linked. Mark it inactive instead, or merge it into another record.`,
      };
    }
    const [row] = await sql`DELETE FROM entities WHERE id = ${id} RETURNING name, type`;
    if (!row) return { success: false, message: 'Record not found.' };
    await logAudit({ table: 'entities', recordId: id, action: 'DELETE', user, summary: `Deleted ${ENTITY_LABEL[row.type as EntityType].one.toLowerCase()} ${row.name}` });
    revalidateEntities(row.type);
    return { success: true, message: `${row.name} deleted.` };
  } catch (error) {
    console.error('[deleteEntity]', error);
    return { success: false, message: 'Failed to delete.' };
  }
}

// ─── Merge duplicates (admin) ────────────────────────────────────────────────

/** Moves every cheque and purchase from `sourceId` to `targetId`, then deletes the source. */
export async function mergeEntity(sourceId: string, targetId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return UNAUTHORIZED;
  if (!isAdmin(user)) return FORBIDDEN;
  if (!isUuid(sourceId) || !isUuid(targetId) || sourceId === targetId) return { success: false, message: 'Choose a different record to merge into.' };

  try {
    const rows = await sql`SELECT id, name, type FROM entities WHERE id IN (${sourceId}, ${targetId})`;
    const source = rows.find((r) => r.id === sourceId);
    const target = rows.find((r) => r.id === targetId);
    if (!source || !target) return { success: false, message: 'Record not found.' };
    if (source.type !== target.type) return { success: false, message: 'Customers and creditors cannot be merged together.' };

    const [moved] = await sql`
      WITH c AS (UPDATE transactions SET entity_id = ${targetId}, updated_at = NOW(), updated_by = ${user.id} WHERE entity_id = ${sourceId} RETURNING 1),
           p AS (UPDATE purchases SET entity_id = ${targetId}, updated_at = NOW(), updated_by = ${user.id} WHERE entity_id = ${sourceId} RETURNING 1)
      SELECT (SELECT COUNT(*) FROM c)::int AS cheques, (SELECT COUNT(*) FROM p)::int AS purchases
    `;
    await sql`DELETE FROM entities WHERE id = ${sourceId}`;
    await logAudit({
      table: 'entities', recordId: targetId, action: 'MERGE', user,
      summary: `Merged "${source.name}" into "${target.name}" (${moved.cheques} cheques, ${moved.purchases} purchases moved)`,
    });
    revalidateEntities(target.type);
    return { success: true, message: `Merged into ${target.name}: ${moved.cheques} cheque(s) and ${moved.purchases} purchase(s) moved.`, data: targetId };
  } catch (error) {
    console.error('[mergeEntity]', error);
    return { success: false, message: 'Failed to merge.' };
  }
}
