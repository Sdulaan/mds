import type { SortDir } from '@/lib/sort';
import type { EntityType } from '@/types';

export type ColumnType = 'text' | 'date' | 'money' | 'number' | 'status';

export interface Column {
  key: string;
  label: string;
  type?: ColumnType;
}

export type Cell = string | number | null;

export interface Row {
  cells: Record<string, Cell>;
  /** subtotal = group/month subtotal, total = section total */
  kind?: 'data' | 'subtotal' | 'total';
  /** Rows of the same group stay together when sorting (for groups without a subtotal row). */
  group?: string;
  /** Values to sort by instead of the displayed cells, e.g. 'YYYY-MM' for a month label. */
  sortKeys?: Record<string, Cell>;
}

export interface Section {
  title?: string;
  columns: Column[];
  rows: Row[];
  /** Cell key the subtotal groups are based on; groups are reordered when sorting by it. */
  blockKey?: string;
  /** 'YYYY-MM' for month sections, so a date sort can reorder them. */
  month?: string;
  /** Fixed layout (e.g. a statement): column sorting leaves it as it is. */
  noSort?: boolean;
}

export interface ReportData {
  title: string;
  /** Describes the parameters, e.g. "1 Sept 2026 – 30 Sept 2026 · Commercial Bank" */
  subtitle: string;
  summary: { label: string; value: string }[];
  sections: Section[];
}

/**
 * monthOrRange: a Month ⇄ Date range switch (summary reports); only the chosen mode is used.
 * periodOrRange: like monthOrRange, but the month side also has a Monthly / Quarterly / Annual choice.
 * bookBalance: optional "balance as per cash book" for the bank reconciliation statement.
 */
export type ParamKind = 'dateRange' | 'entity' | 'bank' | 'month' | 'monthOrRange' | 'periodOrRange' | 'bookBalance' | 'period' | 'register';

export interface ReportParams {
  from?: string;
  to?: string;
  entityId?: string;
  bank?: string;
  month?: string;
  period?: 'month' | 'quarter' | 'year';
  /** Which half of a Month ⇄ Date switch is in use. */
  mode?: 'month' | 'date';
  bookBalance?: number;
  /** Column key to sort by (see lib/reports/sort.ts); default is the report's own order. */
  sort?: string;
  dir?: SortDir;
}

export interface ReportDefinition {
  slug: string;
  title: string;
  group: 'Receivables' | 'Payables' | 'Summary' | 'Registers';
  description: string;
  params: ParamKind[];
  /** Which entity list the "entity" parameter uses. */
  entityType?: EntityType;
  /** What the date range filters on, shown next to the inputs. */
  dateLabel?: string;
  /** Parameter defaults applied when the user hasn't chosen any. */
  defaults?: () => ReportParams;
  build: (params: ReportParams, raw: URLSearchParams) => Promise<ReportData>;
}
