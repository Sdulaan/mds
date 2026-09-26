import { getCurrentUser, isAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { createBackup } from '@/lib/backup';
import { APP_TIMEZONE } from '@/lib/dates';

/** GET /api/backup — download a full JSON backup (administrators only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const backup = await createBackup();
  await logAudit({
    table: 'system',
    action: 'BACKUP',
    user,
    summary: `Downloaded a backup (${backup.counts.transactions} cheques, ${backup.counts.entities} customers/creditors, ${backup.counts.purchases} purchases)`,
  });
  const stamp = new Date().toLocaleString('sv-SE', { timeZone: APP_TIMEZONE }).replace(/[: ]/g, '-').slice(0, 16);
  return new Response(JSON.stringify(backup), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="mds-cheques-backup-${stamp}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
