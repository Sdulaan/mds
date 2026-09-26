import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Mail, MapPin, Phone } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { APP_NAME, COMPANY } from '@/lib/company';
import { card } from '@/lib/ui';
import { getCurrentUser } from '@/lib/auth';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  if (await getCurrentUser()) redirect('/');
  const { next } = await searchParams;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <ThemeToggle className="absolute right-4 top-4" />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo imgClassName="h-20 w-auto" priority />
          <p className="mt-5 text-sm font-medium uppercase tracking-wider text-muted">{APP_NAME}</p>
        </div>

        <div className={`${card} p-6 sm:p-7`}>
          <h1 className="mb-1 text-xl font-semibold text-fg">Sign in</h1>
          <p className="mb-6 text-sm text-muted">Use the account given to you by your administrator.</p>
          <LoginForm next={typeof next === 'string' ? next : ''} />
        </div>
      </div>

      <address className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs not-italic text-subtle">
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand" />{COMPANY.address}</span>
        <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-brand" />{COMPANY.phone}</span>
        <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-brand" />{COMPANY.email}</span>
      </address>
    </main>
  );
}
