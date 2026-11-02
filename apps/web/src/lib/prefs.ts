import type { BandId } from './bands';
import type { DataMode } from './api';
import type { Locale } from './i18n';

export type ThemePref = 'light' | 'dark';
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export const TEXT_SIZES: TextSize[] = ['sm', 'md', 'lg', 'xl'];

/**
 * The mascot: Murshid, a small companion bot with one flat-coloured head and two dark eyes (no human features). Students shape
 * it: the head (orb, pebble, cube or capsule), the eyes, the body colour and the eye colour. It is always called Murshid.
 */
export type MascotShape = 'orb' | 'pebble' | 'cube' | 'capsule';
export type MascotFace = 'tall' | 'round' | 'wide' | 'mono';
export type MascotColor = 'royal' | 'navy' | 'sky' | 'teal' | 'violet' | 'coral' | 'lime' | 'graphite';
/** eye colour: 'auto' = near-black, or white on a dark body */
export type MascotGlow = 'auto' | 'ink' | 'white' | 'sky' | 'lime';
/** v: the look's version (2 = the flat bot with dark eyes) */
export interface MascotPrefs { shape: MascotShape; face: MascotFace; color: MascotColor; glow: MascotGlow; v?: 2 }
export const MASCOT_SHAPES: MascotShape[] = ['orb', 'pebble', 'cube', 'capsule'];
export const MASCOT_FACES: MascotFace[] = ['tall', 'round', 'wide', 'mono'];
export const MASCOT_COLORS: MascotColor[] = ['royal', 'navy', 'sky', 'teal', 'violet', 'coral', 'lime', 'graphite'];
export const MASCOT_GLOWS: MascotGlow[] = ['auto', 'ink', 'white', 'sky', 'lime'];
export const DEFAULT_MASCOT: MascotPrefs = { shape: 'orb', face: 'tall', color: 'royal', glow: 'auto', v: 2 };
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
  const m = x as Partial<Record<keyof MascotPrefs, unknown>>;
  const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
  // older looks carry over where they still exist (the star and cube shapes, mint or coral eyes, and so on fall back)
  return {
    shape: pick(MASCOT_SHAPES, m.shape, DEFAULT_MASCOT.shape),
    face: pick(MASCOT_FACES, m.face, DEFAULT_MASCOT.face),
    color: pick(MASCOT_COLORS, m.color, DEFAULT_MASCOT.color),
    // white eyes were the old default: bots saved before the redesign move to the new automatic eyes
    glow: m.v !== 2 && (m.glow === 'white' || m.glow === undefined) ? 'auto' : pick(MASCOT_GLOWS, m.glow, DEFAULT_MASCOT.glow),
    v: 2,
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
