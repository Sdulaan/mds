import type { Metadata } from 'next';
import EntityListPage from '@/components/entities/EntityListPage';
import { pick } from '@/lib/filters';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Customers' };

export default async function Page({ searchParams }: PageProps<'/customers'>) {
  return <EntityListPage type="CUSTOMER" q={pick(await searchParams, 'q')?.trim() || undefined} />;
}
