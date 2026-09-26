import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { formatAmount } from '@/lib/format';
import { commitImport, planImport } from '@/lib/import/commit';
import { parseWorkbook } from '@/lib/import/parse';
import type { TransactionType } from '@/types';

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST multipart/form-data: file (.xlsx), type ("auto" | "CREDIT" | "DEBIT"), mode ("preview" | "import").
 * Preview parses and plans without writing; import writes everything in one transaction.
 * (A route handler rather than a server action because the workbooks exceed the 1 MB action limit.)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
  if (!isAdmin(user)) return Response.json({ error: 'Only administrators can import data.' }, { status: 403 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx')) {
    return Response.json({ error: 'Choose an Excel (.xlsx) file.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: 'The file is larger than 8 MB.' }, { status: 400 });

  const typeParam = String(form.get('type') ?? 'auto');
  const forceType = typeParam === 'CREDIT' || typeParam === 'DEBIT' ? (typeParam as TransactionType) : undefined;

  try {
    const parsed = await parseWorkbook(await file.arrayBuffer(), forceType);
    const plan = await planImport(parsed.cheques);
    const summary = {
      fileName: file.name,
      sheets: parsed.sheets,
      issues: parsed.issues.slice(0, 200),
      issueCount: parsed.issues.length,
      parsed: parsed.cheques.length,
      toImport: plan.toInsert.length,
      skippedExisting: plan.skippedExisting,
      skippedInFile: plan.skippedInFile,
      byStatus: plan.byStatus,
      byType: plan.byType,
      newEntities: plan.newEntities.map((e) => ({ name: e.name, type: e.type })),
    };

    if (form.get('mode') !== 'import') return Response.json({ ok: true, imported: false, summary });

    await commitImport(plan, user.id);
    await logAudit({
      table: 'system', action: 'IMPORT', user,
      summary: `Imported ${plan.toInsert.length} cheques (${formatAmount(plan.byType.CREDIT.amount + plan.byType.DEBIT.amount)}) and ${plan.newEntities.length} new customers/creditors from ${file.name}`,
    });
    for (const p of ['/', '/receivables', '/payables', '/customers', '/creditors']) revalidatePath(p);
    return Response.json({ ok: true, imported: true, summary });
  } catch (error) {
    console.error('[import]', error);
    return Response.json({ error: 'The file could not be read or imported. Check that it is a valid .xlsx workbook.' }, { status: 500 });
  }
}
