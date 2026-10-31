import type { FeatureId, Localized, NavId, NavItem } from './types.js';

type NavDef = { href: string; icon: string; label: Localized; requires?: FeatureId };

/** Single catalog so hrefs/icons stay consistent across bands; bands pick + order + relabel. */
export const NAV_CATALOG: Record<NavId, NavDef> = {
  home: { href: '/', icon: 'House', label: { en: 'Home', ar: 'الرئيسية' } },
  today: { href: '/today', icon: 'CalendarCheck', label: { en: 'Today', ar: 'اليوم' } },
  schoolwork: { href: '/academics', icon: 'BookOpen', label: { en: 'Schoolwork', ar: 'الدراسة' } },
  activities: { href: '/activities', icon: 'Activity', label: { en: 'Activities', ar: 'الأنشطة' } },
  goals: { href: '/goals', icon: 'Target', label: { en: 'Goals', ar: 'الأهداف' } },
  badges: { href: '/badges', icon: 'Award', label: { en: 'Badges', ar: 'الشارات' }, requires: 'badges' },
  clubs: { href: '/clubs', icon: 'Users', label: { en: 'Clubs', ar: 'النوادي' }, requires: 'clubs' },
  competitions: { href: '/competitions', icon: 'Trophy', label: { en: 'Competitions', ar: 'المسابقات' }, requires: 'schoolCompetitions' },
  planner: { href: '/planner', icon: 'CalendarRange', label: { en: 'Study planner', ar: 'مخطط الدراسة' }, requires: 'studyPlanner' },
  opportunities: { href: '/opportunities', icon: 'Sparkles', label: { en: 'Opportunities', ar: 'الفرص' }, requires: 'externalOpportunities' },
  subjects: { href: '/subjects', icon: 'ListChecks', label: { en: 'Subject choices', ar: 'اختيار المواد' }, requires: 'subjectChoices' },
  careers: { href: '/careers', icon: 'Compass', label: { en: 'Career explorer', ar: 'استكشاف المهن' }, requires: 'careerExplorer' },
  portfolio: { href: '/portfolio', icon: 'FolderOpen', label: { en: 'Portfolio', ar: 'ملف الإنجازات' }, requires: 'portfolio' },
  applications: { href: '/applications', icon: 'Send', label: { en: 'Applications', ar: 'الطلبات' }, requires: 'applications' },
  university: { href: '/university', icon: 'GraduationCap', label: { en: 'University planner', ar: 'مخطط الجامعة' }, requires: 'universityPlanner' },
  cv: { href: '/cv', icon: 'FileText', label: { en: 'CV', ar: 'السيرة الذاتية' }, requires: 'cv' },
  links: { href: '/profile/links', icon: 'Link', label: { en: 'Profiles & links', ar: 'الحسابات والروابط' }, requires: 'socialLinks' },
  chat: { href: '/chat', icon: 'MessageCircle', label: { en: 'Ask Murshid', ar: 'اسأل مرشد' }, requires: 'aiChat' },
  settings: { href: '/settings', icon: 'Settings', label: { en: 'Settings', ar: 'الإعدادات' } },
};

export function navItem(id: NavId, primary: boolean, label?: Localized): NavItem {
  const d = NAV_CATALOG[id];
  return {
    id,
    href: d.href,
    icon: d.icon,
    label: label ?? d.label,
    primary,
    ...(d.requires ? { requires: d.requires } : {}),
  };
}

/** Flatten `{ key: {en, ar} }` into the contract's `Record<string,string>` shape (`en.key`, `ar.key`). */
export function flattenCopy(src: Record<string, Localized>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    out[`en.${k}`] = v.en;
    out[`ar.${k}`] = v.ar;
  }
  return out;
}

/** Keys every band must translate (checked in tests). */
export const REQUIRED_COPY_KEYS = [
  'greeting.morning',
  'greeting.afternoon',
  'greeting.evening',
  'dashboard.subtitle',
  'today.empty',
  'upcoming.title',
  'streaks.title',
  'goals.title',
  'progress.title',
  'chat.placeholder',
  'chat.intro',
  'chat.integrity',
  'chat.capReached',
  'chat.refusal',
  'chat.safety',
  'celebrate.goal',
  'break.reminder',
  'guardian.notice',
  'empty.generic',
] as const;
export type CopyKey = (typeof REQUIRED_COPY_KEYS)[number];
