import type { TransactionStatus } from '@/types';

interface StatusBadgeProps {
  status: TransactionStatus;
  size?: 'sm' | 'md';
}

const config: Record<TransactionStatus, { label: string; className: string }> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/30',
  },
  CLEARED: {
    label: 'Cleared',
    className: 'bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/30',
  },
  BOUNCED: {
    label: 'Bounced',
    className: 'bg-rose-400/10 text-rose-400 ring-1 ring-rose-400/30',
  },
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { label, className } = config[status] ?? config.PENDING;
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${className}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
