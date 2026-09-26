import { Suspense } from 'react';
import { getEntities } from '@/lib/queries';
import { formatDate } from '@/lib/dates';
import AddEntityForm from './AddEntityForm';
import DeleteEntityButton from './DeleteEntityButton';
import type { Metadata } from 'next';
import type { Entity } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Entities',
  description: 'Manage vendors and customers for the cheque management system.',
};

function EntityGroup({ title, items, color }: { title: string; items: Entity[]; color: string }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className="ml-auto rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-slate-600">
          No {title.toLowerCase()} yet
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-800/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-slate-800/20">
              {items.map((entity) => (
                <tr key={entity.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{entity.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        entity.type === 'VENDOR'
                          ? 'bg-violet-400/10 text-violet-400'
                          : 'bg-sky-400/10 text-sky-400'
                      }`}
                    >
                      {entity.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {formatDate(entity.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteEntityButton id={entity.id} name={entity.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function EntitiesTable() {
  const entities = await getEntities();

  const vendors = entities.filter((e) => e.type === 'VENDOR');
  const customers = entities.filter((e) => e.type === 'CUSTOMER');

  return (
    <div className="space-y-8">
      <EntityGroup title="Vendors (Creditors)" items={vendors} color="bg-violet-400" />
      <EntityGroup title="Customers (Debtors)" items={customers} color="bg-sky-400" />
    </div>
  );
}

export default function EntitiesPage() {
  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Entities</h1>
        <p className="mt-1 text-slate-400">
          Manage vendors and customers used in cheque transactions.
        </p>
      </div>

      {/* Add Entity Form */}
      <div className="mb-8">
        <AddEntityForm />
      </div>

      {/* Entity Tables */}
      <Suspense
        fallback={
          <div className="animate-pulse space-y-8">
            <div className="h-48 rounded-xl bg-slate-800/60" />
            <div className="h-48 rounded-xl bg-slate-800/60" />
          </div>
        }
      >
        <EntitiesTable />
      </Suspense>
    </div>
  );
}
