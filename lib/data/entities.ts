import 'server-only';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import type { Entity, EntityType } from '@/types';

const ENTITY_COLUMNS = `
  e.id, e.name, e.type, e.address, e.contact_number, e.email, e.credit_terms, e.opening_balance,
  e.remarks, e.is_active, e.created_at::text, e.created_by, e.updated_at::text, e.updated_by,
  cu.username AS created_by_name, uu.username AS updated_by_name
`;
const ENTITY_JOINS = `
  FROM entities e
  LEFT JOIN users cu ON cu.id = e.created_by
  LEFT JOIN users uu ON uu.id = e.updated_by
`;

export interface EntityWithStats extends Entity {
  cheque_count: number;
  /** Customers: cheques in hand + deposited. Creditors: pending cheques. */
  outstanding_amount: number;
}

export async function getEntities(type: EntityType, opts: { activeOnly?: boolean; q?: string } = {}): Promise<EntityWithStats[]> {
  await requireUser();
  const params: unknown[] = [type];
  const conditions = ['e.type = $1'];
  if (opts.activeOnly) conditions.push('e.is_active');
  if (opts.q) {
    params.push(`%${opts.q}%`);
    conditions.push(`(e.name ILIKE $${params.length} OR e.contact_number ILIKE $${params.length} OR e.email ILIKE $${params.length})`);
  }
  const rows = await query(
    `SELECT ${ENTITY_COLUMNS},
       COALESCE(s.cheque_count, 0)::int AS cheque_count,
       COALESCE(s.outstanding, 0)::float AS outstanding_amount
     ${ENTITY_JOINS}
     LEFT JOIN (
       SELECT entity_id, COUNT(*) AS cheque_count,
              SUM(amount) FILTER (WHERE status IN ('IN_HAND', 'DEPOSITED', 'PENDING')) AS outstanding
       FROM transactions GROUP BY entity_id
     ) s ON s.entity_id = e.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY e.is_active DESC, LOWER(e.name)`,
    params
  );
  return rows as EntityWithStats[];
}

/** Lightweight list for dropdowns. */
export async function getEntityOptions(type: EntityType, includeId?: string) {
  await requireUser();
  const rows = await query(
    `SELECT id, name, is_active FROM entities WHERE type = $1 AND (is_active OR id = $2) ORDER BY LOWER(name)`,
    [type, includeId ?? '00000000-0000-0000-0000-000000000000']
  );
  return rows as { id: string; name: string; is_active: boolean }[];
}

export async function getEntity(id: string): Promise<Entity | null> {
  await requireUser();
  const rows = await query(`SELECT ${ENTITY_COLUMNS} ${ENTITY_JOINS} WHERE e.id = $1`, [id]);
  return (rows[0] as Entity) ?? null;
}
