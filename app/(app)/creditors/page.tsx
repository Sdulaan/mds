import type { Metadata } from 'next';
import EntityListPage from '@/components/entities/EntityListPage';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Creditors' };

export default async function Page({ searchParams }: PageProps<'/creditors'>) {
  return <EntityListPage type="VENDOR" searchParams={await searchParams} />;
}
