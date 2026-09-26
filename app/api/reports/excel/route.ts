import type { NextRequest } from 'next/server';
import { handleReportRequest } from '@/lib/reports/handler';

export async function GET(request: NextRequest) {
  return handleReportRequest(request, 'xlsx');
}
