// All "today / this month" logic uses the pharmacy's local time, not the
// server's clock (which is UTC on most hosts).
export const APP_TIMEZONE = 'Asia/Colombo';

function localParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), hour: get('hour') };
}

/** Current month in the app timezone, as 'YYYY-MM'. */
export function currentMonthKey(date = new Date()): string {
  const { year, month } = localParts(date);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Current hour (0–23) in the app timezone. */
export function currentHour(date = new Date()): number {
  return localParts(date).hour;
}

/** Human label for a 'YYYY-MM' key, e.g. 'September 2026'. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The last `count` months (newest first), anchored on the first of the month so no month is skipped. */
export function recentMonths(count = 24): { value: string; label: string }[] {
  const [year, month] = currentMonthKey().split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { value, label: monthLabel(value) };
  });
}

/** Format a 'YYYY-MM-DD' (or ISO timestamp) string as '26 Sept 2026' without timezone drift. */
export function formatDate(dateStr: string): string {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const date = isDateOnly ? new Date(`${dateStr}T00:00:00Z`) : new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: isDateOnly ? 'UTC' : APP_TIMEZONE,
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-GB', {
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
