'use client';

import { useRouter } from 'next/navigation';
import { Loader2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MicrosoftMark } from '@/components/shell';
import { ErrorBox } from '@/components/ui';
import { api, setSession } from '@/lib/api';
import { emailLink, getSession, signOut, withProvider } from '@/lib/auth';

interface Account { me: { name: string | null; email: string | null; role: string | null; orgId: string | null }; licence: { orgName: string } | null; needsSetup: boolean }

/** Live product: staff sign in with Microsoft 365, Google or an emailed link, then go to their part of the portal. */
export function LiveSignIn() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'out' | 'not_staff' | 'not_invited'>('checking');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = await getSession();
      if (!s) { setState('out'); return; }
      try {
        const a = await api<Account>('/account', { as: 'staff' });
        const base = { name: a.me.name ?? a.me.email ?? '', email: a.me.email ?? '', orgId: a.me.orgId ?? '', orgName: a.licence?.orgName ?? 'Murshid', headers: {} };
        if (a.me.role === 'teacher') { setSession({ ...base, role: 'teacher' }); router.replace('/teacher'); }
        else if (a.me.role === 'school_admin') { setSession({ ...base, role: 'school_admin' }); router.replace('/school'); }
        else if (a.me.role === 'platform_admin') { setSession({ ...base, role: 'school_admin', orgName: 'Murshid' }); router.replace('/schools'); }
        else setState(a.needsSetup ? 'not_invited' : 'not_staff');
      } catch (e) { setError((e as Error).message); setState('out'); }
    })();
  }, [router]);

  const go = async (key: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(key); setError(null);
    try { const r = await fn(); if (r.error) setError(r.error.message); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  if (state === 'checking') return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-[var(--text-muted)]" aria-label="Checking your sign-in" /></div>;
  if (state === 'not_staff' || state === 'not_invited') return (
    <div>
      <div className="eyebrow">Staff sign-in</div>
      <h2 className="display mt-5 text-[2.5rem] leading-[0.98]">{state === 'not_staff' ? 'This portal is for school staff' : 'Your school hasn’t added you yet'}</h2>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">{state === 'not_staff' ? 'Students and parents use the Murshid app.' : 'Ask your school’s Murshid admin to invite this email as a teacher, then sign in again.'}</p>
      <div className="mt-8 flex flex-wrap gap-2">
        {state === 'not_staff' && <a href="/app" className="inline-flex h-11 items-center rounded-full bg-[var(--deep)] px-5 text-sm font-medium text-white">Open the Murshid app</a>}
        <button onClick={() => void signOut().then(() => { setSession(null); setState('out'); })} className="inline-flex h-11 items-center rounded-full border border-[var(--border)] px-5 text-sm font-medium">Use another account</button>
      </div>
    </div>
  );
  return (
    <div>
      <div className="eyebrow">Staff sign-in</div>
      <h2 className="display mt-5 text-[3rem] leading-[0.98]">Sign in to your school</h2>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">Use the account your school gave you. Murshid only shows your own school&rsquo;s classes.</p>
      <div className="mt-4"><ErrorBox error={error} /></div>
      <button onClick={() => void go('ms', () => withProvider('azure'))} disabled={busy !== null} className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-white text-[15px] font-medium text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:opacity-60">
        {busy === 'ms' ? <Loader2 className="size-5 animate-spin" /> : <MicrosoftMark className="size-5" />}Continue with Microsoft 365
      </button>
      <button onClick={() => void go('google', () => withProvider('google'))} disabled={busy !== null} className="mt-3 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-white text-[14px] font-medium text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:opacity-60">
        {busy === 'google' && <Loader2 className="size-4 animate-spin" />}Continue with Google (Workspace)
      </button>
      {sent ? <p className="mt-6 rounded-[var(--radius)] bg-[var(--surface)] p-4 text-sm">Check {email}: the sign-in link works once and expires in an hour.</p> : (
        <form onSubmit={(e) => { e.preventDefault(); void go('email', async () => { const r = await emailLink(email.trim()); if (!r.error) setSent(true); return r; }); }} className="mt-6 flex gap-2">
          <label className="sr-only" htmlFor="staff-email">School email</label>
          <input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.ae" autoComplete="email" dir="ltr" className="h-12 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-white px-5 text-[15px] outline-none focus:border-[var(--brand-light)]" />
          <button type="submit" disabled={busy !== null} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-[var(--deep)] px-5 text-sm font-medium text-white disabled:opacity-60">{busy === 'email' ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}Email me a link</button>
        </form>
      )}
    </div>
  );
}
