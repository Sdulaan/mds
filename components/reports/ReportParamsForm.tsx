import { currentMonthKey } from '@/lib/dates';
import { btnPrimary, cn, input } from '@/lib/ui';
import PeriodPicker from '@/components/reports/PeriodPicker';
import type { ReportDefinition, ReportParams } from '@/lib/reports/types';

interface ReportParamsFormProps {
  def: ReportDefinition;
  params: ReportParams;
  entities: { id: string; name: string }[];
  banks: string[];
  months: { value: string; label: string }[];
}

// Plain GET form: the chosen options end up in the URL, so reports can be bookmarked.
export default function ReportParamsForm({ def, params, entities, banks, months }: ReportParamsFormProps) {
  const labelClass = 'mb-1 block text-xs font-medium text-muted';
  const field = cn(input, 'w-auto py-2');
  const has = (k: ReportDefinition['params'][number]) => def.params.includes(k);

  return (
    <form className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="run" value="1" />
      {has('monthOrRange') && (
        <PeriodPicker
          initial={params.mode === 'date' || (!params.month && (params.from || params.to)) ? 'date' : 'month'}
          month={params.month ?? currentMonthKey()}
          from={params.from}
          to={params.to}
          months={months}
          labelClass={labelClass}
          field={field}
        />
      )}
      {has('bookBalance') && (
        <div>
          <label htmlFor="r-book" className={labelClass}>Balance as per cash book (optional)</label>
          <input
            id="r-book" type="number" name="book" step="0.01" placeholder="0.00"
            defaultValue={params.bookBalance ?? ''} className={cn(field, 'w-44 tabular-nums')}
          />
        </div>
      )}
      {has('period') && (
        <div>
          <label htmlFor="r-period" className={labelClass}>Period</label>
          <select id="r-period" name="period" defaultValue={params.period ?? 'month'} className={field}>
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Annual</option>
          </select>
        </div>
      )}
      {has('month') && (
        <div>
          <label htmlFor="r-month" className={labelClass}>{has('period') ? 'Month (or any month in the quarter/year)' : 'Month'}</label>
          <select id="r-month" name="month" defaultValue={params.month ?? currentMonthKey()} className={field}>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      )}
      {has('dateRange') && (
        <>
          <div>
            <label htmlFor="r-from" className={labelClass}>{def.dateLabel ?? 'Date'} from</label>
            <input id="r-from" type="date" name="from" defaultValue={params.from ?? ''} className={field} />
          </div>
          <div>
            <label htmlFor="r-to" className={labelClass}>to</label>
            <input id="r-to" type="date" name="to" defaultValue={params.to ?? ''} className={field} />
          </div>
        </>
      )}
      {has('entity') && (
        <div>
          <label htmlFor="r-entity" className={labelClass}>{def.entityType === 'CUSTOMER' ? 'Customer' : 'Creditor'}</label>
          <select id="r-entity" name="entity" defaultValue={params.entityId ?? ''} className={cn(field, 'max-w-60')}>
            <option value="">All</option>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      )}
      {has('bank') && banks.length > 0 && (
        <div>
          <label htmlFor="r-bank" className={labelClass}>Bank</label>
          <select id="r-bank" name="bank" defaultValue={params.bank ?? ''} className={field}>
            <option value="">All banks</option>
            {banks.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      )}
      <button type="submit" className={cn(btnPrimary, 'py-2')}>Run report</button>
    </form>
  );
}
