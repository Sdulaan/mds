// ─── Domain Types ─────────────────────────────────────────────────────────────

/** CUSTOMER = debtor (issues cheques to us). VENDOR = creditor (we issue cheques to them). */
export type EntityType = 'VENDOR' | 'CUSTOMER';
/** CREDIT = customer cheque received (receivables). DEBIT = cheque issued to a creditor (payables). */
export type TransactionType = 'CREDIT' | 'DEBIT';

export type ReceivableStatus = 'IN_HAND' | 'DEPOSITED' | 'CREDITED' | 'RETURNED';
export type PayableStatus = 'PENDING' | 'CLEARED' | 'CANCELLED';
export type ChequeStatus = ReceivableStatus | PayableStatus;

export type Role = 'ADMIN' | 'STANDARD';

export const TRANSACTION_TYPES: TransactionType[] = ['CREDIT', 'DEBIT'];

export const STATUSES_FOR: Record<TransactionType, ChequeStatus[]> = {
  CREDIT: ['IN_HAND', 'DEPOSITED', 'CREDITED', 'RETURNED'],
  DEBIT: ['PENDING', 'CLEARED', 'CANCELLED'],
};

export const STATUS_LABEL: Record<ChequeStatus, string> = {
  IN_HAND: 'In Hand',
  DEPOSITED: 'Deposited',
  CREDITED: 'Credited',
  RETURNED: 'Returned',
  PENDING: 'Pending',
  CLEARED: 'Cleared',
  CANCELLED: 'Cancelled',
};

/** Credits are received from customers; debits are paid to creditors (vendors). */
export const ENTITY_TYPE_FOR: Record<TransactionType, EntityType> = {
  CREDIT: 'CUSTOMER',
  DEBIT: 'VENDOR',
};

export const ENTITY_LABEL: Record<EntityType, { one: string; many: string }> = {
  CUSTOMER: { one: 'Customer', many: 'Customers' },
  VENDOR: { one: 'Creditor', many: 'Creditors' },
};

/** The status checkboxes shown for each cheque type, in order. Each maps to a date column. */
export type StatusFlag = 'deposited' | 'cleared' | 'returned' | 'cancelled';
export const FLAGS_FOR: Record<TransactionType, { flag: StatusFlag; label: string }[]> = {
  CREDIT: [
    { flag: 'deposited', label: 'Deposited' },
    { flag: 'cleared', label: 'Credited' },
    { flag: 'returned', label: 'Returned' },
  ],
  DEBIT: [
    { flag: 'cleared', label: 'Cleared' },
    { flag: 'cancelled', label: 'Cancelled' },
  ],
};

export interface AuditColumns {
  created_at: string;
  created_by: string | null;
  created_by_name?: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name?: string | null;
}

export interface Entity extends AuditColumns {
  id: string;
  name: string;
  type: EntityType;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  credit_terms: string | null;
  opening_balance: string | number;
  remarks: string | null;
  is_active: boolean;
}

export interface Transaction extends AuditColumns {
  id: string;
  transaction_type: TransactionType;
  entity_id: string;
  cheque_number: string;
  cheque_date: string;
  amount: string | number;
  status: ChequeStatus;
  bank_name: string | null;
  grn_number: string | null;
  remarks: string | null;
  entry_date: string;
  deposited_date: string | null;
  cleared_date: string | null;
  returned_date: string | null;
  cancelled_date: string | null;
}

/** Transaction row joined with entity name/type */
export interface TransactionWithEntity extends Transaction {
  entity_name: string;
  entity_type: EntityType;
  entity_active: boolean;
}

export interface Purchase extends AuditColumns {
  id: string;
  entity_id: string;
  entity_name: string;
  grn_number: string | null;
  invoice_number: string | null;
  purchase_date: string;
  amount: string | number;
  remarks: string | null;
}

export interface AppUser {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  entity_table: string;
  record_id: string | null;
  action: string;
  summary: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  username: string | null;
  created_at: string;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface ChequeFilters {
  type: TransactionType;
  q?: string; // matches entity name, GRN, cheque number or amount
  status?: ChequeStatus | 'ALL';
  entityId?: string;
  month?: string; // 'YYYY-MM' (cheque date)
  from?: string; // 'YYYY-MM-DD' (cheque date)
  to?: string;
  bank?: string;
}

// ─── Server Action Results ────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
  /** Set when a duplicate was detected; admins may resubmit with override. */
  duplicate?: boolean;
  data?: unknown;
}
