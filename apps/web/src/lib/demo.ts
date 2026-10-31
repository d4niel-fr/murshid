import { DEFAULT_PREFS, PREFS_COOKIE, serializePrefs } from '@/lib/prefs';

/** Where the teacher and school portal lives (the admin app). */
export const ADMIN_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MURSHID_ADMIN_URL) || 'http://localhost:3001';
export const TEACHER_DEMO_URL = `${ADMIN_URL}/login?demo=teacher`;
export const ADMIN_DEMO_URL = `${ADMIN_URL}/login?demo=admin`;

/** Sign in as the flagship student persona: band Grade 11-12, persona demo-ideal, workings shown. */
export function openStudent() {
  const prefs = { ...DEFAULT_PREFS, band: 'g11-12' as const, sidebar: 'expanded' as const, persona: 'demo-ideal', showWorkings: true };
  document.cookie = `${PREFS_COOKIE}=${serializePrefs(prefs)}; path=/; max-age=31536000; samesite=lax`;
  window.location.href = '/app';
}
