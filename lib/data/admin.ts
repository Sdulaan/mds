import 'server-only';
import { query, sql } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import type { AppUser, AuditEntry } from '@/types';

export async function getUsers(): Promise<AppUser[]> {
  await requireAdmin();
  const rows = await sql`
    SELECT id, username, full_name, role, is_active, created_at::text FROM users ORDER BY is_active DESC, username
  `;
  return rows as AppUser[];
}

/** Change history for one record (visible to any signed-in user). */
export async function getRecordHistory(table: string, recordId: string): Promise<AuditEntry[]> {
  await requireUser();
  const rows = await sql`
    SELECT id::text, entity_table, record_id, action, summary, changes, username, created_at::text
    FROM audit_log WHERE entity_table = ${table} AND record_id = ${recordId}
    ORDER BY created_at DESC LIMIT 100
  `;
  return rows as AuditEntry[];
}

export interface ActivityFilters {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
}

export async function getActivity(filters: ActivityFilters = {}, limit = 300): Promise<AuditEntry[]> {
  await requireAdmin();
  const params: unknown[] = [];
  const conditions: string[] = [];
  const add = (v: unknown) => (params.push(v), `$${params.length}`);
  if (filters.userId) conditions.push(`user_id = ${add(filters.userId)}`);
  if (filters.action) conditions.push(`action = ${add(filters.action)}`);
  if (filters.from) conditions.push(`created_at >= ${add(filters.from)}::date`);
  if (filters.to) conditions.push(`created_at < (${add(filters.to)}::date + INTERVAL '1 day')`);
  const rows = await query(
    `SELECT id::text, entity_table, record_id, action, summary, changes, username, created_at::text
     FROM audit_log ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY created_at DESC LIMIT ${limit}`,
    params
  );
  return rows as AuditEntry[];
}
