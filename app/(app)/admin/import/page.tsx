import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import ImportWizard from '@/components/admin/ImportWizard';

export const metadata: Metadata = { title: 'Import Excel' };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Import Excel" description="Bring existing cheques in from the monthly Credit / Debit cheque workbooks." />
      <ImportWizard />
    </div>
  );
}
