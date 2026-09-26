import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySessionToken,
  type SessionPayload,
} from '@/lib/session';
import type { Role } from '@/types';

export interface CurrentUser {
  id: string;
  username: string;
  fullName: string | null;
  role: Role;
}

export async function createSession(payload: SessionPayload) {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** Returns the signed session payload, or null. Memoised per request. */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
});

/**
 * The signed-in user, loaded from the database so role changes and
 * deactivations take effect immediately. Null when signed out or inactive.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSession();
  if (!session) return null;
  const rows = await sql`
    SELECT id, username, full_name, role FROM users WHERE id = ${session.userId} AND is_active
  `;
  const u = rows[0];
  return u ? { id: u.id, username: u.username, fullName: u.full_name, role: u.role } : null;
});

/** For pages: redirects to /login when there is no valid, active user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/** For admin-only pages: sends standard users back to the dashboard. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}

// ─── Permissions (SRS §10) ──────────────────────────────────────────────────
// Administrators: full access. Standard users: add records, edit their own
// records, view and print reports.

export const isAdmin = (user: CurrentUser | null) => user?.role === 'ADMIN';

/** Can this user edit a record created by `createdBy`? */
export function canEdit(user: CurrentUser | null, createdBy: string | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || (!!createdBy && createdBy === user.id);
}

export const canDelete = isAdmin;
