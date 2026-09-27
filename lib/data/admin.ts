import 'server-only';
import { query, sql } from '@/lib/db';
import { requireAdmin, requireUser } from '@/lib/auth';
import { sqlOrder, type Sort } from '@/lib/sort';
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
  sort?: Sort;
}

export const ACTIVITY_SORT_KEYS = ['when', 'user', 'action'] as const;

/** Default: newest first. */
function activityOrderBy(sort?: Sort): string {
  const columns: Record<string, string> = { when: 'created_at', user: 'LOWER(username)', action: 'action' };
  const column = sort?.sort ? columns[sort.sort] : undefined;
  return column && sort ? `${sqlOrder(column, sort.dir)}, created_at DESC` : 'created_at DESC';
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
     ORDER BY ${activityOrderBy(filters.sort)} LIMIT ${limit}`,
    params
  );
  return rows as AuditEntry[];
}
