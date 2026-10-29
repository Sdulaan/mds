// Small helpers for reading and validating FormData in server actions.
import { dmyToIso } from '@/lib/dates';
import { isDateKey } from '@/lib/filters';

export const text = (fd: FormData, key: string, max = 255): string => String(fd.get(key) ?? '').trim().slice(0, max);
export const optionalText = (fd: FormData, key: string, max = 255): string | null => text(fd, key, max) || null;

/** 'YYYY-MM-DD' or null; accepts 'DD/MM/YYYY' input too. Throws on a malformed non-empty value. */
export function optionalDate(fd: FormData, key: string, label: string): string | null {
  const raw = text(fd, key, 10);
  if (!raw) return null;
  const v = dmyToIso(raw) ?? raw;
  if (!isDateKey(v)) throw new FormError(`${label} is not a valid date.`);
  return v;
}

export function money(fd: FormData, key: string, label: string, { allowZero = false } = {}): number {
  const raw = text(fd, key, 30).replace(/,/g, '');
  const n = Number(raw);
  if (raw === '' || isNaN(n)) throw new FormError(`${label} is required.`);
  if (allowZero ? n < 0 : n <= 0) throw new FormError(`${label} must be greater than zero.`);
  if (n > 999_999_999_999.99) throw new FormError(`${label} is too large.`);
  return Math.round(n * 100) / 100;
}

/** A validation error whose message is safe to show to the user. */
export class FormError extends Error {}

export const UNAUTHORIZED = { success: false, message: 'Your session has expired. Please sign in again.' } as const;
export const FORBIDDEN = { success: false, message: 'You do not have permission to do that.' } as const;
