'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, FileText, LayoutDashboard, LogOut, Plus, Users } from 'lucide-react';
import { logout } from '@/actions/authActions';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ledger', label: 'Ledger', icon: CreditCard },
  { href: '/add-cheque', label: 'Add Cheque', icon: Plus },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/entities', label: 'Entities', icon: Users },
];

export default function Navbar({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-white leading-none">MDS Pharmacy</p>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Cheque Management</p>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`
                  flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-violet-600/20 text-violet-300 shadow-inner'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}

          <form action={logout} className="ml-2 flex items-center gap-2 border-l border-white/10 pl-3">
            <span className="hidden text-xs text-slate-500 xl:inline">{username}</span>
            <button
              type="submit"
              title="Sign out"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
