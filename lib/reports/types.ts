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
}

export interface Section {
  title?: string;
  columns: Column[];
  rows: Row[];
}

export interface ReportData {
  title: string;
  /** Describes the parameters, e.g. "1 Sept 2026 – 30 Sept 2026 · Commercial Bank" */
  subtitle: string;
  summary: { label: string; value: string }[];
  sections: Section[];
}

export type ParamKind = 'dateRange' | 'entity' | 'bank' | 'month' | 'period' | 'register';

export interface ReportParams {
  from?: string;
  to?: string;
  entityId?: string;
  bank?: string;
  month?: string;
  period?: 'month' | 'quarter' | 'year';
}

export interface ReportDefinition {
  slug: string;
  title: string;
  group: 'Receivables' | 'Payables' | 'Registers';
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
