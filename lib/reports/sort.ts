import type { SortDir } from '@/lib/sort';
import type { Cell, ReportData, Row, Section } from './types';

const isEmpty = (v: Cell | undefined) => v === null || v === undefined || v === '';

function compare(a: Cell | undefined, b: Cell | undefined, sign: number): number {
  // Blanks always go last, whichever the direction.
  if (isEmpty(a)) return isEmpty(b) ? 0 : 1;
  if (isEmpty(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return sign * (a - b);
  // Natural order: "9" before "10"; ISO dates and YYYY-MM months sort correctly as text.
  return sign * String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

const valueOf = (row: Row, key: string) => row.sortKeys?.[key] ?? row.cells[key];

interface Block {
  rows: Row[];
  /** The subtotal row that closes the block, if any. */
  tail?: Row;
}

/** Splits rows into blocks ending at each subtotal (or where `row.group` changes); totals are kept aside. */
function toBlocks(rows: Row[]): { blocks: Block[]; totals: Row[] } {
  const blocks: Block[] = [];
  const totals: Row[] = [];
  let current: Row[] = [];
  const flush = (tail?: Row) => {
    if (current.length || tail) blocks.push({ rows: current, tail });
    current = [];
  };
  for (const row of rows) {
    if (row.kind === 'total') {
      flush();
      totals.push(row);
    } else if (row.kind === 'subtotal') {
      flush(row);
    } else {
      if (current.length && row.group !== current[current.length - 1].group) flush();
      current.push(row);
    }
  }
  flush();
  return { blocks, totals };
}

function sortSection(section: Section, key: string, sign: number): Section {
  if (section.noSort || !section.columns.some((c) => c.key === key)) return section;
  const { blocks, totals } = toBlocks(section.rows);
  for (const block of blocks) block.rows.sort((a, b) => compare(valueOf(a, key), valueOf(b, key), sign));
  // Blocks move as a whole only when they are grouped by the sorted column (e.g. months when sorting by date).
  if (section.blockKey === key) {
    blocks.sort((a, b) => compare(a.rows[0] && valueOf(a.rows[0], key), b.rows[0] && valueOf(b.rows[0], key), sign));
  }
  return { ...section, rows: [...blocks.flatMap((b) => (b.tail ? [...b.rows, b.tail] : b.rows)), ...totals] };
}

/**
 * Sorts a built report by one column, keeping its structure: rows are sorted inside each
 * subtotal group, subtotals and totals stay in place, and month sections follow a date sort.
 */
export function sortReport(report: ReportData, key: string | undefined, dir: SortDir = 'asc'): ReportData {
  if (!key) return report;
  const sign = dir === 'desc' ? -1 : 1;
  const sections = report.sections.map((s) => sortSection(s, key, sign));

  // Reorder runs of consecutive month sections when sorting by a date column.
  const isDate = (s: Section) => s.columns.some((c) => c.key === key && (c.type === 'date' || c.key === 'month'));
  for (let i = 0; i < sections.length; ) {
    let j = i;
    while (j < sections.length && sections[j].month && isDate(sections[j])) j++;
    if (j - i > 1) {
      const run = sections.slice(i, j).sort((a, b) => compare(a.month, b.month, sign));
      sections.splice(i, run.length, ...run);
    }
    i = Math.max(j, i + 1);
  }
  return { ...report, sections };
}
