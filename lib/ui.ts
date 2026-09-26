// Shared Tailwind class strings, so every page uses the same building blocks.
// Colours are theme tokens defined in app/globals.css (light + dark).

export const card = 'rounded-xl border border-line bg-surface shadow-card';

export const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btnBase} bg-brand text-brand-fg hover:bg-brand-hover`;
export const btnSecondary = `${btnBase} border border-line bg-surface text-fg hover:bg-surface-2 hover:border-line-strong`;
export const btnSmall =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-50';

export const input =
  'w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
export const label = 'mb-1.5 block text-sm font-medium text-fg';

export const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted';
export const td = 'px-4 py-3';

export const alertError = 'rounded-lg border border-bounced/30 bg-bounced-soft px-4 py-3 text-sm text-bounced';
export const alertSuccess = 'rounded-lg border border-cleared/30 bg-cleared-soft px-4 py-3 text-sm text-cleared';

export const typeBadge = {
  CREDIT: 'bg-credit-soft text-credit',
  DEBIT: 'bg-debit-soft text-debit',
} as const;

export { twMerge as cn } from 'tailwind-merge';
