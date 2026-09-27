import { formatNumber } from '@/lib/format';
import { card } from '@/lib/ui';
import ColumnChart, { type ColumnDatum } from './ColumnChart';

interface ChartCardProps {
  title: string;
  subtitle: string;
  data: ColumnDatum[];
  barClass: string;
  countLabel?: string;
}

/** A titled column chart with a collapsible table view (accessibility / exact values). */
export default function ChartCard({ title, subtitle, data, barClass, countLabel }: ChartCardProps) {
  return (
    <section className={`${card} p-5`}>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mb-4 text-xs text-muted">{subtitle}</p>
      <ColumnChart data={data} barClass={barClass} countLabel={countLabel} ariaLabel={`${title}. ${subtitle}`} />
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-fg">View as table</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-subtle">
              <th className="py-1 text-left font-medium">Month</th>
              {data.some((d) => d.count !== undefined) && <th className="py-1 text-right font-medium">Cheques</th>}
              <th className="py-1 text-right font-medium">Amount (LKR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.map((d) => (
              <tr key={d.key}>
                <td className="py-1 text-muted">{d.title}</td>
                {d.count !== undefined && <td className="py-1 text-right tabular-nums text-muted">{d.count.toLocaleString()}</td>}
                <td className="py-1 text-right tabular-nums text-fg">{formatNumber(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
