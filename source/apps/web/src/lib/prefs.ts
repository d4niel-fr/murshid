import type { BandId } from './bands';
import type { DataMode } from './api';
import type { Locale } from './i18n';

export type ThemePref = 'light' | 'dark';
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export const TEXT_SIZES: TextSize[] = ['sm', 'md', 'lg', 'xl'];

/** The mascot's look: one character, customised by the student. */
export type MascotColor = 'navy' | 'royal' | 'teal' | 'lime' | 'coral' | 'violet';
export type MascotAccessory = 'none' | 'glasses' | 'cap' | 'headphones' | 'bow';
export interface MascotPrefs { color: MascotColor; accessory: MascotAccessory; name: string }
export const MASCOT_COLORS: MascotColor[] = ['navy', 'royal', 'teal', 'lime', 'coral', 'violet'];
export const MASCOT_ACCESSORIES: MascotAccessory[] = ['none', 'glasses', 'cap', 'headphones', 'bow'];
export const DEFAULT_MASCOT: MascotPrefs = { color: 'navy', accessory: 'none', name: 'Nour' };

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
  /** reading comfort: scales the whole interface */
  textSize?: TextSize;
  mascot?: MascotPrefs;
  /** Ask Murshid in companion mode: the mascot answers in speech bubbles */
  companion?: boolean;
  /** read companion replies aloud (browser speech) */
  voice?: boolean;
}

export const DEFAULT_PREFS: Prefs = { band: 'g9-10', locale: 'en', theme: 'light', dataMode: 'auto', sidebar: null, textSize: 'md', mascot: DEFAULT_MASCOT, companion: false, voice: false };

function parseMascot(x: unknown): MascotPrefs {
  const m = (x && typeof x === 'object' ? x : {}) as Partial<MascotPrefs>;
  const name = typeof m.name === 'string' ? m.name.replace(/[^\p{L}\p{N} '-]/gu, '').trim().slice(0, 18) : '';
  return {
    color: MASCOT_COLORS.includes(m.color as MascotColor) ? (m.color as MascotColor) : DEFAULT_MASCOT.color,
    accessory: MASCOT_ACCESSORIES.includes(m.accessory as MascotAccessory) ? (m.accessory as MascotAccessory) : DEFAULT_MASCOT.accessory,
    name: name || DEFAULT_MASCOT.name,
  };
}
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
      textSize: TEXT_SIZES.includes(x.textSize as TextSize) ? (x.textSize as TextSize) : 'md',
      mascot: parseMascot(x.mascot),
      companion: x.companion === true,
      voice: x.voice === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function serializePrefs(p: Prefs): string {
  return encodeURIComponent(JSON.stringify(p));
}
