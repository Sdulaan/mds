import { card } from '@/lib/ui';

type Tone = 'credit' | 'debit' | 'cleared' | 'brand' | 'bounced' | 'pending' | 'neutral';

// Literal class names per tone so Tailwind generates them.
const tones: Record<Tone, { chip: string; bar: string }> = {
  credit: { chip: 'bg-credit-soft text-credit', bar: 'bg-credit' },
  debit: { chip: 'bg-debit-soft text-debit', bar: 'bg-debit' },
  cleared: { chip: 'bg-cleared-soft text-cleared', bar: 'bg-cleared' },
  brand: { chip: 'bg-brand-soft text-brand', bar: 'bg-brand' },
  bounced: { chip: 'bg-bounced-soft text-bounced', bar: 'bg-bounced' },
  pending: { chip: 'bg-pending-soft text-pending', bar: 'bg-pending' },
  neutral: { chip: 'bg-surface-2 text-muted', bar: 'bg-line-strong' },
};

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  tone: Tone;
}

export default function KPICard({ title, value, subtitle, icon, tone }: KPICardProps) {
  const t = tones[tone];
  return (
    <div className={`${card} relative overflow-hidden p-5`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} aria-hidden="true" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted">{title}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.chip}`}>{icon}</div>
      </div>
      {/* Full width so large LKR amounts (hundreds of millions) never get cut off */}
      <p className="mt-2 break-words text-xl font-bold leading-tight tracking-tight text-fg tabular-nums 2xl:text-2xl">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-subtle">{subtitle}</p>}
    </div>
  );
}
