// ─── Domain Types ─────────────────────────────────────────────────────────────

export type EntityType = 'VENDOR' | 'CUSTOMER';
export type TransactionType = 'CREDIT' | 'DEBIT';
export type TransactionStatus = 'PENDING' | 'CLEARED' | 'BOUNCED';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  created_at: string;
}

export interface Transaction {
  id: string;
  transaction_type: TransactionType;
  entity_id: string;
  cheque_number: string;
  cheque_date: string;
  amount: string | number;
  status: TransactionStatus;
  grn_number?: string | null;
  remarks?: string | null;
  created_at: string;
}

/** Transaction row joined with entity name/type */
export interface TransactionWithEntity extends Transaction {
  entity_name: string;
  entity_type: EntityType;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface TransactionFilters {
  type?: TransactionType | 'ALL';
  status?: TransactionStatus | 'ALL';
  month?: string; // 'YYYY-MM' format, e.g. '2026-09'
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export interface DashboardMetrics {
  pendingCredits: number;
  pendingDebits: number;
  clearedThisMonth: number;
  totalOutstanding: number;
}

// ─── Server Action Results ────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
  data?: unknown;
}
