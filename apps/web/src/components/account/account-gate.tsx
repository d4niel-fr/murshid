'use client';

import { useRouter } from 'next/navigation';
import { GraduationCap, HeartHandshake, Loader2, LogOut } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MyMascot } from '@/components/mascot/my-mascot';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { getAccount, setupAccount } from '@/lib/account-api';
import { authEnabled, getSession, onAuthChange, signOut } from '@/lib/auth';
import { bandForGrade } from '@/lib/bands';
import { ApiError } from '@/lib/http';
import { cn } from '@/lib/utils';
import { EMPTY_USER, type UserState } from '@/lib/merge';
import { libraryStore } from '@/lib/library';
import { notebookStore } from '@/lib/notebook';
import { studyStore } from '@/lib/study';
import { registerDoc, startSync } from '@/lib/sync';
import { practiceStore } from '@/lib/practice';
import { boardStore } from '@/lib/whiteboard';

/**
 * Live product only (sign-in on): signed-out visitors go to /sign-in, a first sign-in chooses student or parent,
 * then the app opens on the person's own data. In the demo build this renders the app as before.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  const { setAccount, account, setPrefs, prefs, user, update } = useApp();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'setup' | 'ready' | 'error'>(authEnabled ? 'loading' : 'ready');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const session = await getSession();
    if (!session) { router.replace(`/sign-in?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`); return; }
    try {
      const a = await getAccount();
      setAccount(a);
      setState(a.needsSetup ? 'setup' : 'ready');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { await signOut(); router.replace('/sign-in'); return; }
      setError((e as Error).message); setState('error');
    }
  };
  useEffect(() => {
    if (!authEnabled) return;
    void load();
    return onAuthChange((s) => { if (!s) { setAccount(null); router.replace('/sign-in'); } });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the app's own data follows the account across devices (see lib/sync.ts)
  const userRef = useRef(user); userRef.current = user;
  const userSubs = useRef(new Set<() => void>());
  useEffect(() => { for (const f of userSubs.current) f(); }, [user]);
  useEffect(() => {
    if (!authEnabled) return;
    const offs = [
      registerDoc({ name: 'user', get: () => userRef.current, set: (v) => update(() => ({ ...EMPTY_USER, ...(v as UserState) })), subscribe: (fn) => { userSubs.current.add(fn); return () => { userSubs.current.delete(fn); }; } }),
      registerDoc({ name: 'study', get: studyStore.get, set: (v) => studyStore.set(v as ReturnType<typeof studyStore.get>), subscribe: studyStore.subscribe }),
      registerDoc({ name: 'notebooks', get: notebookStore.get, set: (v) => notebookStore.set(v as ReturnType<typeof notebookStore.get>), subscribe: notebookStore.subscribe }),
      registerDoc({ name: 'boards', get: boardStore.get, set: (v) => boardStore.set(v as ReturnType<typeof boardStore.get>), subscribe: boardStore.subscribe }),
      registerDoc({ name: 'practice', get: practiceStore.get, set: (v) => practiceStore.set(v as ReturnType<typeof practiceStore.get>), subscribe: practiceStore.subscribe }),
      registerDoc({ name: 'library', get: libraryStore.get, set: (v) => libraryStore.set(v as ReturnType<typeof libraryStore.get>), subscribe: libraryStore.subscribe }),
    ];
    return () => { for (const off of offs) off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const owner = state === 'ready' && account?.me.role === 'student' ? account.me.authUserId : null;
  useEffect(() => (owner ? startSync(owner) : undefined), [owner]);

  // a student's grade picks the age band (wording, which widgets show)
  useEffect(() => {
    const grade = account?.student?.grade;
    if (grade && bandForGrade(grade) !== prefs.band) setPrefs({ band: bandForGrade(grade) });
  }, [account?.student?.grade]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state === 'ready') return <>{children}</>;
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      {state === 'loading' && <div className="flex flex-col items-center gap-4 text-muted-foreground"><span className="text-[var(--deep)]"><MyMascot size={88} mood="thinking" /></span><Loader2 className="size-5 animate-spin" aria-label="Loading" /></div>}
      {state === 'error' && <ErrorCard message={error} onRetry={() => { setState('loading'); void load(); }} />}
      {state === 'setup' && <SetupCard onDone={(a) => { setAccount(a); setState('ready'); }} />}
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  const { tx } = useApp();
  return (
    <div className="card flex w-full max-w-md flex-col items-start gap-3 p-7">
      <h1 className="text-xl font-medium">{tx('Murshid could not load your account', 'تعذّر تحميل حسابك في مرشد')}</h1>
      <p className="text-sm text-muted-foreground">{message ?? tx('Check your connection and try again.', 'تحقق من اتصالك وحاول مرة أخرى.')}</p>
      <div className="flex gap-2"><Button onClick={onRetry}>{tx('Try again', 'حاول مرة أخرى')}</Button><Button variant="ghost" onClick={() => void signOut()}><LogOut />{tx('Sign out', 'تسجيل الخروج')}</Button></div>
    </div>
  );
}

function SetupCard({ onDone }: { onDone: (a: Awaited<ReturnType<typeof getAccount>>) => void }) {
  const { tx, account } = useApp();
  const [role, setRole] = useState<'student' | 'parent' | null>(null);
  const [name, setName] = useState(account?.me.name ?? '');
  const [grade, setGrade] = useState('10');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!role || !name.trim()) return;
    setBusy(true); setError(null);
    try {
      onDone(await setupAccount(role === 'student'
        ? { role, name: name.trim(), grade: Number(grade), ...(code.trim() ? { joinCode: code.trim() } : {}) }
        : { role, name: name.trim(), ...(code.trim() ? { childCode: code.trim() } : {}) }));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const choice = (id: 'student' | 'parent', Icon: typeof GraduationCap, title: string, sub: string) => (
    <button type="button" onClick={() => setRole(id)} aria-pressed={role === id}
      className={cn('flex flex-1 flex-col items-start gap-2 rounded-[22px] border p-5 text-start transition-colors', role === id ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-border hover:border-foreground/40')}>
      <Icon className="size-6" strokeWidth={1.6} /><span className="text-[1.0625rem] font-medium">{title}</span><span className={cn('text-sm', role === id ? 'text-white/70' : 'text-muted-foreground')}>{sub}</span>
    </button>
  );
  return (
    <form onSubmit={submit} className="card flex w-full max-w-xl flex-col gap-5 p-6 sm:p-8">
      <div className="flex items-center gap-3"><span className="text-[var(--deep)]"><MyMascot size={56} mood="happy" /></span><div><h1 className="display text-[1.75rem] leading-tight">{tx('Welcome to Murshid', 'أهلاً بك في مرشد')}</h1><p className="text-sm text-muted-foreground">{account?.me.email}</p></div></div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {choice('student', GraduationCap, tx('I’m a student', 'أنا طالب'), tx('Plan your week, study and track your goals.', 'خطط أسبوعك وادرس وتابع أهدافك.'))}
        {choice('parent', HeartHandshake, tx('I’m a parent', 'أنا وليّ أمر'), tx('See how your child is doing each week.', 'تابع كيف يسير طفلك كل أسبوع.'))}
      </div>
      {role && <>
        <div><Label htmlFor="su-name">{tx('Your name', 'اسمك')}</Label><Input id="su-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" /></div>
        {role === 'student' && <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="su-grade">{tx('Grade', 'الصف')}</Label><Select id="su-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>{[5, 6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>{tx(`Grade ${g}`, `الصف ${g}`)}</option>)}</Select></div>
          <div><Label htmlFor="su-code">{tx('School code (optional)', 'رمز المدرسة (اختياري)')}</Label><Input id="su-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC-1234" maxLength={20} autoCapitalize="characters" /></div>
        </div>}
        {role === 'parent' && <div><Label htmlFor="su-child">{tx('Your child’s code (optional)', 'رمز طفلك (اختياري)')}</Label><Input id="su-child" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" maxLength={12} autoCapitalize="characters" />
          <p className="mt-1.5 text-xs text-muted-foreground">{tx('Your child finds it in Murshid under Settings → Account. You can add it later.', 'يجده طفلك في مرشد ضمن الإعدادات ← الحساب. يمكنك إضافته لاحقاً.')}</p></div>}
        {error && <p role="alert" className="rounded-[14px] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => void signOut()} className="text-sm text-muted-foreground hover:text-foreground">{tx('Use another account', 'استخدم حساباً آخر')}</button>
          <Button type="submit" size="lg" disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin" />}{tx('Continue', 'متابعة')}</Button>
        </div>
      </>}
    </form>
  );
}
