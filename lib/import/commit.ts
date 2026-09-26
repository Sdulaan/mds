import 'server-only';
import { randomUUID } from 'node:crypto';
import { query, transaction } from '@/lib/db';
import { nameKey } from '@/lib/names';
import { todayKey } from '@/lib/dates';
import { ENTITY_TYPE_FOR, type ChequeStatus, type EntityType, type TransactionType } from '@/types';
import type { ParsedCheque } from './parse';

export interface ImportPlan {
  toInsert: (ParsedCheque & { entityId: string })[];
  newEntities: { id: string; name: string; type: EntityType }[];
  skippedExisting: number;
  skippedInFile: number;
  byStatus: Partial<Record<ChequeStatus, { count: number; amount: number }>>;
  byType: Record<TransactionType, { count: number; amount: number }>;
}

const key = (type: string, entityId: string, chequeNo: string, amount: number, date: string) =>
  `${type}|${entityId}|${chequeNo.toLowerCase()}|${amount.toFixed(2)}|${date}`;

/** Works out what an import would do, without writing anything. */
export async function planImport(cheques: ParsedCheque[]): Promise<ImportPlan> {
  // Match names ignoring case / spacing / punctuation against existing records.
  const existing = await query(`SELECT id, name, type FROM entities`);
  const byKey = new Map<string, string>(existing.map((e) => [`${e.type}|${nameKey(e.name)}`, e.id]));
  const newEntities: ImportPlan['newEntities'] = [];

  const withEntity = cheques.map((c) => {
    const type = ENTITY_TYPE_FOR[c.type];
    const k = `${type}|${nameKey(c.entityName)}`;
    let id = byKey.get(k);
    if (!id) {
      id = randomUUID();
      byKey.set(k, id);
      newEntities.push({ id, name: c.entityName, type });
    }
    return { ...c, entityId: id };
  });

  // Skip cheques already in the database (same type, entity, cheque no., amount and date) so re-importing is safe.
  const seen = new Set<string>();
  const dbRows = await query(`SELECT transaction_type, entity_id, cheque_number, amount, cheque_date::text FROM transactions`);
  for (const r of dbRows) seen.add(key(r.transaction_type, r.entity_id, r.cheque_number, parseFloat(r.amount), r.cheque_date));

  let skippedExisting = 0;
  let skippedInFile = 0;
  const fileKeys = new Set<string>();
  const toInsert: ImportPlan['toInsert'] = [];
  for (const c of withEntity) {
    const k = key(c.type, c.entityId, c.chequeNumber, c.amount, c.chequeDate);
    if (seen.has(k)) {
      skippedExisting++;
      continue;
    }
    if (fileKeys.has(k)) {
      skippedInFile++;
      continue;
    }
    fileKeys.add(k);
    toInsert.push(c);
  }

  const byStatus: ImportPlan['byStatus'] = {};
  const byType: ImportPlan['byType'] = { CREDIT: { count: 0, amount: 0 }, DEBIT: { count: 0, amount: 0 } };
  for (const c of toInsert) {
    const s = (byStatus[c.status] ??= { count: 0, amount: 0 });
    s.count++;
    s.amount += c.amount;
    byType[c.type].count++;
    byType[c.type].amount += c.amount;
  }

  const used = new Set(toInsert.map((c) => c.entityId));
  return { toInsert, newEntities: newEntities.filter((e) => used.has(e.id)), skippedExisting, skippedInFile, byStatus, byType };
}

const CHUNK = 1000;

/**
 * Writes the plan in a single transaction. Status dates aren't in the spreadsheets, so the
 * cheque date (or today, for post-dated cheques) is used for deposited/credited/cleared/etc.
 */
export function buildImportStatements(plan: ImportPlan, userId: string): { text: string; params: unknown[] }[] {
  const today = todayKey();
  const statements: { text: string; params: unknown[] }[] = [];

  if (plan.newEntities.length) {
    statements.push({
      text: `INSERT INTO entities (id, name, type, created_by, remarks)
             SELECT id, name, type, $4::uuid, 'Imported from Excel' FROM unnest($1::uuid[], $2::text[], $3::text[]) AS t(id, name, type)`,
      params: [plan.newEntities.map((e) => e.id), plan.newEntities.map((e) => e.name.slice(0, 255)), plan.newEntities.map((e) => e.type), userId],
    });
  }

  for (let i = 0; i < plan.toInsert.length; i += CHUNK) {
    const chunk = plan.toInsert.slice(i, i + CHUNK);
    const col = <T>(f: (c: (typeof chunk)[number]) => T) => chunk.map(f);
    const eventDate = (c: (typeof chunk)[number]) => (c.chequeDate < today ? c.chequeDate : today);
    statements.push({
      text: `INSERT INTO transactions
               (transaction_type, entity_id, cheque_number, cheque_date, amount, grn_number, bank_name, remarks, entry_date,
                deposited_date, cleared_date, returned_date, cancelled_date, created_by)
             SELECT * , $14::uuid FROM unnest(
               $1::text[], $2::uuid[], $3::text[], $4::date[], $5::numeric[], $6::text[], $7::text[], $8::text[], $9::date[],
               $10::date[], $11::date[], $12::date[], $13::date[])`,
      params: [
        col((c) => c.type),
        col((c) => c.entityId),
        col((c) => c.chequeNumber.slice(0, 100)),
        col((c) => c.chequeDate),
        col((c) => c.amount),
        col((c) => c.grnNumber?.slice(0, 100) ?? null),
        col((c) => c.bankName?.slice(0, 100) ?? null),
        col((c) => c.remarks?.slice(0, 2000) ?? null),
        col((c) => eventDate(c)),
        col((c) => (['DEPOSITED', 'CREDITED', 'RETURNED'].includes(c.status) ? eventDate(c) : null)),
        col((c) => (c.status === 'CREDITED' || c.status === 'CLEARED' ? eventDate(c) : null)),
        col((c) => (c.status === 'RETURNED' ? eventDate(c) : null)),
        col((c) => (c.status === 'CANCELLED' ? eventDate(c) : null)),
        userId,
      ],
    });
  }

  return statements;
}

export async function commitImport(plan: ImportPlan, userId: string): Promise<void> {
  await transaction(buildImportStatements(plan, userId));
}
