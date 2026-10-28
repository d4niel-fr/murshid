import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api, isMock, type Guardian, type Student, type StudentInput } from '../api';
import { demoUser, signInWith, type AuthUser, type Provider } from '../auth';
import { checkAge } from '../lib/age';

export type Route = '/welcome' | '/sign-in' | '/onboarding' | '/consent' | '/home';

interface SessionState {
  dob: string | null;
  age: number | null;
  needsGuardian: boolean;
  user: AuthUser | null;
  student: Student | null;
  guardian: Guardian | null;
  consentDeferred: boolean;
  booting: boolean;
}

interface Session extends SessionState {
  /** Guardian consent granted, or not needed (18+). Gate for connectors and outbound notifications. */
  canShare: boolean;
  nextRoute: Route;
  setDob: (dob: string) => void;
  signIn: (p: Provider) => Promise<boolean>;
  signInDemo: () => Promise<void>;
  completeOnboarding: (input: StudentInput) => Promise<void>;
  refreshGuardian: () => Promise<void>;
  setGuardian: (g: Guardian) => void;
  deferConsent: () => void;
  signOut: () => void;
}

const Ctx = createContext<Session | null>(null);

const initial: SessionState = {
  dob: null,
  age: null,
  needsGuardian: false,
  user: null,
  student: null,
  guardian: null,
  consentDeferred: false,
  booting: false,
};

// Session lives in memory for this phase (no persistence dep). TODO: persist via expo-secure-store once auth is real.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<SessionState>(initial);

  const setDob = useCallback((dob: string) => {
    const r = checkAge(dob);
    if (!r.ok) return;
    setS((p) => ({ ...p, dob, age: r.age, needsGuardian: r.needsGuardian }));
  }, []);

  const loadProfile = useCallback(async (user: AuthUser) => {
    api.setAccessToken(user.accessToken);
    const [student, guardian] = await Promise.all([api.getMe(), api.getGuardian()]);
    setS((p) => {
      const dob = student?.date_of_birth ?? p.dob;
      const r = dob ? checkAge(dob) : null;
      return {
        ...p,
        user,
        student,
        guardian,
        dob,
        age: r && r.ok ? r.age : p.age,
        needsGuardian: r && r.ok ? r.needsGuardian : p.needsGuardian,
        booting: false,
      };
    });
  }, []);

  const signIn = useCallback(
    async (provider: Provider) => {
      setS((p) => ({ ...p, booting: true }));
      const user = await signInWith(provider).catch(() => null);
      if (!user) {
        setS((p) => ({ ...p, booting: false }));
        return false;
      }
      await loadProfile(user);
      return true;
    },
    [loadProfile],
  );

  const signInDemo = useCallback(async () => {
    if (isMock(api)) api.useDemoStudent();
    await loadProfile(demoUser());
    setS((p) => ({ ...p, consentDeferred: true }));
  }, [loadProfile]);

  const completeOnboarding = useCallback(async (input: StudentInput) => {
    const student = await api.saveStudent(input);
    setS((p) => ({ ...p, student }));
  }, []);

  const refreshGuardian = useCallback(async () => {
    const guardian = await api.getGuardian();
    setS((p) => ({ ...p, guardian }));
  }, []);

  const value = useMemo<Session>(() => {
    const canShare = !s.needsGuardian || s.guardian?.consent_status === 'granted';
    let nextRoute: Route = '/home';
    if (!s.user && !s.dob) nextRoute = '/welcome';
    else if (!s.user) nextRoute = '/sign-in';
    else if (!s.student) nextRoute = '/onboarding';
    else if (!canShare && !s.consentDeferred) nextRoute = '/consent';
    return {
      ...s,
      canShare,
      nextRoute,
      setDob,
      signIn,
      signInDemo,
      completeOnboarding,
      refreshGuardian,
      setGuardian: (guardian) => setS((p) => ({ ...p, guardian })),
      deferConsent: () => setS((p) => ({ ...p, consentDeferred: true })),
      signOut: () => {
        api.setAccessToken(null);
        setS(initial);
      },
    };
  }, [s, setDob, signIn, signInDemo, completeOnboarding, refreshGuardian]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used inside SessionProvider');
  return c;
}
