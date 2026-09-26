import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageCount: number;
  /** Builds the href for a page number, keeping the current filters. */
  baseQuery: string;
  pathname: string;
}

export default function Pagination({ page, pageCount, baseQuery, pathname }: PaginationProps) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams(baseQuery);
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const link = 'inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-surface px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg';
  const disabled = 'pointer-events-none opacity-40';

  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pagination">
      <Link href={href(page - 1)} className={`${link} ${page <= 1 ? disabled : ''}`} aria-disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </Link>
      <span className="text-sm text-muted">
        Page <span className="font-medium text-fg">{page}</span> of {pageCount}
      </span>
      <Link href={href(page + 1)} className={`${link} ${page >= pageCount ? disabled : ''}`} aria-disabled={page >= pageCount}>
        Next <ChevronRight className="h-4 w-4" />
      </Link>
    </nav>
  );
}
