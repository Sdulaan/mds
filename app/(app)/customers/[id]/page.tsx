import type { Metadata } from 'next';
import EntityDetailPage from '@/components/entities/EntityDetailPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customer' };

export default async function Page({ params }: PageProps<'/customers/[id]'>) {
  return <EntityDetailPage type="CUSTOMER" id={(await params).id} />;
}
