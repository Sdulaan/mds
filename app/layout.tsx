import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
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
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-dvh antialiased">
        {/* Animated gradient background */}
        <div className="animated-bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
