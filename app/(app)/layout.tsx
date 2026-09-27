import { cookies } from 'next/headers';
import Sidebar from '@/components/Sidebar';
import { requireUser } from '@/lib/auth';
import { COMPANY } from '@/lib/company';
import { NAV_CLOSED_COOKIE, SIDEBAR_COOKIE, SIDEBAR_WIDTH } from '@/lib/theme';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser();
  // Read the saved sidebar state on the server so the first paint already has the right width / groups.
  const cookieStore = await cookies();
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed';
  const closedGroups = (cookieStore.get(NAV_CLOSED_COOKIE)?.value ?? '').split(',').filter(Boolean);

  return (
    <div
      id="app-shell"
      className="min-h-dvh transition-[padding] duration-200 lg:pl-[var(--sidebar-w)]"
      style={{ '--sidebar-w': collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded } as React.CSSProperties}
    >
      <Sidebar username={user.username} fullName={user.fullName} role={user.role} initialCollapsed={collapsed} initialClosedGroups={closedGroups} />
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-subtle sm:px-6">
            <span>© {new Date().getFullYear()} {COMPANY.legalName}</span>
            <span>
              {COMPANY.address} · {COMPANY.phone}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
