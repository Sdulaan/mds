import 'server-only';
import { sql } from '@/lib/db';
import type { CurrentUser } from '@/lib/auth';

type Changes = Record<string, { from: unknown; to: unknown }>;

interface AuditInput {
  table: 'transactions' | 'entities' | 'purchases' | 'users' | 'system';
  recordId?: string | null;
  action: string;
  summary: string;
  changes?: Changes | null;
  user: Pick<CurrentUser, 'id' | 'username'> | null;
}

/** Record who did what (SRS §8 audit trail, §12 user-wise activity tracking). Never throws. */
export async function logAudit({ table, recordId = null, action, summary, changes = null, user }: AuditInput) {
  try {
    await sql`
      INSERT INTO audit_log (entity_table, record_id, action, summary, changes, user_id, username)
      VALUES (${table}, ${recordId}, ${action}, ${summary}, ${changes ? JSON.stringify(changes) : null}::jsonb,
              ${user?.id ?? null}, ${user?.username ?? null})
    `;
  } catch (error) {
    console.error('[audit]', error);
  }
}

const normalise = (v: unknown) => (v === undefined || v === '' ? null : v instanceof Date ? v.toISOString() : v);

/** Field-by-field diff of the keys in `after`; only changed fields are returned. */
export function diff(before: object, after: object): Changes {
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const changes: Changes = {};
  for (const key of Object.keys(a)) {
    const from = normalise(b[key]);
    const to = normalise(a[key]);
    const same =
      String(from ?? '') === String(to ?? '') ||
      (from !== null && to !== null && !isNaN(Number(from)) && !isNaN(Number(to)) && Number(from) === Number(to));
    if (!same) changes[key] = { from, to };
  }
  return changes;
}
