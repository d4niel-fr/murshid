'use client';

import { useEffect, useState } from 'react';
import { ago } from '@/lib/ago';

/**
 * A relative time ("3 min ago", then a date after a week). Filled in after the page loads and kept current, because a
 * page rendered ahead of time (at build or on the server) would otherwise show a stale value that differs from the
 * browser's and breaks hydration.
 */
export function Ago({ ts, locale, className }: { ts: number; locale: 'en' | 'ar'; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return <time className={className} dateTime={new Date(ts).toISOString()} suppressHydrationWarning>{now === null ? '' : ago(ts, locale, now)}</time>;
}
