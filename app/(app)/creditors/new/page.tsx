import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { card } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import EntityForm from '@/components/entities/EntityForm';

export const metadata: Metadata = { title: 'Add Creditor' };

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/creditors" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="h-4 w-4" /> Creditors
      </Link>
      <PageHeader title="Add Creditor" />
      <div className={`${card} p-6 sm:p-8`}>
        <EntityForm type="VENDOR" />
      </div>
    </div>
  );
}
