import { formatDate, isMonthKey, monthLabel } from '@/lib/dates';
import { STATUSES_FOR, STATUS_LABEL, type ChequeFilters, type ChequeStatus, type TransactionType } from '@/types';

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

export function pick(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string | undefined | null): v is string => !!v && UUID_RE.test(v);
export const isDateKey = (v: string | undefined | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Parse and whitelist register filters from URL search params. */
export function parseChequeFilters(params: RawParams, type: TransactionType): ChequeFilters {
  const status = pick(params, 'status');
  const q = pick(params, 'q')?.trim().slice(0, 100);
  const bank = pick(params, 'bank')?.trim().slice(0, 100);
  return {
    type,
    q: q || undefined,
    status: STATUSES_FOR[type].includes(status as ChequeStatus) ? (status as ChequeStatus) : 'ALL',
    entityId: isUuid(pick(params, 'entity')) ? pick(params, 'entity') : undefined,
    month: isMonthKey(pick(params, 'month')) ? pick(params, 'month') : undefined,
    from: isDateKey(pick(params, 'from')) ? pick(params, 'from') : undefined,
    to: isDateKey(pick(params, 'to')) ? pick(params, 'to') : undefined,
    bank: bank || undefined,
  };
}

export function filtersToQuery(filters: Partial<ChequeFilters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.entityId) params.set('entity', filters.entityId);
  if (filters.month) params.set('month', filters.month);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.bank) params.set('bank', filters.bank);
  return params.toString();
}

export function buildFilterLabel(filters: ChequeFilters, entityName?: string): string {
  const parts: string[] = [];
  if (filters.status && filters.status !== 'ALL') parts.push(STATUS_LABEL[filters.status]);
  if (entityName) parts.push(entityName);
  if (filters.month) parts.push(monthLabel(filters.month));
  if (filters.from || filters.to) {
    parts.push(`${filters.from ? formatDate(filters.from) : '…'} – ${filters.to ? formatDate(filters.to) : '…'}`);
  }
  if (filters.bank) parts.push(filters.bank);
  if (filters.q) parts.push(`"${filters.q}"`);
  return parts.length > 0 ? parts.join(' · ') : 'All cheques';
}
