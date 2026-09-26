'use client';

import { login } from '@/actions/authActions';
import { useFormAction } from '@/components/useFormAction';
import { alertError, btnPrimary, cn, input, label } from '@/lib/ui';

export default function LoginForm({ next }: { next: string }) {
  const { state, pending, formRef, onSubmit } = useFormAction(login);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      {state.message && (
        <div role="alert" className={alertError}>
          {state.message}
        </div>
      )}

      <div>
        <label htmlFor="username" className={label}>Username</label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          autoFocus
          className={input}
        />
      </div>

      <div>
        <label htmlFor="password" className={label}>Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </div>

      <button type="submit" disabled={pending} className={cn(btnPrimary, 'w-full py-3')}>
        {pending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
