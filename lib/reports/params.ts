import { isMonthKey } from '@/lib/dates';
import { isDateKey, isUuid } from '@/lib/filters';
import type { ReportDefinition, ReportParams } from './types';

/**
 * Reads report parameters from the URL. When the user hasn't set any of the
 * report's own parameters yet, the report's defaults apply (e.g. "this month").
 */
export function parseReportParams(def: ReportDefinition, raw: URLSearchParams): ReportParams {
  const keys = ['from', 'to', 'entity', 'bank', 'month', 'period'];
  const touched = keys.some((k) => raw.has(k)) || raw.has('run');
  const base = touched ? {} : (def.defaults?.() ?? {});
  const from = raw.get('from');
  const to = raw.get('to');
  const entity = raw.get('entity');
  const month = raw.get('month');
  const period = raw.get('period');
  const bank = raw.get('bank')?.trim().slice(0, 100);
  return {
    ...base,
    ...(isDateKey(from) && { from }),
    ...(isDateKey(to) && { to }),
    ...(isUuid(entity) && { entityId: entity }),
    ...(bank && { bank }),
    ...(isMonthKey(month) && { month }),
    ...((period === 'month' || period === 'quarter' || period === 'year') && { period }),
  };
}

export function paramsToQuery(p: ReportParams): string {
  const q = new URLSearchParams({ run: '1' });
  if (p.from) q.set('from', p.from);
  if (p.to) q.set('to', p.to);
  if (p.entityId) q.set('entity', p.entityId);
  if (p.bank) q.set('bank', p.bank);
  if (p.month) q.set('month', p.month);
  if (p.period) q.set('period', p.period);
  return q.toString();
}
