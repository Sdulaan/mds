import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { card } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import BackupPanel from '@/components/admin/BackupPanel';

export const metadata: Metadata = { title: 'Backup & Restore' };

export default async function BackupPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Backup & Restore" description="Protect the data with manual backups; automatic daily backups run separately." />
      <BackupPanel />
      <section className={`${card} mt-6 p-5 text-sm text-muted`}>
        <h2 className="mb-2 text-base font-semibold text-fg">Automatic daily backups</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-fg">Database history:</strong> Neon keeps a short restore history of the database, so it can be rolled back to an earlier point in time from the Neon console.
          </li>
          <li>
            <strong className="text-fg">Daily off-site copy:</strong> a scheduled GitHub Actions job (<code className="text-fg">.github/workflows/daily-backup.yml</code>) takes a full database dump every night and keeps each one for 30 days, separate from Neon. It needs the <code className="text-fg">DATABASE_URL</code> secret set in the GitHub repository.
          </li>
        </ul>
      </section>
    </div>
  );
}
