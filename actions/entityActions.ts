'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import type { Entity, ActionResult, EntityType } from '@/types';

// ─── getEntities ──────────────────────────────────────────────────────────────

export async function getEntities(): Promise<Entity[]> {
  const rows = await sql`
    SELECT id, name, type, created_at::text
    FROM entities
    ORDER BY type, name ASC
  `;
  return rows as Entity[];
}

// ─── addEntity ────────────────────────────────────────────────────────────────

export async function addEntity(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const name = (formData.get('name') as string)?.trim();
    const type = formData.get('type') as EntityType;

    if (!name) {
      return { success: false, message: 'Entity name is required.' };
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
