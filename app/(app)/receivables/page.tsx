import type { Metadata } from 'next';
import RegisterPage from '@/components/cheques/RegisterPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Customer Cheques' };

export default async function ReceivablesPage({ searchParams }: PageProps<'/receivables'>) {
  return <RegisterPage type="CREDIT" searchParams={await searchParams} />;
}
