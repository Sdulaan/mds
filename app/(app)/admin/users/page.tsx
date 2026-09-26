import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getUsers } from '@/lib/data/admin';
import PageHeader from '@/components/PageHeader';
import UserManager from '@/components/admin/UserManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await getUsers();
  return (
    <div>
      <PageHeader title="Users" description="Create accounts, set roles, reset passwords and deactivate users." />
      <UserManager users={users} currentUserId={admin.id} />
    </div>
  );
}
