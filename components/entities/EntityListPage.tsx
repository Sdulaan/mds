import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { getEntities } from '@/lib/data/entities';
import { formatAmount } from '@/lib/format';
import { btnPrimary, card, cn, input, td, th } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import { ENTITY_LABEL, type EntityType } from '@/types';

export default async function EntityListPage({ type, q }: { type: EntityType; q?: string }) {
  const entities = await getEntities(type, { q });
  const labels = ENTITY_LABEL[type];
  const base = type === 'CUSTOMER' ? '/customers' : '/creditors';
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
                  <th className={th}>Name</th>
                  <th className={th}>Contact</th>
                  <th className={th}>{type === 'CUSTOMER' ? 'Credit terms' : 'Opening balance'}</th>
                  <th className={`${th} text-right`}>Cheques</th>
                  <th className={`${th} text-right`}>{type === 'CUSTOMER' ? 'In hand / deposited' : 'Outstanding cheques'}</th>
                  <th className={th}>Status</th>
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
                      {type === 'CUSTOMER' ? e.credit_terms || '—' : Number(e.opening_balance) ? formatAmount(e.opening_balance) : '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums text-muted`}>{e.cheque_count}</td>
                    <td className={`${td} whitespace-nowrap text-right font-medium tabular-nums text-fg`}>
                      {e.outstanding_amount ? formatAmount(e.outstanding_amount) : '—'}
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
