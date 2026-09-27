import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { ENTITY_SORT_KEYS, getEntities } from '@/lib/data/entities';
import { pick } from '@/lib/filters';
import { parseSort, sortHref } from '@/lib/sort';
import { formatNumber } from '@/lib/format';
import { btnPrimary, card, cn, input, td, th } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import SortHeader, { SortInputs } from '@/components/SortHeader';
import { ENTITY_LABEL, type EntityType } from '@/types';

export default async function EntityListPage({ type, searchParams }: { type: EntityType; searchParams: Record<string, string | string[] | undefined> }) {
  const q = pick(searchParams, 'q')?.trim() || undefined;
  const sort = parseSort(searchParams, ENTITY_SORT_KEYS);
  const entities = await getEntities(type, { q, sort });
  const labels = ENTITY_LABEL[type];
  const base = type === 'CUSTOMER' ? '/customers' : '/creditors';
  const href = (column: string) => sortHref(base, q ? `q=${encodeURIComponent(q)}` : '', sort, column);
  const active = entities.filter((e) => e.is_active).length;

  return (
    <div>
      <PageHeader
        title={labels.many}
        description={
          type === 'CUSTOMER'
            ? 'Customer (debtor) profiles for received cheques.'
            : 'Creditor profiles for issued cheques and purchases.'
        }
        actions={
          <Link href={`${base}/new`} className={btnPrimary}>
            <Plus className="h-4 w-4" /> Add {labels.one}
          </Link>
        }
      />

      <form className={`${card} mb-5 flex flex-wrap items-center gap-3 p-4`}>
        <SortInputs sort={sort} />
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            type="search" name="q" defaultValue={q ?? ''} placeholder={`Search ${labels.many.toLowerCase()} by name, phone or email…`}
            className={cn(input, 'pl-10')}
          />
        </div>
        <p className="text-sm text-muted">
          {entities.length} {entities.length === 1 ? labels.one.toLowerCase() : labels.many.toLowerCase()} · {active} active
        </p>
      </form>

      {entities.length === 0 ? (
        <p className={`${card} py-16 text-center text-sm text-subtle`}>
          {q ? 'No matches.' : `No ${labels.many.toLowerCase()} yet.`}
        </p>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <SortHeader label="Name" column="name" current={sort} href={href('name')} />
                  <th className={th}>Contact</th>
                  <SortHeader label={type === 'CUSTOMER' ? 'Credit terms' : 'Opening balance (LKR)'} column="terms" current={sort} href={href('terms')} />
                  <SortHeader label="Cheques" column="cheques" current={sort} href={href('cheques')} align="right" />
                  <SortHeader label={type === 'CUSTOMER' ? 'In hand / deposited (LKR)' : 'Uncleared cheques (LKR)'} column="outstanding" current={sort} href={href('outstanding')} align="right" />
                  <SortHeader label="Status" column="status" current={sort} href={href('status')} />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entities.map((e) => (
                  <tr key={e.id} className={`transition-colors hover:bg-surface-2/60 ${e.is_active ? '' : 'opacity-60'}`}>
                    <td className={td}>
                      <Link href={`${base}/${e.id}`} className="font-medium text-fg hover:text-brand">{e.name}</Link>
                      {e.address && <p className="max-w-72 truncate text-xs text-subtle">{e.address}</p>}
                    </td>
                    <td className={`${td} text-muted`}>
                      {e.contact_number && <p className="whitespace-nowrap">{e.contact_number}</p>}
                      {e.email && <p className="text-xs">{e.email}</p>}
                      {!e.contact_number && !e.email && <span className="text-subtle">—</span>}
                    </td>
                    <td className={`${td} text-muted`}>
                      {type === 'CUSTOMER' ? e.credit_terms || '—' : Number(e.opening_balance) ? formatNumber(e.opening_balance) : '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums text-muted`}>{e.cheque_count}</td>
                    <td className={`${td} whitespace-nowrap text-right font-medium tabular-nums text-fg`}>
                      {e.outstanding_amount ? formatNumber(e.outstanding_amount) : '—'}
                    </td>
                    <td className={td}>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.is_active ? 'bg-cleared-soft text-cleared' : 'bg-surface-2 text-muted'}`}>
                        {e.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
