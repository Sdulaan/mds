import type { Metadata } from 'next';
import RegisterPage from '@/components/cheques/RegisterPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Creditor Cheques' };

export default async function PayablesPage({ searchParams }: PageProps<'/payables'>) {
  return <RegisterPage type="DEBIT" searchParams={await searchParams} />;
}
