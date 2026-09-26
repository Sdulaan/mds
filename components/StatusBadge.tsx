import { STATUS_LABEL, type ChequeStatus } from '@/types';

interface StatusBadgeProps {
  status: ChequeStatus;
  size?: 'sm' | 'md';
}

// Literal class names so Tailwind generates them.
const TONE: Record<ChequeStatus, string> = {
  IN_HAND: 'bg-pending-soft text-pending',
  PENDING: 'bg-pending-soft text-pending',
  DEPOSITED: 'bg-credit-soft text-credit',
  CREDITED: 'bg-cleared-soft text-cleared',
  CLEARED: 'bg-cleared-soft text-cleared',
  RETURNED: 'bg-bounced-soft text-bounced',
  CANCELLED: 'bg-surface-2 text-muted',
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ${sizeClass} ${TONE[status] ?? TONE.PENDING}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
