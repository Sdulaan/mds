import type { Metadata } from 'next';
import { CreditCard } from 'lucide-react';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">MDS Pharmacy</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to Cheque Management</p>
        </div>

        <div className="glass-card p-6">
          <LoginForm next={typeof next === 'string' ? next : ''} />
        </div>
      </div>
    </main>
  );
}
