import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { createBackup, restoreBackup, validateBackup } from '@/lib/backup';

/** POST multipart: file (backup .json) and confirm ("RESTORE"). Administrators only. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Your session has expired.' }, { status: 401 });
  if (!isAdmin(user)) return Response.json({ error: 'Only administrators can restore backups.' }, { status: 403 });

  const form = await request.formData();
  if (form.get('confirm') !== 'RESTORE') return Response.json({ error: 'Type RESTORE to confirm.' }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Choose a backup file.' }, { status: 400 });

  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return Response.json({ error: 'That file is not a valid backup.' }, { status: 400 });
  }
  if (!validateBackup(data)) return Response.json({ error: 'That file is not a backup from this system.' }, { status: 400 });

  try {
    const before = await createBackup();
    await restoreBackup(data);
    await logAudit({
      table: 'system',
      action: 'RESTORE',
      user,
      summary: `Restored the backup taken ${data.created_at} (${data.tables.transactions.length} cheques), replacing ${before.counts.transactions} cheques`,
    });
    for (const p of ['/', '/receivables', '/payables', '/customers', '/creditors', '/purchases']) revalidatePath(p);
    return Response.json({
      ok: true,
      counts: {
        transactions: data.tables.transactions.length,
        entities: data.tables.entities.length,
        purchases: data.tables.purchases.length,
      },
    });
  } catch (error) {
    console.error('[restore]', error);
    return Response.json({ error: 'Restore failed — no changes were made.' }, { status: 500 });
  }
}
