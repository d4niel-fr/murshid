import { visibleNav, type BandId, type NavId } from '@/lib/bands';
import type { Locale } from '@/lib/i18n';

/** Where each grade-bands NavId lives in this app (several catalog items share a page). */
export const NAV_ROUTE: Record<NavId, string> = {
  home: '/app', today: '/app/planner', schoolwork: '/app/academics', activities: '/app/extracurriculars', goals: '/app/goals', badges: '/app/goals',
  clubs: '/app/extracurriculars', competitions: '/app/opportunities', planner: '/app/planner', opportunities: '/app/opportunities',
  subjects: '/app/academics', careers: '/app/opportunities', portfolio: '/app/profile', applications: '/app/opportunities?tab=applications',
  university: '/app/opportunities?tab=applications', cv: '/app/profile', links: '/app/profile', chat: '/app/chat', settings: '/app/settings',
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
  const insights = { key: 'insights', href: '/app/insights', icon: 'ChartLine', label: locale === 'ar' ? 'الرؤى والرسوم' : 'Insights', primary: true };
  // School (licence, classes, work from teachers) sits right after Home
  const homeIdx = out.findIndex((i) => i.key === 'home');
  out.splice(homeIdx >= 0 ? homeIdx + 1 : 0, 0, { key: 'school', href: '/app/school', icon: 'Building2', label: locale === 'ar' ? 'المدرسة' : 'School', primary: true },
    { key: 'feelings', href: '/app/feelings', icon: 'Heart', label: locale === 'ar' ? 'كيف حالك؟' : 'Check-in', primary: true });
  const chatIdx = out.findIndex((i) => i.key === 'chat');
  out.splice(chatIdx >= 0 ? chatIdx : out.length - 1, 0, insights);
  // Study tools (flashcards, notes, focus timer) sit with the learning pages
  const study = { key: 'study', href: '/app/study', icon: 'Layers', label: locale === 'ar' ? 'أدوات الدراسة' : 'Study', primary: true };
  const learnIdx = out.findIndex((i) => i.key === 'schoolwork' || i.key === 'subjects');
  out.splice(learnIdx >= 0 ? learnIdx + 1 : out.length, 0, study);
  out.push({ key: 'saved', href: '/app/saved', icon: 'Bookmark', label: locale === 'ar' ? 'المحفوظات' : 'Saved', primary: false });
  // Profile & links is always reachable from Settings; surface it in nav when the band has no profile item.
  return out;
}

/** School sections that light up the School item in the nav. */
const SCHOOL_SECTIONS = ['/app/timetable', '/app/attendance', '/app/points', '/app/polls', '/app/events', '/app/reports'];

export function isActive(pathname: string, href: string): boolean {
  const path = href.split('?')[0]!;
  if (path === '/' || path === '/app') return pathname === path;
  if (path === '/app/school' && SCHOOL_SECTIONS.some((s) => pathname === s || pathname.startsWith(`${s}/`))) return true;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Sidebar groups: what you do today, what you are learning, where you are going. */
export type NavSection = 'main' | 'learn' | 'grow';
const SECTION: Record<string, NavSection> = {
  home: 'main', school: 'main', feelings: 'main', today: 'main', planner: 'main', chat: 'main',
  schoolwork: 'learn', subjects: 'learn', study: 'learn', insights: 'learn', goals: 'learn', badges: 'learn', saved: 'grow',
  activities: 'grow', clubs: 'grow', competitions: 'grow', opportunities: 'grow', careers: 'grow',
  applications: 'grow', university: 'grow', portfolio: 'grow', cv: 'grow', links: 'grow',
};
export const navSection = (key: string): NavSection => SECTION[key] ?? 'grow';
export const SECTION_LABEL: Record<NavSection, { en: string; ar: string } | null> = {
  main: null,
  learn: { en: 'Learning', ar: 'التعلّم' },
  grow: { en: 'Growth', ar: 'النمو' },
};
