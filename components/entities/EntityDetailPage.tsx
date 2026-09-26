import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Power, Trash2 } from 'lucide-react';
import { deleteEntity, setEntityActive } from '@/actions/entityActions';
import { canDelete, canEdit, isAdmin, requireUser } from '@/lib/auth';
import { getEntity, getEntityOptions } from '@/lib/data/entities';
import { isUuid } from '@/lib/filters';
import { btnSecondary, card, cn } from '@/lib/ui';
import ConfirmButton from '@/components/ConfirmButton';
import PageHeader from '@/components/PageHeader';
import RecordHistory from '@/components/RecordHistory';
import EntityForm from '@/components/entities/EntityForm';
import MergeEntity from '@/components/entities/MergeEntity';
import { ENTITY_LABEL, type EntityType } from '@/types';

export default async function EntityDetailPage({ type, id }: { type: EntityType; id: string }) {
  if (!isUuid(id)) notFound();
  const user = await requireUser();
  const entity = await getEntity(id);
  if (!entity || entity.type !== type) notFound();

  const labels = ENTITY_LABEL[type];
  const base = type === 'CUSTOMER' ? '/customers' : '/creditors';
  const register = type === 'CUSTOMER' ? '/receivables' : '/payables';
  const editable = canEdit(user, entity.created_by);
  const mergeOptions = isAdmin(user) ? await getEntityOptions(type) : [];

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={base} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> {labels.many}
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {entity.name}
            {!entity.is_active && <span className="rounded-full bg-surface-2 px-2.5 py-1 font-sans text-sm font-medium text-muted">Inactive</span>}
          </span>
        }
        description={<Link href={`${register}?entity=${entity.id}`} className="text-brand hover:underline">View cheques →</Link>}
        actions={
          <div className="flex flex-wrap items-start gap-2">
            {editable && (
              <ConfirmButton
                action={setEntityActive.bind(null, entity.id, !entity.is_active)}
                confirm={entity.is_active
                  ? `Mark ${entity.name} as inactive? It stays in historical reports but can't be used for new cheques.`
                  : `Reactivate ${entity.name}?`}
                className={btnSecondary}
              >
                <Power className="h-4 w-4" /> {entity.is_active ? 'Deactivate' : 'Activate'}
              </ConfirmButton>
            )}
            {canDelete(user) && (
              <ConfirmButton
                action={deleteEntity.bind(null, entity.id)}
                confirm={`Delete ${entity.name}? Only possible when no cheques or purchases are linked.`}
                redirectTo={base}
                className={cn(btnSecondary, 'text-bounced hover:border-bounced/40')}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </ConfirmButton>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className={`${card} p-6 sm:p-8`}>
          {!editable && (
            <p className="mb-5 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">View only — you can edit only the records you created.</p>
          )}
          <EntityForm type={type} entity={entity} readOnly={!editable} />
        </div>
        <div className="space-y-6">
          {isAdmin(user) && (
            <section className={`${card} p-5`}>
              <h2 className="mb-2 text-base font-semibold text-fg">Merge duplicate</h2>
              <MergeEntity sourceId={entity.id} sourceName={entity.name} options={mergeOptions} basePath={base} />
            </section>
          )}
          <RecordHistory table="entities" record={entity} />
        </div>
      </div>
    </div>
  );
}
