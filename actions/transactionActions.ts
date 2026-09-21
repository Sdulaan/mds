'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import type {
  TransactionWithEntity,
  TransactionFilters,
  DashboardMetrics,
  ActionResult,
  TransactionStatus,
} from '@/types';

// ─── addTransaction ───────────────────────────────────────────────────────────

export async function addTransaction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const transaction_type = formData.get('transaction_type') as string;
    const entity_id = formData.get('entity_id') as string;
    const cheque_number = formData.get('cheque_number') as string;
    const cheque_date = formData.get('cheque_date') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const grn_number = (formData.get('grn_number') as string) || null;
    const remarks = (formData.get('remarks') as string) || null;

    if (!transaction_type || !entity_id || !cheque_number || !cheque_date || isNaN(amount)) {
      return { success: false, message: 'Please fill in all required fields.' };
    }

    if (!['CREDIT', 'DEBIT'].includes(transaction_type)) {
      return { success: false, message: 'Invalid transaction type.' };
    }

    if (amount <= 0) {
      return { success: false, message: 'Amount must be greater than zero.' };
    }

    await sql`
      INSERT INTO transactions
        (transaction_type, entity_id, cheque_number, cheque_date, amount, status, grn_number, remarks)
      VALUES
        (${transaction_type}, ${entity_id}, ${cheque_number}, ${cheque_date}, ${amount}, 'PENDING', ${grn_number}, ${remarks})
    `;

    revalidatePath('/ledger');
    revalidatePath('/');

    return { success: true, message: 'Cheque added successfully.' };
  } catch (error) {
    console.error('[addTransaction]', error);
    return { success: false, message: 'Failed to add cheque. Please try again.' };
  }
}

// ─── getTransactions ──────────────────────────────────────────────────────────

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionWithEntity[]> {
  const { type = 'ALL', status = 'ALL', month } = filters;

  // Build conditional clauses
  const typeClause = type !== 'ALL' ? sql`AND t.transaction_type = ${type}` : sql``;
  const statusClause = status !== 'ALL' ? sql`AND t.status = ${status}` : sql``;
  const monthClause = month
    ? sql`AND TO_CHAR(t.cheque_date, 'YYYY-MM') = ${month}`
    : sql``;

  const rows = await sql`
    SELECT
      t.id,
      t.transaction_type,
      t.entity_id,
      t.cheque_number,
      t.cheque_date::text,
      t.amount,
      t.status,
      t.grn_number,
      t.remarks,
      t.created_at::text,
      e.name AS entity_name,
      e.type AS entity_type
    FROM transactions t
    JOIN entities e ON e.id = t.entity_id
    WHERE 1=1
      ${typeClause}
      ${statusClause}
      ${monthClause}
    ORDER BY t.cheque_date DESC, t.created_at DESC
  `;

  return rows as TransactionWithEntity[];
}

// ─── updateTransactionStatus ──────────────────────────────────────────────────

export async function updateTransactionStatus(
  id: string,
  newStatus: TransactionStatus
): Promise<ActionResult> {
  try {
    if (!['PENDING', 'CLEARED', 'BOUNCED'].includes(newStatus)) {
      return { success: false, message: 'Invalid status.' };
    }

    const result = await sql`
      UPDATE transactions
      SET status = ${newStatus}
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return { success: false, message: 'Transaction not found.' };
    }

    revalidatePath('/ledger');
    revalidatePath('/');

    return { success: true, message: `Status updated to ${newStatus}.` };
  } catch (error) {
    console.error('[updateTransactionStatus]', error);
    return { success: false, message: 'Failed to update status.' };
  }
}

// ─── getMetrics ───────────────────────────────────────────────────────────────

export async function getMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [pendingCredits, pendingDebits, clearedThisMonth, totalOutstanding] =
    await Promise.all([
      sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE status = 'PENDING' AND transaction_type = 'CREDIT'
      `,
      sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE status = 'PENDING' AND transaction_type = 'DEBIT'
      `,
      sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE status = 'CLEARED'
          AND TO_CHAR(cheque_date, 'YYYY-MM') = ${currentMonth}
      `,
      sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE status = 'PENDING'
      `,
    ]);

  return {
    pendingCredits: parseFloat(String(pendingCredits[0]?.total ?? 0)),
    pendingDebits: parseFloat(String(pendingDebits[0]?.total ?? 0)),
    clearedThisMonth: parseFloat(String(clearedThisMonth[0]?.total ?? 0)),
    totalOutstanding: parseFloat(String(totalOutstanding[0]?.total ?? 0)),
  };
}

// ─── getRecentTransactions ────────────────────────────────────────────────────

export async function getRecentTransactions(limit = 5): Promise<TransactionWithEntity[]> {
  const rows = await sql`
    SELECT
      t.id,
      t.transaction_type,
      t.entity_id,
      t.cheque_number,
      t.cheque_date::text,
      t.amount,
      t.status,
      t.grn_number,
      t.remarks,
      t.created_at::text,
      e.name AS entity_name,
      e.type AS entity_type
    FROM transactions t
    JOIN entities e ON e.id = t.entity_id
    ORDER BY t.created_at DESC
    LIMIT ${limit}
  `;

  return rows as TransactionWithEntity[];
}
