'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { library } from '@/lib/library';

/** Remembers recently viewed pages (after the page has set its title). */
export function SiteTracker() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const q = params.toString();
    const href = `${pathname}${q && !q.startsWith('q=') ? `?${q}` : ''}`;
    const t = setTimeout(() => library.visit(href, document.title), 400);
    return () => clearTimeout(t);
  }, [pathname, params]);
  return null;
}
