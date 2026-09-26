const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  minimumFractionDigits: 2,
});

export function formatAmount(amount: string | number): string {
  return lkr.format(Number(amount));
}

/** Plain number with 2 decimals and thousands separators, for reports. */
export function formatNumber(amount: string | number): string {
  return Number(amount).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
