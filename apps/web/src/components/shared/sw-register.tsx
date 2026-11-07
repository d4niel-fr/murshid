'use client';

import { useEffect } from 'react';

/** Registers the service worker in production, so the app opens offline and can be installed. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    const go = () => { void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  }, []);
  return null;
}
