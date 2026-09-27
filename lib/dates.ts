// All "today / this month" logic uses the company's local time, not the
// server's clock (which is UTC on most hosts).
export const APP_TIMEZONE = 'Asia/Colombo';

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Current month in the app timezone, as 'YYYY-MM'. */
export function currentMonthKey(date = new Date()): string {
  const { year, month } = localParts(date);
  return `${year}-${pad(month)}`;
}

/** Today in the app timezone, as 'YYYY-MM-DD'. */
export function todayKey(date = new Date()): string {
  const { year, month, day } = localParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Current hour (0–23) in the app timezone. */
export function currentHour(date = new Date()): number {
  return localParts(date).hour;
}

/** Human label for a 'YYYY-MM' key, e.g. 'September 2026'. */
export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Shift a 'YYYY-MM' key by `delta` months. */
export function addMonths(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Last day of a 'YYYY-MM' month as 'YYYY-MM-DD'. */
export function monthEnd(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${key}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
}

/**
 * Month options, newest first: `ahead` future months (for post-dated cheques), the current month
 * and the `count - 1` months before it. Anchored on the first of the month so no month is skipped.
 */
export function recentMonths(count = 24, ahead = 0): { value: string; label: string }[] {
  const now = currentMonthKey();
  return Array.from({ length: count + ahead }, (_, i) => {
    const value = addMonths(now, ahead - i);
    return { value, label: monthLabel(value) };
  });
}

/** How far ahead month filters reach: covers post-dated cheques on long credit terms. */
export const MONTHS_AHEAD = 4;

/** Parse Date objects, ISO strings and Postgres text timestamps ('2026-09-26 14:05:01.12+00'). */
export function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
}

/** Format a 'YYYY-MM-DD' (or ISO timestamp) string as '26 Sept 2026' without timezone drift. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const date = isDateOnly ? new Date(`${dateStr}T00:00:00Z`) : toDate(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: isDateOnly ? 'UTC' : APP_TIMEZONE,
  });
}

export function formatDateTime(date: Date | string): string {
  return toDate(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  });
}

export function isMonthKey(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
