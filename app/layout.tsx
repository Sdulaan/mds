import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cookies } from 'next/headers';
import './globals.css';
import BrandWaves from '@/components/BrandWaves';
import { THEME_COOKIE } from '@/lib/theme';
import { APP_NAME, COMPANY } from '@/lib/company';

// Self-hosted (from @fontsource-variable) so dev/build never depend on downloading from Google Fonts.
const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

// Geometric headings, echoing the letterhead lettering.
const montserrat = localFont({
  src: '../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2',
  variable: '--font-montserrat',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${COMPANY.name} - ${APP_NAME}`,
    template: `%s | ${COMPANY.name}`,
  },
  description: `${COMPANY.legalName} credit and debit cheque tracking system.`,
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;

  return (
    <html
      lang="en"
      data-theme={theme === 'light' || theme === 'dark' ? theme : undefined}
      className={`${inter.variable} ${montserrat.variable} h-full`}
    >
      <body className="min-h-dvh antialiased">
        <BrandWaves />
        {children}
      </body>
    </html>
  );
}
