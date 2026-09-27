import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { ACTIVITY_SORT_KEYS, getActivity, getUsers } from '@/lib/data/admin';
import { formatDateTime } from '@/lib/dates';
import { isDateKey, isUuid, pick } from '@/lib/filters';
import { parseSort, sortHref, type Sort } from '@/lib/sort';
import { btnSecondary, card, cn, input, td, th } from '@/lib/ui';
import PageHeader from '@/components/PageHeader';
import SortHeader, { SortInputs } from '@/components/SortHeader';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Activity Log' };

const ACTIONS = ['CREATE', 'UPDATE', 'STATUS', 'DELETE', 'MERGE', 'IMPORT', 'REPORT', 'LOGIN', 'LOGOUT', 'PASSWORD', 'BACKUP', 'RESTORE'];

const RECORD_LINK: Record<string, string> = { transactions: '/cheques', purchases: '/purchases' };

const ACTION_TONE: Record<string, string> = {
  CREATE: 'bg-cleared-soft text-cleared',
  DELETE: 'bg-bounced-soft text-bounced',
  RESTORE: 'bg-bounced-soft text-bounced',
  STATUS: 'bg-credit-soft text-credit',
  UPDATE: 'bg-pending-soft text-pending',
  MERGE: 'bg-pending-soft text-pending',
};

// SRS §8 / §12: every change and each user's activity is traceable.
export default async function ActivityPage({ searchParams }: PageProps<'/admin/activity'>) {
  await requireAdmin();
  const sp = await searchParams;
  const user = pick(sp, 'user');
  const action = pick(sp, 'action');
  const from = pick(sp, 'from');
  const to = pick(sp, 'to');
  const filters = {
    userId: isUuid(user) ? user : undefined,
    action: action && ACTIONS.includes(action) ? action : undefined,
    from: isDateKey(from) ? from : undefined,
    to: isDateKey(to) ? to : undefined,
  };
  const parsed = parseSort(sp, ACTIVITY_SORT_KEYS);
  // Default order (no ?sort): newest first.
  const sort: Sort = parsed.sort ? parsed : { sort: 'when', dir: 'desc' };
  const filterQuery = new URLSearchParams(
    Object.entries({ user: filters.userId, action: filters.action, from: filters.from, to: filters.to }).filter((e): e is [string, string] => !!e[1])
  ).toString();
  const href = (column: string) => sortHref('/admin/activity', filterQuery, sort, column);
  const [entries, users] = await Promise.all([getActivity({ ...filters, sort: parsed }), getUsers()]);

  return (
    <div>
      <PageHeader title="Activity Log" description="Who did what, and when — every change, status update, import, export and sign-in." />

      <form className={`${card} mb-5 flex flex-wrap items-end gap-3 p-4`}>
        <SortInputs sort={parsed} />
        <select name="user" defaultValue={filters.userId ?? ''} className={cn(input, 'w-auto')} aria-label="User">
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
        </select>
        <select name="action" defaultValue={filters.action ?? ''} className={cn(input, 'w-auto')} aria-label="Action">
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.charAt(0) + a.slice(1).toLowerCase()}</option>)}
        </select>
        <input type="date" name="from" defaultValue={filters.from ?? ''} className={cn(input, 'w-auto')} aria-label="From" />
        <input type="date" name="to" defaultValue={filters.to ?? ''} className={cn(input, 'w-auto')} aria-label="To" />
        <button type="submit" className={btnSecondary}>Filter</button>
      </form>

      {entries.length === 0 ? (
        <p className={`${card} py-16 text-center text-sm text-subtle`}>No activity recorded for these filters.</p>
      ) : (
        <div className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <SortHeader label="When" column="when" current={sort} href={href('when')} />
                  <SortHeader label="User" column="user" current={sort} href={href('user')} />
                  <SortHeader label="Action" column="action" current={sort} href={href('action')} />
                  <th className={th}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((e) => {
                  const base = RECORD_LINK[e.entity_table];
                  return (
                    <tr key={e.id} className="align-top">
                      <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(e.created_at)}</td>
                      <td className={`${td} whitespace-nowrap font-medium text-fg`}>{e.username ?? 'system'}</td>
                      <td className={td}>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${ACTION_TONE[e.action] ?? 'bg-surface-2 text-muted'}`}>{e.action}</span>
                      </td>
                      <td className={`${td} text-fg`}>
                        {base && e.record_id && e.action !== 'DELETE' ? (
                          <Link href={`${base}/${e.record_id}`} className="hover:text-brand hover:underline">{e.summary}</Link>
                        ) : (
                          e.summary
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {entries.length >= 300 && <p className="border-t border-line px-4 py-3 text-xs text-muted">Showing the first 300 entries — narrow the filters to see older activity.</p>}
        </div>
      )}
    </div>
  );
}
