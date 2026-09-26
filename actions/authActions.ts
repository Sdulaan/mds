'use server';

import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createSession, deleteSession, getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { DUMMY_HASH, verifyPassword } from '@/lib/password';
import type { ActionResult } from '@/types';

/** Only allow same-site relative redirects after login. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login') ? value : '/';
}

export async function login(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!username || !password) {
    return { success: false, message: 'Enter your username and password.' };
  }

  let user: { id: string; username: string; password_hash: string; is_active: boolean } | undefined;
  try {
    const rows = await sql`
      SELECT id, username, password_hash, is_active FROM users WHERE username = ${username}
    `;
    user = rows[0];
  } catch (error) {
    console.error('[login]', error);
    return { success: false, message: 'Sign-in is unavailable right now. Please try again.' };
  }

  // Always run a hash comparison so timing doesn't reveal whether the username exists.
  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    return { success: false, message: 'Invalid username or password.' };
  }
  if (!user.is_active) {
    return { success: false, message: 'This account has been deactivated. Contact your administrator.' };
  }

  await createSession({ userId: user.id, username: user.username });
  await logAudit({ table: 'users', recordId: user.id, action: 'LOGIN', summary: `${user.username} signed in`, user });
  redirect(safeNext(formData.get('next')));
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await logAudit({ table: 'users', recordId: user.id, action: 'LOGOUT', summary: `${user.username} signed out`, user });
  await deleteSession();
  redirect('/login');
}
