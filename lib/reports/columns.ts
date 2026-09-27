import type { Column } from './types';

/** Column heading as shown on screen, PDF and Excel: money columns say "(LKR)" once, so cells hold plain numbers. */
export const columnLabel = (c: Column): string =>
  c.type === 'money' && !/LKR/i.test(c.label) ? `${c.label} (LKR)` : c.label;
