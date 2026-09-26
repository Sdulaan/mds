import { isMonthKey, monthLabel } from '@/lib/dates';
import {
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type TransactionFilters,
  type TransactionStatus,
  type TransactionType,
} from '@/types';

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function pick(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Parse and whitelist ledger/report filters from URL search params. */
export function parseFilters(params: RawParams): Required<Pick<TransactionFilters, 'type' | 'status'>> & {
  month: string;
} {
  const type = pick(params, 'type');
  const status = pick(params, 'status');
  const month = pick(params, 'month');
  return {
    type: TRANSACTION_TYPES.includes(type as TransactionType) ? (type as TransactionType) : 'ALL',
    status: TRANSACTION_STATUSES.includes(status as TransactionStatus)
      ? (status as TransactionStatus)
      : 'ALL',
    month: isMonthKey(month) ? month : '',
  };
}

export function filtersToQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.type && filters.type !== 'ALL') params.set('type', filters.type);
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.month) params.set('month', filters.month);
  return params.toString();
}

export function buildFilterLabel(filters: TransactionFilters): string {
  const parts: string[] = [];
  if (filters.type && filters.type !== 'ALL') parts.push(filters.type === 'CREDIT' ? 'Credits' : 'Debits');
  if (filters.status && filters.status !== 'ALL')
    parts.push(filters.status.charAt(0) + filters.status.slice(1).toLowerCase());
  if (filters.month) parts.push(monthLabel(filters.month));
  return parts.length > 0 ? parts.join(' · ') : 'All Transactions';
}
