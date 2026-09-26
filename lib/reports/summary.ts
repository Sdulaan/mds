import {
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type EntityType,
  type TransactionStatus,
  type TransactionType,
  type TransactionWithEntity,
} from '@/types';

export interface Bucket {
  count: number;
  amount: number;
}

export interface EntitySummary {
  name: string;
  type: EntityType;
  count: number;
  pending: number;
  cleared: number;
  bounced: number;
  total: number;
}

export interface ReportSummary {
  count: number;
  total: number;
  byStatus: Record<TransactionStatus, Bucket>;
  /** byType[type][status] plus byType[type].ALL */
  byType: Record<TransactionType, Record<TransactionStatus | 'ALL', Bucket>>;
  byEntity: EntitySummary[];
}

const emptyBucket = (): Bucket => ({ count: 0, amount: 0 });

export function summarize(transactions: TransactionWithEntity[]): ReportSummary {
  const byStatus = Object.fromEntries(TRANSACTION_STATUSES.map((s) => [s, emptyBucket()])) as ReportSummary['byStatus'];
  const byType = Object.fromEntries(
    TRANSACTION_TYPES.map((t) => [
      t,
      Object.fromEntries([...TRANSACTION_STATUSES, 'ALL'].map((s) => [s, emptyBucket()])),
    ])
  ) as ReportSummary['byType'];
  const entities = new Map<string, EntitySummary>();

  let total = 0;
  for (const tx of transactions) {
    const amount = Number(tx.amount);
    total += amount;

    byStatus[tx.status].count++;
    byStatus[tx.status].amount += amount;
    byType[tx.transaction_type][tx.status].count++;
    byType[tx.transaction_type][tx.status].amount += amount;
    byType[tx.transaction_type].ALL.count++;
    byType[tx.transaction_type].ALL.amount += amount;

    let e = entities.get(tx.entity_id);
    if (!e) {
      e = { name: tx.entity_name, type: tx.entity_type, count: 0, pending: 0, cleared: 0, bounced: 0, total: 0 };
      entities.set(tx.entity_id, e);
    }
    e.count++;
    e.total += amount;
    if (tx.status === 'PENDING') e.pending += amount;
    else if (tx.status === 'CLEARED') e.cleared += amount;
    else e.bounced += amount;
  }

  return {
    count: transactions.length,
    total,
    byStatus,
    byType,
    byEntity: [...entities.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
  };
}

/** e.g. MDS_Cheques_Credits_September_2026_2026-09-26.pdf */
export function reportFilename(filterLabel: string, ext: 'pdf' | 'xlsx', today: string): string {
  const slug = filterLabel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `MDS_Cheques_${slug}_${today}.${ext}`;
}
