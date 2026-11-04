'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { BANDS, t as bandT, type BandConfig, type BandId } from '@/lib/bands';
import { createClient, type MurshidClient, type Result } from '@/lib/api';
import { translate, type Locale, type MsgKey } from '@/lib/i18n';
import { EMPTY_USER, mergeWorld, type UserState } from '@/lib/merge';
import { mockWorld, type MockWorld } from '@/lib/mock/data';
import { spring } from '@/lib/motion';
import { PREFS_COOKIE, serializePrefs, type Prefs } from '@/lib/prefs';
import { Toaster, type ToastInput, type ToastItem } from '@/components/ui/toaster';
import { STORAGE_FULL } from '@/lib/local-store';

interface AppCtx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  band: BandId;
  bandConfig: BandConfig;
  locale: Locale;
  dir: 'ltr' | 'rtl';
  t: (key: MsgKey) => string;
  tx: (en: string, ar: string) => string;
  bt: (key: string, vars?: Record<string, string | number>) => string;
  world: MockWorld;
  client: MurshidClient;
  user: UserState;
  update: (fn: (u: UserState) => UserState) => void;
  resetUser: () => void;
  toast: (t: ToastInput) => void;
  apiStatus: 'unknown' | 'up' | 'down';
  reportSource: (s: Result<unknown>['source']) => void;
  hydrated: boolean;
}

const Ctx = createContext<AppCtx | null>(null);

const storageKey = (band: BandId) => `murshid:user:${band}`;

export function AppProvider({ initialPrefs, children }: { initialPrefs: Prefs; children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(initialPrefs);
  const [userByBand, setUserByBand] = useState<Partial<Record<BandId, UserState>>>({});
  const [hydrated, setHydrated] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [apiStatus, setApiStatus] = useState<AppCtx['apiStatus']>(initialPrefs.dataMode === 'mock' ? 'down' : 'unknown');
  const band = prefs.band;
  const locale = prefs.locale;

  // Load locally-stored user state for the active band (after hydration, so SSR markup matches).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(band));
      const parsed = raw ? ({ ...EMPTY_USER, ...JSON.parse(raw) } as UserState) : EMPTY_USER;
      setUserByBand((m) => (m[band] ? m : { ...m, [band]: parsed }));
    } catch { /* storage unavailable */ }
    setHydrated(true);
  }, [band]);

  const user = userByBand[band] ?? EMPTY_USER;
  const userRef = useRef(user);
  userRef.current = user;

  const update = useCallback((fn: (u: UserState) => UserState) => {
    setUserByBand((m) => {
      const next = fn(m[band] ?? EMPTY_USER);
      try { localStorage.setItem(storageKey(band), JSON.stringify(next)); } catch { /* ignore */ }
      return { ...m, [band]: next };
    });
  }, [band]);

  const resetUser = useCallback(() => {
    for (const b of Object.keys(BANDS)) { try { localStorage.removeItem(storageKey(b as BandId)); } catch { /* ignore */ } }
    setUserByBand({});
  }, []);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...p };
      document.cookie = `${PREFS_COOKIE}=${serializePrefs(next)}; path=/; max-age=31536000; samesite=lax`;
      const html = document.documentElement;
      html.lang = next.locale;
      html.dir = next.locale === 'ar' ? 'rtl' : 'ltr';
      html.dataset.band = next.band;
      html.dataset.textSize = next.textSize ?? 'md';
      html.classList.toggle('dark', next.theme === 'dark');
      return next;
    });
  }, []);

  // Persona override (e.g. the flagship demo-ideal student): the shell, greetings and chat use the persona's own
  // identity from GET /dashboard instead of the band's bundled demo student.
  const [personaStudent, setPersonaStudent] = useState<{ id: string; who: Pick<MockWorld['dashboard']['student'], 'firstName' | 'lastName' | 'nameAr' | 'classLabel' | 'school' | 'grade'> } | null>(null);
  const baseWorld = useMemo(() => mergeWorld(mockWorld(band, undefined, prefs.persona), user), [band, user, prefs.persona]);
  const world = useMemo<MockWorld>(() => {
    if (!prefs.persona || personaStudent?.id !== prefs.persona) return baseWorld;
    return { ...baseWorld, dashboard: { ...baseWorld.dashboard, student: { ...baseWorld.dashboard.student, ...personaStudent.who } } };
  }, [baseWorld, prefs.persona, personaStudent]);
  const worldRef = useRef(world);
  worldRef.current = world;

  const client = useMemo(
    () => createClient({ band, locale, mode: prefs.dataMode, world: () => worldRef.current, persona: prefs.persona }),
    [band, locale, prefs.dataMode, prefs.persona],
  );

  useEffect(() => {
    const persona = prefs.persona;
    if (!persona || prefs.dataMode === 'mock') return;
    let alive = true;
    void client.getDashboard().then((r) => {
      setApiStatus((cur) => (r.source === 'api' ? 'up' : cur));
      if (!alive || r.source !== 'api') return;
      const { firstName, lastName, nameAr, classLabel, school, grade } = r.data.student;
      if (firstName) setPersonaStudent({ id: persona, who: { firstName, lastName, nameAr: nameAr || `${firstName} ${lastName}`, classLabel, school, grade } });
    });
    return () => { alive = false; };
  }, [client, prefs.persona, prefs.dataMode]);

  const reportSource = useCallback((s: 'api' | 'mock') => {
    setApiStatus((cur) => (s === 'api' ? 'up' : cur === 'up' ? 'up' : 'down'));
  }, []);

  useEffect(() => { if (prefs.dataMode === 'mock') setApiStatus('down'); else setApiStatus('unknown'); }, [prefs.dataMode]);

  const toast = useCallback((input: ToastInput) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts.slice(-2), { ...input, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), input.duration ?? 3200);
  }, []);

  // this device ran out of room for saved work: tell the student once a minute at most, in their language
  const localeRef = useRef(locale); localeRef.current = locale;
  useEffect(() => {
    let last = 0;
    const on = () => {
      if (Date.now() - last < 60_000) return; last = Date.now();
      const ar = localeRef.current === 'ar';
      toast({ tone: 'danger', duration: 9000,
        title: ar ? 'لم يعد هناك مكان على هذا الجهاز' : 'This device is out of room',
        description: ar ? 'لم يُحفظ آخر تغيير. احذف بعض الصور من السبورات أو الدفاتر، أو صدّر بياناتك من الإعدادات.' : 'Your last change was not saved. Remove some pictures from boards or notebooks, or export your data from Settings.' });
    };
    window.addEventListener(STORAGE_FULL, on);
    return () => window.removeEventListener(STORAGE_FULL, on);
  }, [toast]);

  const value = useMemo<AppCtx>(() => ({
    prefs, setPrefs, band, bandConfig: BANDS[band], locale, dir: locale === 'ar' ? 'rtl' : 'ltr',
    t: (k) => translate(locale, k),
    tx: (en, ar) => (locale === 'ar' ? ar : en),
    bt: (k, vars) => bandT(band, k, locale, vars),
    world, client, user, update, resetUser, toast, apiStatus, reportSource, hydrated,
  }), [prefs, setPrefs, band, locale, world, client, user, update, resetUser, toast, apiStatus, reportSource, hydrated]);

  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion="user" transition={spring.gentle}>
        {children}
        <Toaster toasts={toasts} onDismiss={(id) => setToasts((ts) => ts.filter((x) => x.id !== id))} />
      </MotionConfig>
    </Ctx.Provider>
  );
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

/**
 * Read an API endpoint with instant mock data. Renders `fallback` immediately, then (in auto mode) swaps in the
 * live API response if it arrives with the contract shape.
 */
export function useEndpoint<T>(key: string, call: (c: MurshidClient) => Promise<Result<T>>, fallback: T): { data: T; source: 'api' | 'mock' } {
  const { client, prefs, reportSource } = useApp();
  const [live, setLive] = useState<{ key: string; data: T } | null>(null);
  const callRef = useRef(call);
  callRef.current = call;
  useEffect(() => {
    if (prefs.dataMode === 'mock') return;
    let alive = true;
    callRef.current(client).then((r) => {
      reportSource(r.source);
      if (alive && r.source === 'api') setLive({ key, data: r.data });
    });
    return () => { alive = false; };
  }, [client, key, prefs.dataMode, reportSource]);
  if (live && live.key === key && prefs.dataMode !== 'mock') return { data: live.data, source: 'api' };
  return { data: fallback, source: 'mock' };
}
