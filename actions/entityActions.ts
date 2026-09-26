'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import type { ActionResult, EntityType } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNAUTHORIZED: ActionResult = { success: false, message: 'Your session has expired. Please sign in again.' };

// ─── addEntity ────────────────────────────────────────────────────────────────

export async function addEntity(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTHORIZED;

  try {
    const name = String(formData.get('name') ?? '').trim();
    const type = formData.get('type') as EntityType;

    if (!name) {
      return { success: false, message: 'Entity name is required.' };
    }

    if (name.length > 255) {
      return { success: false, message: 'Entity name must be 255 characters or fewer.' };
    }

    if (!['VENDOR', 'CUSTOMER'].includes(type)) {
      return { success: false, message: 'Invalid entity type.' };
    }

    // Check for duplicate
    const existing = await sql`
      SELECT id FROM entities WHERE LOWER(name) = LOWER(${name}) AND type = ${type}
    `;

    if (existing.length > 0) {
      return { success: false, message: `A ${type.toLowerCase()} named "${name}" already exists.` };
    }

    await sql`
      INSERT INTO entities (name, type) VALUES (${name}, ${type})
    `;

    revalidatePath('/entities');
    revalidatePath('/add-cheque');

    return { success: true, message: `${type === 'VENDOR' ? 'Vendor' : 'Customer'} "${name}" added successfully.` };
  } catch (error) {
    console.error('[addEntity]', error);
    return { success: false, message: 'Failed to add entity. Please try again.' };
  }
}

// ─── deleteEntity ─────────────────────────────────────────────────────────────

export async function deleteEntity(id: string): Promise<ActionResult> {
  if (!(await getSession())) return UNAUTHORIZED;

  if (!UUID_RE.test(id)) {
    return { success: false, message: 'Invalid entity.' };
  }

  try {
    // Check if any transactions reference this entity
    const txCount = await sql`
      SELECT COUNT(*) AS count FROM transactions WHERE entity_id = ${id}
    `;

    const count = parseInt(String(txCount[0]?.count ?? 0), 10);
    if (count > 0) {
      return {
        success: false,
        message: `Cannot delete: this entity has ${count} transaction(s) linked to it.`,
      };
    }

    await sql`DELETE FROM entities WHERE id = ${id}`;

    revalidatePath('/entities');
    revalidatePath('/add-cheque');

    return { success: true, message: 'Entity deleted successfully.' };
  } catch (error) {
    console.error('[deleteEntity]', error);
    return { success: false, message: 'Failed to delete entity.' };
  }
}
