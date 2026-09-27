'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Building2, ChevronDown, DatabaseBackup, FileSpreadsheet, FileText,
  LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, ShieldCheck, ShoppingCart, UserCog, Users, X,
} from 'lucide-react';
import { logout } from '@/actions/authActions';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { APP_NAME } from '@/lib/company';
import { NAV_CLOSED_COOKIE, SIDEBAR_COOKIE, SIDEBAR_WIDTH } from '@/lib/theme';
import type { Role } from '@/types';

type Icon = React.ComponentType<{ className?: string }>;
type Item = { href: string; label: string; icon: Icon };
type Group = { id: string; label: string; icon: Icon; items: Item[]; adminOnly?: boolean };

// Navigation in blocks separated by divider lines (Neon-style): top-level pages first,
// then collapsible groups whose pages are indented under a heading row.
const TOP_LINKS: Item[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports', label: 'Reports', icon: FileText },
];

const GROUPS: Group[] = [
  {
    id: 'receivables',
    label: 'Receivables',
    icon: ArrowDownLeft,
    items: [
      { href: '/receivables', label: 'Customer Cheques', icon: ArrowDownLeft },
      { href: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    id: 'payables',
    label: 'Payables',
    icon: ArrowUpRight,
    items: [
      { href: '/payables', label: 'Creditor Cheques', icon: ArrowUpRight },
      { href: '/purchases', label: 'Purchases (GRN)', icon: ShoppingCart },
      { href: '/creditors', label: 'Creditors', icon: Building2 },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: ShieldCheck,
    adminOnly: true,
    items: [
      { href: '/admin/users', label: 'Users', icon: UserCog },
      { href: '/admin/activity', label: 'Activity Log', icon: Activity },
      { href: '/admin/import', label: 'Import Excel', icon: FileSpreadsheet },
      { href: '/admin/backup', label: 'Backup & Restore', icon: DatabaseBackup },
    ],
  },
];

const Divider = () => <div className="mx-2 my-2.5 border-t border-line" role="separator" />;

const rowBase = 'group relative flex w-full items-center rounded-lg text-[15px] transition-colors';

interface SidebarProps {
  username: string;
  fullName: string | null;
  role: Role;
  initialCollapsed: boolean;
  initialClosedGroups: string[];
}

export default function Sidebar({ username, fullName, role, initialCollapsed, initialClosedGroups }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(initialCollapsed); // desktop icon rail
  const [closed, setClosed] = useState<string[]>(initialClosedGroups); // closed groups
  // Label beside an icon in the collapsed rail, on hover or keyboard focus. Rendered by the <aside>
  // itself (not inside the scrollable nav) so the nav can scroll without clipping it.
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);
  const tipProps = (label: string) => ({
    'aria-label': label,
    onMouseEnter: (e: React.SyntheticEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ label, y: r.top + r.height / 2 });
    },
    onFocus: (e: React.SyntheticEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      setTip({ label, y: r.top + r.height / 2 });
    },
    onMouseLeave: () => setTip(null),
    onBlur: () => setTip(null),
  });

  const remember = (name: string, value: string) =>
    (document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    setTip(null);
    remember(SIDEBAR_COOKIE, next ? 'collapsed' : 'expanded');
    document.getElementById('app-shell')?.style.setProperty('--sidebar-w', next ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded);
  };

  const toggleGroup = (id: string) => {
    const next = closed.includes(id) ? closed.filter((g) => g !== id) : [...closed, id];
    setClosed(next);
    remember(NAV_CLOSED_COOKIE, next.join(','));
  };

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));
  const groups = GROUPS.filter((g) => !g.adminOnly || role === 'ADMIN');
  const displayName = fullName || username;
  const roleLabel = role === 'ADMIN' ? 'Administrator' : 'Standard user';

  const link = ({ href, label, icon: Icon }: Item, rail: boolean) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        {...(rail ? tipProps(label) : {})}
        onClick={() => setOpen(false)}
        className={`${rowBase} ${rail ? 'justify-center py-2.5' : 'gap-3 px-3 py-[7px]'} ${
          active ? 'bg-surface-2 font-semibold text-fg' : 'text-muted hover:bg-surface-2/70 hover:text-fg'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand' : ''}`} />
        {!rail && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  /** `rail` = collapsed desktop sidebar: icons only, labels in tooltips, groups shown as divided icon blocks. */
  const nav = (rail: boolean) => (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" onScroll={() => setTip(null)} aria-label="Main">
      <div className="space-y-0.5">{TOP_LINKS.map((i) => link(i, rail))}</div>
      {groups.map((g, index) => {
        const isOpen = !closed.includes(g.id);
        const hasActive = g.items.some((i) => isActive(i.href));
        const GroupIcon = g.icon;
        return (
          <div key={g.id}>
            {/* One line above the first group and above Administration; groups in between sit together. */}
            {(index === 0 || g.adminOnly || rail) && <Divider />}
            {rail ? (
              <div className="space-y-0.5">{g.items.map((i) => link(i, true))}</div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  aria-expanded={isOpen}
                  className={`${rowBase} mt-0.5 gap-3 px-3 py-[7px] font-medium ${hasActive && !isOpen ? 'text-fg' : 'text-muted'} hover:bg-surface-2/70 hover:text-fg`}
                >
                  <GroupIcon className={`h-[18px] w-[18px] shrink-0 ${hasActive ? 'text-brand' : ''}`} />
                  <span className="flex-1 text-left">{g.label}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                </button>
                {isOpen && <div className="ml-6 mt-0.5 space-y-0.5">{g.items.map((i) => link(i, false))}</div>}
              </>
            )}
          </div>
        );
      })}
    </nav>
  );

  const addCheque = (rail: boolean) => (
    <Link
      href="/cheques/new"
      onClick={() => setOpen(false)}
      {...(rail ? tipProps('Add cheque') : {})}
      className={`group relative flex items-center justify-center gap-2 rounded-lg border border-brand/50 bg-brand-soft text-sm font-semibold text-brand transition-colors hover:border-brand hover:bg-brand/15 ${
        rail ? 'mx-auto mb-3 h-10 w-10' : 'mx-3 mb-3 py-2.5'
      }`}
    >
      <Plus className="h-4 w-4" />
      {!rail && 'Add Cheque'}
    </Link>
  );

  const signOut = (withTooltip: boolean) => (
    <form action={logout}>
      <button
        type="submit"
        {...(withTooltip ? tipProps('Sign out') : { 'aria-label': 'Sign out' })}
        className="group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  );

  const avatar = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold uppercase text-brand">
      {displayName.slice(0, 1)}
    </div>
  );

  const account = (rail: boolean) =>
    rail ? (
      <div className="flex flex-col items-center gap-2 border-t border-line py-3">
        <div tabIndex={0} {...tipProps(`${displayName} · ${roleLabel}`)}>
          {avatar}
        </div>
        <ThemeToggle />
        {signOut(true)}
      </div>
    ) : (
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{displayName}</p>
            <p className="text-xs text-subtle">{roleLabel}</p>
          </div>
          <ThemeToggle />
          {signOut(false)}
        </div>
      </div>
    );

  const collapseButton = (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-expanded={!collapsed}
      {...(collapsed ? tipProps('Expand menu') : { 'aria-label': 'Collapse menu', title: 'Collapse menu' })}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
    </button>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur-md lg:hidden">
        <Link href="/" aria-label="Dashboard">
          <BrandLogo imgClassName="h-9 w-auto" priority />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer (always full, with labels) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between pr-3">
              <Link href="/" className="px-5 py-4" aria-label="Dashboard" onClick={() => setOpen(false)}>
                <BrandLogo imgClassName="h-12 w-auto" priority />
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="p-2 text-muted" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {addCheque(false)}
            {nav(false)}
            {account(false)}
          </aside>
        </div>
      )}

      {/* Desktop sidebar: full, or collapsed to an icon rail */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface/90 backdrop-blur-md transition-[width] duration-200 lg:flex"
        style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 pb-3 pt-4">
            <Link href="/" aria-label="Dashboard">
              <BrandLogo variant="mark" imgClassName="h-10 w-auto" priority />
            </Link>
            {collapseButton}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2 pb-3 pl-5 pr-3 pt-4">
            <div className="min-w-0">
              <Link href="/" aria-label="Dashboard" className="inline-block">
                <BrandLogo imgClassName="h-12 w-auto" priority />
              </Link>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-subtle">{APP_NAME}</p>
            </div>
            {collapseButton}
          </div>
        )}

        {addCheque(collapsed)}
        {nav(collapsed)}
        {account(collapsed)}

        {collapsed && tip && (
          <span
            role="tooltip"
            style={{ top: tip.y }}
            className="pointer-events-none absolute left-full z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-fg shadow-lg"
          >
            {tip.label}
          </span>
        )}
      </aside>
    </>
  );
}
