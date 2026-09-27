import { isMonthKey } from '@/lib/dates';
import { isDateKey, isUuid } from '@/lib/filters';
import type { ReportDefinition, ReportParams } from './types';

/**
 * Reads report parameters from the URL. When the user hasn't set any of the
 * report's own parameters yet, the report's defaults apply (e.g. "this month").
 */
export function parseReportParams(def: ReportDefinition, raw: URLSearchParams): ReportParams {
  const keys = ['from', 'to', 'entity', 'bank', 'month', 'period', 'mode', 'book'];
  const touched = keys.some((k) => raw.has(k)) || raw.has('run');
  const base = touched ? {} : (def.defaults?.() ?? {});
  const from = raw.get('from');
  const to = raw.get('to');
  const entity = raw.get('entity');
  const month = raw.get('month');
  const period = raw.get('period');
  const bank = raw.get('bank')?.trim().slice(0, 100);
  const sort = raw.get('sort');
  const mode = raw.get('mode');
  const book = Number(raw.get('book')?.replace(/,/g, '') || NaN);
  const params: ReportParams = {
    ...base,
    ...(isDateKey(from) && { from }),
    ...(isDateKey(to) && { to }),
    ...(isUuid(entity) && { entityId: entity }),
    ...(bank && { bank }),
    ...(isMonthKey(month) && { month }),
    ...((period === 'month' || period === 'quarter' || period === 'year') && { period }),
    ...(sort && /^[a-z_]{1,40}$/.test(sort) && { sort, dir: raw.get('dir') === 'desc' ? 'desc' as const : 'asc' as const }),
    ...((mode === 'month' || mode === 'date') && { mode }),
    ...(Number.isFinite(book) && Math.abs(book) < 1e12 && { bookBalance: book }),
  };
  // Month-wise or date-wise, never both.
  if (params.mode === 'date') delete params.month;
  if (params.mode === 'month') {
    delete params.from;
    delete params.to;
  }
  return params;
}

export function paramsToQuery(p: ReportParams): string {
  const q = new URLSearchParams({ run: '1' });
  if (p.from) q.set('from', p.from);
  if (p.to) q.set('to', p.to);
  if (p.entityId) q.set('entity', p.entityId);
  if (p.bank) q.set('bank', p.bank);
  if (p.month) q.set('month', p.month);
  if (p.period) q.set('period', p.period);
  if (p.mode) q.set('mode', p.mode);
  if (p.bookBalance !== undefined) q.set('book', String(p.bookBalance));
  if (p.sort) {
    q.set('sort', p.sort);
    q.set('dir', p.dir ?? 'asc');
  }
  return q.toString();
}
