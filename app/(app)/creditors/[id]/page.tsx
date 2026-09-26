import type { Metadata } from 'next';
import EntityDetailPage from '@/components/entities/EntityDetailPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Creditor' };

export default async function Page({ params }: PageProps<'/creditors/[id]'>) {
  return <EntityDetailPage type="VENDOR" id={(await params).id} />;
}
