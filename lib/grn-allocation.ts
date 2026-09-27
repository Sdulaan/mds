// How a creditor cheque's amount is applied to the GRNs it pays. Shared by the cheque form
// (live preview) and saveCheque (the real thing), so both always agree.

export interface GrnOption {
  id: string;
  entity_id: string;
  grn_number: string;
  purchase_date: string;
  /** GRN (purchase) amount. */
  amount: number;
  /** Still unpaid, ignoring cancelled cheques (and the cheque being edited). */
  remaining: number;
}

export interface Allocation {
  grn: GrnOption;
  amount: number;
}

const cents = (n: number) => Math.round(n * 100);

/** Oldest GRN first (by date, then as listed). */
export const byDate = (a: GrnOption, b: GrnOption) => a.purchase_date.localeCompare(b.purchase_date);

/**
 * Applies `amount` to the GRNs oldest first, each up to its unpaid balance.
 *   unallocated > 0 → the amount is more than the GRNs' unpaid total
 *   unused          → selected GRNs the amount doesn't reach
 */
export function allocate(amount: number, grns: GrnOption[]): { allocations: Allocation[]; unallocated: number; unused: GrnOption[] } {
  let left = cents(amount);
  const allocations: Allocation[] = [];
  const unused: GrnOption[] = [];
  for (const grn of [...grns].sort(byDate)) {
    const take = Math.min(left, Math.max(0, cents(grn.remaining)));
    if (take > 0) {
      allocations.push({ grn, amount: take / 100 });
      left -= take;
    } else {
      unused.push(grn);
    }
  }
  return { allocations, unallocated: left / 100, unused };
}

export const unpaidTotal = (grns: GrnOption[]) => grns.reduce((s, g) => s + Math.max(0, cents(g.remaining)), 0) / 100;
