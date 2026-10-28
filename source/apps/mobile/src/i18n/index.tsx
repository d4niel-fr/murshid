import * as Localization from 'expo-localization';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { I18nManager, Platform } from 'react-native';
import { ar } from './ar';
import { en } from './en';

export type Lang = 'en' | 'ar';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<typeof en>;

const dicts: Record<Lang, unknown> = { en, ar };

function lookup(dict: unknown, key: string): string | undefined {
  let cur: unknown = dict;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const raw = lookup(dicts[lang], key) ?? lookup(en, key) ?? key;
  return vars ? raw.replace(/\{\{(\w+)\}\}/g, (_, v: string) => String(vars[v] ?? '')) : raw;
}

interface I18n {
  lang: Lang;
  isRTL: boolean;
  /** True when we must flip rows/alignment ourselves (web, or native before the RTL reload). */
  flip: boolean;
  setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18n | null>(null);

function applyDirection(rtl: boolean) {
  I18nManager.allowRTL(true);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  } else if (I18nManager.isRTL !== rtl) {
    // Native layout direction flips fully after an app reload (expo-updates / dev reload).
    I18nManager.forceRTL(rtl);
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const initial: Lang = Localization.getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  const [lang, setLangState] = useState<Lang>(() => {
    applyDirection(initial === 'ar');
    return initial;
  });
  const setLang = useCallback((l: Lang) => {
    applyDirection(l === 'ar');
    setLangState(l);
  }, []);
  const value = useMemo<I18n>(
    () => ({ lang, isRTL: lang === 'ar', flip: (lang === 'ar') !== (Platform.OS !== 'web' && I18nManager.isRTL), setLang, t: (k, v) => translate(lang, k, v) }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n must be used inside I18nProvider');
  return c;
}

export function formatDate(iso: string | null | undefined, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE' : 'en-AE', { timeZone: 'Asia/Dubai', ...opts }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function relativeDay(iso: string | null | undefined, lang: Lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 86_400_000);
  try {
    const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
    if (Math.abs(diff) <= 6) return rtf.format(diff, 'day');
  } catch {
    /* Hermes without Intl.RelativeTimeFormat: fall through */
  }
  return formatDate(iso, lang, { weekday: 'short', day: 'numeric', month: 'short' });
}
