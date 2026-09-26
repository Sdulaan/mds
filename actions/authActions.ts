'use server';

import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createSession, deleteSession } from '@/lib/auth';
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

  let user: { id: string; username: string; password_hash: string } | undefined;
  try {
    const rows = await sql`
      SELECT id, username, password_hash FROM users WHERE username = ${username}
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

  await createSession({ userId: user.id, username: user.username });
  redirect(safeNext(formData.get('next')));
}

export async function logout() {
  await deleteSession();
  redirect('/login');
}
