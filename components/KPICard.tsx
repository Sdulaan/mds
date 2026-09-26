interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  /** Full Tailwind class (e.g. 'hover:shadow-sky-500/10') — must be a literal so Tailwind generates it. */
  glowClass: string;
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  glowClass,
}: KPICardProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-slate-800/60 backdrop-blur-sm p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl ${glowClass}`}>
      {/* Background glow */}
      <div className={`absolute -right-6 -top-6 h-32 w-32 rounded-full ${gradient} opacity-10 blur-2xl`} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${gradient} shadow-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
