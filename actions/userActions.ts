'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { isUuid } from '@/lib/filters';
import { FORBIDDEN, UNAUTHORIZED, optionalText, text } from '@/lib/forms';
import { hashPassword } from '@/lib/password';
import type { ActionResult, Role } from '@/types';

const MIN_PASSWORD = 10;

async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user) return { error: UNAUTHORIZED };
  if (!isAdmin(user)) return { error: FORBIDDEN };
  return { user };
}

async function activeAdminCount(excludeId: string): Promise<number> {
  const [row] = await sql`SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN' AND is_active AND id <> ${excludeId}`;
  return row.n;
}

export async function createUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { user, error } = await requireAdminUser();
  if (error) return error;

  const username = text(formData, 'username', 64).toLowerCase();
  const fullName = optionalText(formData, 'full_name', 120);
  const role = text(formData, 'role', 10) as Role;
  const password = String(formData.get('password') ?? '');

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    return { success: false, message: 'Username must be 3–64 characters: letters, digits, dot, dash or underscore.' };
  }
  if (!['ADMIN', 'STANDARD'].includes(role)) return { success: false, message: 'Choose a role.' };
  if (password.length < MIN_PASSWORD) return { success: false, message: `Password must be at least ${MIN_PASSWORD} characters.` };

  const exists = await sql`SELECT 1 FROM users WHERE username = ${username}`;
  if (exists.length) return { success: false, message: `Username "${username}" is already taken.` };

  const [row] = await sql`
    INSERT INTO users (username, full_name, role, password_hash)
    VALUES (${username}, ${fullName}, ${role}, ${await hashPassword(password)})
    RETURNING id
  `;
  await logAudit({ table: 'users', recordId: row.id, action: 'CREATE', user, summary: `Created ${role.toLowerCase()} user ${username}` });
  revalidatePath('/admin/users');
  return { success: true, message: `User ${username} created.` };
}

export async function updateUser(id: string, changes: { role?: Role; isActive?: boolean; fullName?: string | null }): Promise<ActionResult> {
  const { user, error } = await requireAdminUser();
  if (error) return error;
  if (!isUuid(id)) return { success: false, message: 'User not found.' };

  const [target] = await sql`SELECT username, role, is_active, full_name FROM users WHERE id = ${id}`;
  if (!target) return { success: false, message: 'User not found.' };

  const role = changes.role ?? target.role;
  const isActive = changes.isActive ?? target.is_active;
  if (!['ADMIN', 'STANDARD'].includes(role)) return { success: false, message: 'Invalid role.' };

  // Never leave the system without an active administrator.
  if (target.role === 'ADMIN' && (role !== 'ADMIN' || !isActive) && (await activeAdminCount(id)) === 0) {
    return { success: false, message: 'There must be at least one active administrator.' };
  }
  if (id === user.id && !isActive) return { success: false, message: 'You cannot deactivate your own account.' };

  const fullName = changes.fullName === undefined ? target.full_name : changes.fullName?.trim().slice(0, 120) || null;
  await sql`UPDATE users SET role = ${role}, is_active = ${isActive}, full_name = ${fullName} WHERE id = ${id}`;

  const parts = [];
  if (role !== target.role) parts.push(`role → ${role.toLowerCase()}`);
  if (isActive !== target.is_active) parts.push(isActive ? 'activated' : 'deactivated');
  if (fullName !== target.full_name) parts.push('name updated');
  if (parts.length) {
    await logAudit({ table: 'users', recordId: id, action: 'UPDATE', user, summary: `User ${target.username}: ${parts.join(', ')}` });
  }
  revalidatePath('/admin/users');
  return { success: true, message: `${target.username} updated.` };
}

export async function resetPassword(id: string, password: string): Promise<ActionResult> {
  const { user, error } = await requireAdminUser();
  if (error) return error;
  if (!isUuid(id)) return { success: false, message: 'User not found.' };
  if (password.length < MIN_PASSWORD) return { success: false, message: `Password must be at least ${MIN_PASSWORD} characters.` };

  const [target] = await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${id} RETURNING username`;
  if (!target) return { success: false, message: 'User not found.' };
  await logAudit({ table: 'users', recordId: id, action: 'PASSWORD', user, summary: `Reset password for ${target.username}` });
  return { success: true, message: `Password reset for ${target.username}.` };
}
