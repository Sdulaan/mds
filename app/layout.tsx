import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'MDS Pharmacy - Cheque Management',
    template: '%s | MDS Pharmacy',
  },
  description: 'MDS Pharmacy monthly credit and debit cheque tracking system.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="min-h-dvh antialiased">
        {/* Animated gradient background */}
        <div className="animated-bg" aria-hidden="true" />
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
