'use client';

import { useMemo, useState, useTransition } from 'react';
import { KeyRound, Loader2, UserPlus } from 'lucide-react';
import { createUser, resetPassword, updateUser } from '@/actions/userActions';
import SortHeader from '@/components/SortHeader';
import { useFormAction } from '@/components/useFormAction';
import { formatDate } from '@/lib/dates';
import { nextSort, type Sort } from '@/lib/sort';
import { alertError, alertSuccess, btnPrimary, btnSmall, card, cn, input, label, td, th } from '@/lib/ui';
import type { AppUser, Role } from '@/types';

export default function UserManager({ users, currentUserId }: { users: AppUser[]; currentUserId: string }) {
  const { state, pending, formRef, onSubmit } = useFormAction(createUser);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [sort, setSort] = useState<Sort>({ dir: 'asc' });
  const sorted = useMemo(() => {
    const value: Record<string, (u: AppUser) => string | number> = {
      user: (u) => (u.full_name || u.username).toLowerCase(),
      role: (u) => u.role,
      status: (u) => (u.is_active ? 0 : 1),
      created: (u) => u.created_at,
    };
    const get = sort.sort ? value[sort.sort] : undefined;
    if (!get) return users;
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...users].sort((a, b) => {
      const x = get(a), y = get(b);
      return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)));
    });
  }, [users, sort]);
  const header = (label: string, column: string) => (
    <SortHeader label={label} column={column} current={sort} onSort={() => setSort(nextSort(sort, column))} />
  );

  const run = (fn: () => Promise<{ success: boolean; message: string }>) =>
    startTransition(async () => {
      const r = await fn();
      setMessage({ ok: r.success, text: r.message });
    });

  const reset = (u: AppUser) => {
    const pw = window.prompt(`New password for ${u.username} (at least 10 characters):`);
    if (pw) run(() => resetPassword(u.id, pw));
  };

  return (
    <div className="space-y-6">
      <section className={`${card} p-5`}>
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-fg"><UserPlus className="h-4 w-4 text-brand" /> Add user</h2>
        {state.message && <div role="alert" className={cn(state.success ? alertSuccess : alertError, 'mb-4')}>{state.message}</div>}
        <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div>
            <label htmlFor="u-username" className={label}>Username *</label>
            <input id="u-username" name="username" required autoComplete="off" autoCapitalize="none" className={input} />
          </div>
          <div>
            <label htmlFor="u-name" className={label}>Full name</label>
            <input id="u-name" name="full_name" className={input} />
          </div>
          <div>
            <label htmlFor="u-role" className={label}>Role *</label>
            <select id="u-role" name="role" defaultValue="STANDARD" className={input}>
              <option value="STANDARD">Standard user</option>
              <option value="ADMIN">System administrator</option>
            </select>
          </div>
          <div>
            <label htmlFor="u-password" className={label}>Password *</label>
            <input id="u-password" name="password" type="password" required minLength={10} autoComplete="new-password" className={input} />
          </div>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add user
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">
          <strong className="text-fg">Administrators:</strong> full access, delete records, approve duplicate entries, manage users, import and backup.{' '}
          <strong className="text-fg">Standard users:</strong> add records, edit their own records, view and print reports.
        </p>
      </section>

      {message && <div role="status" className={message.ok ? alertSuccess : alertError}>{message.text}</div>}

      <div className={`${card} overflow-hidden ${isPending ? 'opacity-60' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-2">
                {header('User', 'user')}
                {header('Role', 'role')}
                {header('Status', 'status')}
                {header('Created', 'created')}
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'opacity-60'}>
                  <td className={td}>
                    <p className="font-medium text-fg">{u.full_name || u.username}{u.id === currentUserId && <span className="ml-2 text-xs text-subtle">(you)</span>}</p>
                    <p className="text-xs text-subtle">{u.username}</p>
                  </td>
                  <td className={td}>
                    <select
                      value={u.role}
                      onChange={(e) => run(() => updateUser(u.id, { role: e.target.value as Role }))}
                      className={cn(input, 'w-auto py-1.5 text-xs')}
                      aria-label={`Role for ${u.username}`}
                    >
                      <option value="STANDARD">Standard user</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  </td>
                  <td className={td}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.is_active ? 'bg-cleared-soft text-cleared' : 'bg-surface-2 text-muted'}`}>
                      {u.is_active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(u.created_at)}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <div className="inline-flex gap-2">
                      <button type="button" onClick={() => reset(u)} className={btnSmall}><KeyRound className="h-3.5 w-3.5" /> Reset password</button>
                      {u.id !== currentUserId && (
                        <button type="button" onClick={() => run(() => updateUser(u.id, { isActive: !u.is_active }))} className={btnSmall}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
