import type { Metadata } from 'next';
import EntityListPage from '@/components/entities/EntityListPage';
import { pick } from '@/lib/filters';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Creditors' };

export default async function Page({ searchParams }: PageProps<'/creditors'>) {
  return <EntityListPage type="VENDOR" q={pick(await searchParams, 'q')?.trim() || undefined} />;
}
