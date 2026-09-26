'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Building2, DatabaseBackup, FileSpreadsheet, FileText,
  LayoutDashboard, LogOut, Menu, ShoppingCart, UserCog, Users, X,
} from 'lucide-react';
import { logout } from '@/actions/authActions';
import BrandLogo from '@/components/BrandLogo';
import ThemeToggle from '@/components/ThemeToggle';
import { APP_NAME } from '@/lib/company';
import type { Role } from '@/types';

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const SECTIONS: { title?: string; items: Item[]; adminOnly?: boolean }[] = [
  { items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Receivables',
    items: [
      { href: '/receivables', label: 'Customer Cheques', icon: ArrowDownLeft },
      { href: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    title: 'Payables',
    items: [
      { href: '/payables', label: 'Creditor Cheques', icon: ArrowUpRight },
      { href: '/purchases', label: 'Purchases (GRN)', icon: ShoppingCart },
      { href: '/creditors', label: 'Creditors', icon: Building2 },
    ],
  },
  { title: 'Reports', items: [{ href: '/reports', label: 'Reports', icon: FileText }] },
  {
    title: 'Administration',
    adminOnly: true,
    items: [
      { href: '/admin/users', label: 'Users', icon: UserCog },
      { href: '/admin/activity', label: 'Activity Log', icon: Activity },
      { href: '/admin/import', label: 'Import Excel', icon: FileSpreadsheet },
      { href: '/admin/backup', label: 'Backup & Restore', icon: DatabaseBackup },
    ],
  },
];

interface SidebarProps {
  username: string;
  fullName: string | null;
  role: Role;
}

export default function Sidebar({ username, fullName, role }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {SECTIONS.filter((s) => !s.adminOnly || role === 'ADMIN').map((section, i) => (
        <div key={i}>
          {section.title && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{section.title}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-fg'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold uppercase text-brand">
          {(fullName || username).slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">{fullName || username}</p>
          <p className="text-xs text-subtle">{role === 'ADMIN' ? 'Administrator' : 'Standard user'}</p>
        </div>
        <ThemeToggle />
        <form action={logout}>
          <button
            type="submit"
            title="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-3 px-5 py-4" aria-label="Dashboard">
      <BrandLogo imgClassName="h-14 w-auto" priority />
    </Link>
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

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface">
            <div className="flex items-center justify-between pr-3">
              {brand}
              <button type="button" onClick={() => setOpen(false)} className="p-2 text-muted" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {account}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/90 backdrop-blur-md lg:flex">
        {brand}
        <p className="-mt-2 px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-subtle">{APP_NAME}</p>
        {nav}
        {account}
      </aside>
    </>
  );
}
