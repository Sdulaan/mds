import { formatNumber } from '@/lib/format';

/** Unpaid balance of a GRN, with a Paid / Part-paid / Over-paid note. */
export default function GrnBalance({ amount, paid }: { amount: number; paid: number }) {
  const balance = Math.round((amount - paid) * 100) / 100;
  if (balance === 0) return <span className="rounded-full bg-cleared-soft px-2 py-0.5 text-xs font-medium text-cleared">Paid</span>;
  if (balance < 0) {
    return (
      <span className="text-bounced" title="Cheques pay more than this GRN — cancel the old cheque and issue a new one">
        {formatNumber(balance)} <span className="text-xs">over-paid</span>
      </span>
    );
  }
  return (
    <span className="font-medium text-fg">
      {formatNumber(balance)}
      {paid > 0 && <span className="block text-[11px] font-normal text-subtle">part-paid</span>}
    </span>
  );
}
