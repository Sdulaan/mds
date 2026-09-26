import Navbar from '@/components/Navbar';
import { requireUser } from '@/lib/auth';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await requireUser();

  return (
    <>
      <Navbar username={user.username} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}
