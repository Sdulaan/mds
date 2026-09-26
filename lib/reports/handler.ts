import 'server-only';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTransactions } from '@/lib/queries';
import { buildFilterLabel, parseFilters } from '@/lib/filters';
import { APP_TIMEZONE } from '@/lib/dates';
import { reportFilename } from './summary';
import { buildExcelReport } from './excel';
import { buildPdfReport } from './pdf';

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** Shared GET handler for /api/reports/pdf and /api/reports/excel. Accepts ?type=&status=&month= */
export async function handleReportRequest(request: NextRequest, format: 'pdf' | 'xlsx'): Promise<Response> {
  if (!(await getSession())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const filters = parseFilters(request.nextUrl.searchParams);
  const transactions = await getTransactions({ ...filters, month: filters.month || undefined });
  const label = buildFilterLabel(filters);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE }); // YYYY-MM-DD

  const body =
    format === 'pdf' ? buildPdfReport(transactions, label) : await buildExcelReport(transactions, label);

  return new Response(body as BodyInit, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `attachment; filename="${reportFilename(label, format, today)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
