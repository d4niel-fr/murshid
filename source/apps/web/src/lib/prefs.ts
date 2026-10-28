import type { BandId } from './bands';
import type { DataMode } from './api';
import type { Locale } from './i18n';

export type ThemePref = 'light' | 'dark';

export interface Prefs {
  band: BandId;
  locale: Locale;
  theme: ThemePref;
  dataMode: DataMode;
  /** null = automatic (rail below 1280px, expanded above) */
  sidebar: 'expanded' | 'collapsed' | null;
  /** demo student override (e.g. 'demo-ideal', the flagship persona); null = the band's demo student */
  persona?: string | null;
  /** opt-in: show "How Murshid worked this out" under replies and automated actions */
  showWorkings?: boolean;
  /** chat persona: the tutor (default) or the optional, guardrailed study buddy */
  chatPersona?: 'tutor' | 'buddy';
}

export const DEFAULT_PREFS: Prefs = { band: 'g9-10', locale: 'en', theme: 'light', dataMode: 'auto', sidebar: null };
export const PREFS_COOKIE = 'murshid_prefs';

const BANDS: BandId[] = ['g5-6', 'g7-8', 'g9-10', 'g11-12'];

export function parsePrefs(raw: string | undefined | null): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const x = JSON.parse(decodeURIComponent(raw)) as Partial<Prefs>;
    return {
      band: BANDS.includes(x.band as BandId) ? (x.band as BandId) : DEFAULT_PREFS.band,
      locale: x.locale === 'ar' ? 'ar' : 'en',
      theme: x.theme === 'dark' ? 'dark' : 'light',
      dataMode: x.dataMode === 'mock' ? 'mock' : 'auto',
      sidebar: x.sidebar === 'expanded' || x.sidebar === 'collapsed' ? x.sidebar : null,
      persona: typeof x.persona === 'string' && /^[a-z0-9-]{3,40}$/.test(x.persona) ? x.persona : null,
      showWorkings: x.showWorkings === true,
      chatPersona: x.chatPersona === 'buddy' ? 'buddy' : 'tutor',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function serializePrefs(p: Prefs): string {
  return encodeURIComponent(JSON.stringify(p));
}
