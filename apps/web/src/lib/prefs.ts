import type { BandId } from './bands';
import type { DataMode } from './api';
import type { Locale } from './i18n';

export type ThemePref = 'light' | 'dark';
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export const TEXT_SIZES: TextSize[] = ['sm', 'md', 'lg', 'xl'];

/**
 * The mascot: Murshid, a small companion bot (not a person). Students shape it: the shell (orb, cube, capsule or the
 * Murshid star), the eyes on its screen, the shell colour, the glow colour and an accessory. It is always called Murshid.
 */
export type MascotShape = 'orb' | 'cube' | 'capsule' | 'star';
export type MascotFace = 'round' | 'tall' | 'wide' | 'mono';
export type MascotColor = 'navy' | 'royal' | 'teal' | 'lime' | 'coral' | 'violet';
export type MascotGlow = 'sky' | 'lime' | 'mint' | 'white' | 'coral';
export type MascotAccessory = 'none' | 'antenna' | 'headphones' | 'cap' | 'bow';
export interface MascotPrefs { shape: MascotShape; face: MascotFace; color: MascotColor; glow: MascotGlow; accessory: MascotAccessory }
export const MASCOT_SHAPES: MascotShape[] = ['orb', 'cube', 'capsule', 'star'];
export const MASCOT_FACES: MascotFace[] = ['round', 'tall', 'wide', 'mono'];
export const MASCOT_COLORS: MascotColor[] = ['navy', 'royal', 'teal', 'lime', 'coral', 'violet'];
export const MASCOT_GLOWS: MascotGlow[] = ['sky', 'lime', 'mint', 'white', 'coral'];
export const MASCOT_ACCESSORIES: MascotAccessory[] = ['none', 'antenna', 'headphones', 'cap', 'bow'];
export const DEFAULT_MASCOT: MascotPrefs = { shape: 'orb', face: 'round', color: 'navy', glow: 'sky', accessory: 'antenna' };
export const MASCOT_NAME = { en: 'Murshid', ar: 'مرشد' } as const;

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
  if (!x || typeof x !== 'object') return DEFAULT_MASCOT; // nothing saved yet: the default bot
  const m = x as Partial<MascotPrefs> & { kind?: string };
  const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
  return {
    // saved when the mascot could be the star character: keep the star shape
    shape: pick(MASCOT_SHAPES, m.shape, m.kind === 'star' ? 'star' : DEFAULT_MASCOT.shape),
    face: pick(MASCOT_FACES, m.face, DEFAULT_MASCOT.face),
    color: pick(MASCOT_COLORS, m.color, DEFAULT_MASCOT.color),
    glow: pick(MASCOT_GLOWS, m.glow, DEFAULT_MASCOT.glow),
    accessory: pick(MASCOT_ACCESSORIES, m.accessory, m.shape ? DEFAULT_MASCOT.accessory : 'none'),
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
