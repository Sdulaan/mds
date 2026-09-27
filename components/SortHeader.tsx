import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn, th } from '@/lib/ui';
import type { Sort } from '@/lib/sort';

interface SortHeaderProps {
  label: React.ReactNode;
  column: string;
  current: Sort;
  /** Link target (server-rendered pages). */
  href?: string;
  /** Click handler (client-side sorting). */
  onSort?: () => void;
  align?: 'left' | 'right';
  className?: string;
}

/** Hidden inputs that keep the current sort when a GET filter form is submitted. */
export function SortInputs({ sort }: { sort: Sort }) {
  if (!sort.sort) return null;
  return (
    <>
      <input type="hidden" name="sort" value={sort.sort} />
      <input type="hidden" name="dir" value={sort.dir} />
    </>
  );
}

// Clickable table header: click to sort ascending, click again for descending.
export default function SortHeader({ label, column, current, href, onSort, align = 'left', className }: SortHeaderProps) {
  const active = current.sort === column;
  const Icon = !active ? ChevronsUpDown : current.dir === 'asc' ? ArrowUp : ArrowDown;
  const title = `Sort ${active && current.dir === 'asc' ? 'descending' : 'ascending'}`;
  const inner = (
    <>
      {label}
      <Icon className={cn('h-3.5 w-3.5 shrink-0 transition-opacity', active ? 'text-brand' : 'opacity-40 group-hover:opacity-100')} />
    </>
  );
  const control = cn(
    'group inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-fg',
    align === 'right' && 'flex-row-reverse',
    active && 'text-fg'
  );

  return (
    <th
      className={cn(th, align === 'right' && 'text-right', className)}
      aria-sort={active ? (current.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {href ? (
        <Link href={href} scroll={false} title={title} className={control}>{inner}</Link>
      ) : (
        <button type="button" onClick={onSort} title={title} className={cn(control, 'font-semibold')}>{inner}</button>
      )}
    </th>
  );
}
