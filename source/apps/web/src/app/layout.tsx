import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppProvider } from '@/components/providers/app-provider';
import { parsePrefs, PREFS_COOKIE } from '@/lib/prefs';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Murshid', template: '%s · Murshid' },
  description: 'A calm companion for UAE students: academics, activities, goals and opportunities in one place.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#faf9f7' }, { media: '(prefers-color-scheme: dark)', color: '#141312' }],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  return (
    <html lang={prefs.locale} dir={prefs.locale === 'ar' ? 'rtl' : 'ltr'} data-band={prefs.band} className={prefs.theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <body>
        <AppProvider initialPrefs={prefs}>{children}</AppProvider>
      </body>
    </html>
  );
}
