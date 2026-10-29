import { visibleNav, type BandId, type NavId } from '@/lib/bands';
import type { Locale } from '@/lib/i18n';

/** Where each grade-bands NavId lives in this app (several catalog items share a page). */
export const NAV_ROUTE: Record<NavId, string> = {
  home: '/', today: '/planner', schoolwork: '/academics', activities: '/extracurriculars', goals: '/goals', badges: '/goals',
  clubs: '/extracurriculars', competitions: '/opportunities', planner: '/planner', opportunities: '/opportunities',
  subjects: '/academics', careers: '/opportunities', portfolio: '/profile', applications: '/opportunities?tab=applications',
  university: '/opportunities?tab=applications', cv: '/profile', links: '/profile', chat: '/chat', settings: '/settings',
};

export interface AppNavItem { key: string; href: string; icon: string; label: string; primary: boolean }

/** Band nav (labels/order from @murshid/grade-bands), deduped by route, plus Insights (charts studio). */
export function appNav(band: BandId, locale: Locale): AppNavItem[] {
  const seen = new Set<string>();
  const out: AppNavItem[] = [];
  for (const n of visibleNav(band)) {
    const href = NAV_ROUTE[n.id] ?? n.href;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ key: n.id, href, icon: n.icon, label: n.label[locale], primary: n.primary });
  }
  const insights = { key: 'insights', href: '/insights', icon: 'ChartLine', label: locale === 'ar' ? 'الرؤى والرسوم' : 'Insights', primary: true };
  // School (licence, classes, work from teachers) sits right after Home
  const homeIdx = out.findIndex((i) => i.key === 'home');
  out.splice(homeIdx >= 0 ? homeIdx + 1 : 0, 0, { key: 'school', href: '/school', icon: 'Building2', label: locale === 'ar' ? 'المدرسة' : 'School', primary: true });
  const chatIdx = out.findIndex((i) => i.key === 'chat');
  out.splice(chatIdx >= 0 ? chatIdx : out.length - 1, 0, insights);
  // Profile & links is always reachable from Settings; surface it in nav when the band has no profile item.
  return out;
}

export function isActive(pathname: string, href: string): boolean {
  const path = href.split('?')[0]!;
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Sidebar groups: what you do today, what you are learning, where you are going. */
export type NavSection = 'main' | 'learn' | 'grow';
const SECTION: Record<string, NavSection> = {
  home: 'main', school: 'main', today: 'main', planner: 'main', chat: 'main',
  schoolwork: 'learn', subjects: 'learn', insights: 'learn', goals: 'learn', badges: 'learn',
  activities: 'grow', clubs: 'grow', competitions: 'grow', opportunities: 'grow', careers: 'grow',
  applications: 'grow', university: 'grow', portfolio: 'grow', cv: 'grow', links: 'grow',
};
export const navSection = (key: string): NavSection => SECTION[key] ?? 'grow';
export const SECTION_LABEL: Record<NavSection, { en: string; ar: string } | null> = {
  main: null,
  learn: { en: 'Learning', ar: 'التعلّم' },
  grow: { en: 'Growth', ar: 'النمو' },
};
