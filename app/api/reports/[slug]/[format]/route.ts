import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { APP_TIMEZONE } from '@/lib/dates';
import { getReport } from '@/lib/reports/definitions';
import { parseReportParams } from '@/lib/reports/params';
import { renderExcel } from '@/lib/reports/render-excel';
import { renderPdf } from '@/lib/reports/render-pdf';

const CONTENT_TYPES = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/** GET /api/reports/{slug}/{pdf|excel}?…parameters — add inline=1 to open in the browser (print preview). */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/reports/[slug]/[format]'>) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug, format } = await ctx.params;
  const def = getReport(slug);
  if (!def || (format !== 'pdf' && format !== 'excel')) return Response.json({ error: 'Not found' }, { status: 404 });

  const raw = request.nextUrl.searchParams;
  const report = await def.build(parseReportParams(def, raw), raw);
  const name = user.fullName || user.username;
  const body = format === 'pdf' ? renderPdf(report, name) : await renderExcel(report, name);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
  const slugPart = `${report.title} ${report.subtitle}`.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 90);
  const filename = `MDS_${slugPart}_${today}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
  const inline = format === 'pdf' && raw.get('inline') === '1';

  await logAudit({ table: 'system', action: 'REPORT', user, summary: `${inline ? 'Printed/previewed' : 'Exported'} ${report.title} (${format.toUpperCase()}) — ${report.subtitle}` });

  return new Response(body as BodyInit, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
