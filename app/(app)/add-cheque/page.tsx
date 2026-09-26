import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getEntities } from '@/lib/queries';
import AddChequeForm from './AddChequeForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Add Cheque',
  description: 'Record a new credit or debit cheque transaction.',
};

async function FormWithEntities() {
  const entities = await getEntities();
  return <AddChequeForm entities={entities} />;
}

export default function AddChequePage() {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/ledger"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Ledger
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-300">Add Cheque</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Add New Cheque</h1>
        <p className="mt-1 text-slate-400">
          Record a new credit or debit cheque transaction into the system.
        </p>
      </div>

      {/* Form Card */}
      <div className="glass-card p-6 sm:p-8">
        <Suspense
          fallback={
            <div className="animate-pulse space-y-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-slate-800/60" />
              ))}
            </div>
          }
        >
          <FormWithEntities />
        </Suspense>
      </div>

      {/* Tip */}
      <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
        <p className="flex items-start gap-2 text-xs text-slate-500">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          All new cheques are set to <strong className="text-slate-300">PENDING</strong> status by default.
          Update the status from the Ledger page once the cheque clears.
          Need to add a new vendor or customer? Visit the{' '}
          <Link href="/entities" className="text-violet-400 underline hover:text-violet-300">
            Entities page
          </Link>.
        </p>
      </div>
    </div>
  );
}
