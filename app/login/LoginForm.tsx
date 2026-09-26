'use client';

import { login } from '@/actions/authActions';
import { useFormAction } from '@/components/useFormAction';

export default function LoginForm({ next }: { next: string }) {
  const { state, pending, formRef, onSubmit } = useFormAction(login);

  const inputClass =
    'w-full rounded-xl border border-white/10 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors';
  const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5';

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      {state.message && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400"
        >
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="username" className={labelClass}>Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
