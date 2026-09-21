'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CreditCard, LayoutDashboard, Plus, Users } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ledger', label: 'Ledger', icon: CreditCard },
  { href: '/add-cheque', label: 'Add Cheque', icon: Plus },
  { href: '/entities', label: 'Entities', icon: Users },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-shadow">
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-white leading-none">MDS Pharmacy</p>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">Cheque Management</p>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`
                  flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-violet-600/20 text-violet-300 shadow-inner'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
