import 'server-only';
import { query, transaction } from '@/lib/db';

// Full data backup as JSON (customers/creditors, cheques, purchases, users without password
// hashes, and the audit log). Restore replaces customers/creditors, cheques and purchases.

export const BACKUP_APP = 'mds-cheque-management';
export const BACKUP_VERSION = 1;

const ENTITY_COLS = ['id', 'name', 'type', 'address', 'contact_number', 'email', 'credit_terms', 'opening_balance', 'remarks', 'is_active', 'created_at', 'created_by', 'updated_at', 'updated_by'];
const CHEQUE_COLS = ['id', 'transaction_type', 'entity_id', 'cheque_number', 'cheque_date', 'amount', 'bank_name', 'grn_number', 'remarks', 'entry_date', 'deposited_date', 'cleared_date', 'returned_date', 'cancelled_date', 'created_at', 'created_by', 'updated_at', 'updated_by'];
const PURCHASE_COLS = ['id', 'entity_id', 'grn_number', 'invoice_number', 'purchase_date', 'amount', 'remarks', 'created_at', 'created_by', 'updated_at', 'updated_by'];

export interface Backup {
  app: string;
  version: number;
  created_at: string;
  counts: Record<string, number>;
  tables: {
    entities: Record<string, unknown>[];
    transactions: Record<string, unknown>[];
    purchases: Record<string, unknown>[];
    users?: Record<string, unknown>[];
    audit_log?: Record<string, unknown>[];
  };
}

export async function createBackup(): Promise<Backup> {
  const [entities, transactions, purchases, users, audit] = await Promise.all([
    query(`SELECT ${ENTITY_COLS.join(', ')} FROM entities ORDER BY created_at`),
    query(`SELECT ${CHEQUE_COLS.join(', ')} FROM transactions ORDER BY created_at`),
    query(`SELECT ${PURCHASE_COLS.join(', ')} FROM purchases ORDER BY created_at`),
    query(`SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at`),
    query(`SELECT * FROM audit_log ORDER BY id`),
  ]);
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    created_at: new Date().toISOString(),
    counts: {
      entities: entities.length,
      transactions: transactions.length,
      purchases: purchases.length,
      users: users.length,
      audit_log: audit.length,
    },
    tables: { entities, transactions, purchases, users, audit_log: audit },
  };
}

export function validateBackup(data: unknown): data is Backup {
  const b = data as Backup;
  return (
    !!b &&
    b.app === BACKUP_APP &&
    b.version === BACKUP_VERSION &&
    Array.isArray(b.tables?.entities) &&
    Array.isArray(b.tables?.transactions) &&
    Array.isArray(b.tables?.purchases)
  );
}

/** Replace customers/creditors, cheques and purchases with the backup's contents, atomically. */
export async function restoreBackup(b: Backup): Promise<void> {
  // Keep user references only where that user still exists.
  const col = (c: string) =>
    c === 'created_by' || c === 'updated_by' ? `(SELECT u.id FROM users u WHERE u.id = r.${c})` : `r.${c}`;
  const insert = (table: string, cols: string[]) =>
    `INSERT INTO ${table} (${cols.join(', ')}) SELECT ${cols.map(col).join(', ')} FROM json_populate_recordset(NULL::${table}, $1::json) r`;

  await transaction([
    { text: 'DELETE FROM transactions', params: [] },
    { text: 'DELETE FROM purchases', params: [] },
    { text: 'DELETE FROM entities', params: [] },
    { text: insert('entities', ENTITY_COLS), params: [JSON.stringify(b.tables.entities)] },
    { text: insert('transactions', CHEQUE_COLS), params: [JSON.stringify(b.tables.transactions)] },
    { text: insert('purchases', PURCHASE_COLS), params: [JSON.stringify(b.tables.purchases)] },
  ]);
}
