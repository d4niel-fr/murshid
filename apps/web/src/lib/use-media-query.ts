'use client';

import { useSyncExternalStore } from 'react';

/** SSR-safe media query (false on the server). Use for behaviour, not for layout (layout uses CSS breakpoints). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
