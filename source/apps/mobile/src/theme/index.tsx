import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const palette = {
  teal900: '#06322F',
  teal700: '#0B5D57',
  teal500: '#13877E',
  teal100: '#D7F0EC',
  sand500: '#D9A441',
  sand100: '#FBF1DC',
  coral500: '#E5604D',
  green500: '#2E9E5B',
  ink900: '#0F1720',
  ink700: '#334155',
  ink500: '#64748B',
  ink300: '#CBD5E1',
  ink100: '#F1F5F9',
  white: '#FFFFFF',
  night900: '#0B1114',
  night800: '#121B20',
  night700: '#1B2830',
  night500: '#2A3B45',
};

export interface Colors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  danger: string;
  success: string;
  tabBar: string;
}

const light: Colors = {
  bg: '#F7F8F6',
  surface: palette.white,
  surfaceAlt: palette.ink100,
  border: '#E5E9EC',
  text: palette.ink900,
  textMuted: palette.ink500,
  primary: palette.teal700,
  primaryText: palette.white,
  primarySoft: palette.teal100,
  accent: palette.sand500,
  accentSoft: palette.sand100,
  danger: palette.coral500,
  success: palette.green500,
  tabBar: palette.white,
};

const dark: Colors = {
  bg: palette.night900,
  surface: palette.night800,
  surfaceAlt: palette.night700,
  border: palette.night500,
  text: '#E8EEF0',
  textMuted: '#93A4AD',
  primary: '#3FBFB2',
  primaryText: palette.night900,
  primarySoft: '#123A37',
  accent: '#E8B65A',
  accentSoft: '#3A2E14',
  danger: '#F07A68',
  success: '#4CC07D',
  tabBar: palette.night800,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const type = {
  display: { fontSize: 30, fontWeight: '800' as const, lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '700' as const, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16, letterSpacing: 0.4 },
};

export type SchemePref = 'system' | 'light' | 'dark';
export interface Theme {
  dark: boolean;
  colors: Colors;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
  pref: SchemePref;
  setPref: (p: SchemePref) => void;
}

const ThemeCtx = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPref] = useState<SchemePref>('system');
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
  const value = useMemo<Theme>(
    () => ({ dark: isDark, colors: isDark ? dark : light, spacing, radius, type, pref, setPref }),
    [isDark, pref],
  );
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
