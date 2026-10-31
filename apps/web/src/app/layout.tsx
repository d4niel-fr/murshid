import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Suspense, type ReactNode } from 'react';
import { AppProvider } from '@/components/providers/app-provider';
import { CookieBanner } from '@/components/shared/cookie-banner';
import { SiteTracker } from '@/components/shared/site-tracker';
import { parsePrefs, PREFS_COOKIE } from '@/lib/prefs';
import { jsonLd, ORG_LD, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import './globals.css';
import './extras.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} · ${SITE_TAGLINE}`, template: '%s · Murshid' },
  description: 'Murshid plans a student’s week around tests, homework and sport, shows its working, and tells teachers who needs support. In English and Arabic.',
  applicationName: SITE_NAME,
  keywords: ['study planner', 'AI tutor', 'UAE schools', 'homework planner', 'flashcards', 'teacher portal', 'مخطط دراسي', 'مرشد'],
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_AE', alternateLocale: ['ar_AE'], url: '/', title: `${SITE_NAME} · ${SITE_TAGLINE}`, description: 'Ask once, plan the week. Murshid plans around tests, homework and sport, and shows every step.' },
  twitter: { card: 'summary_large_image', title: `${SITE_NAME} · ${SITE_TAGLINE}`, description: 'Ask once, plan the week.' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: '#060d1a' }],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const prefs = parsePrefs((await cookies()).get(PREFS_COOKIE)?.value);
  return (
    <html lang={prefs.locale} dir={prefs.locale === 'ar' ? 'rtl' : 'ltr'} data-band={prefs.band} data-text-size={prefs.textSize ?? 'md'} className={prefs.theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--deep)] focus:px-4 focus:py-2 focus:text-sm focus:text-white">
          {prefs.locale === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ORG_LD)} />
        <AppProvider initialPrefs={prefs}>
          {children}
          <CookieBanner />
          <Suspense fallback={null}><SiteTracker /></Suspense>
        </AppProvider>
      </body>
    </html>
  );
}
