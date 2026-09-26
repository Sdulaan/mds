import Sidebar from '@/components/Sidebar';
import { requireUser } from '@/lib/auth';
import { COMPANY } from '@/lib/company';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser();

  return (
    <div className="min-h-dvh lg:pl-64">
      <Sidebar username={user.username} fullName={user.fullName} role={user.role} />
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
