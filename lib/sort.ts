// Column sorting shared by the list pages and reports. The sort lives in the URL
// (?sort=<column>&dir=asc|desc) so it survives paging, filtering and exports.

export type SortDir = 'asc' | 'desc';

export interface Sort {
  /** Column key, or undefined for the page's default order. */
  sort?: string;
  dir: SortDir;
}

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

const get = (params: RawParams, key: string) => {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
};

/** Reads ?sort / ?dir, accepting only whitelisted column keys. */
export function parseSort(params: RawParams, allowed: readonly string[]): Sort {
  const sort = get(params, 'sort');
  const dir = get(params, 'dir') === 'desc' ? 'desc' : 'asc';
  return sort && allowed.includes(sort) ? { sort, dir } : { dir: 'asc' };
}

/** Adds the sort to a query string (drops any page number, since the order changed). */
export function withSort(query: string, sort: Sort): string {
  const params = new URLSearchParams(query);
  params.delete('page');
  params.delete('sort');
  params.delete('dir');
  if (sort.sort) {
    params.set('sort', sort.sort);
    params.set('dir', sort.dir);
  }
  return params.toString();
}

/** The sort a column header switches to: first click ascending, then toggles. */
export function nextSort(current: Sort, key: string): Sort {
  return { sort: key, dir: current.sort === key && current.dir === 'asc' ? 'desc' : 'asc' };
}

/** href for a sortable column header. `query` is the current query string without the sort. */
export function sortHref(pathname: string, query: string, current: Sort, key: string): string {
  const qs = withSort(query, nextSort(current, key));
  return qs ? `${pathname}?${qs}` : pathname;
}

/** SQL ORDER BY fragment for a whitelisted column expression. */
export function sqlOrder(expr: string, dir: SortDir): string {
  return `${expr} ${dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`;
}

/**
 * Orders text like cheque / GRN numbers naturally ("9" before "10"): by the digits as a
 * number first, then as text.
 */
export function naturalOrder(column: string, dir: SortDir): string {
  return `${sqlOrder(`(NULLIF(regexp_replace(${column}, '[^0-9]', '', 'g'), '')::numeric)`, dir)}, ${sqlOrder(`LOWER(${column})`, dir)}`;
}
