'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MicrosoftMark, MurshidStar, PasscodeGate, useAdminAccess } from '@/components/shell';
import { ErrorBox } from '@/components/ui';
import { Star3D } from '@/components/star-3d';
import { api, setSession } from '@/lib/api';
import { authEnabled } from '@/lib/auth';
import { LiveSignIn } from '@/components/live-sign-in';

const ORG = 'demo-school';

interface MsAccount { id: string; name: string; email: string; role: 'teacher' | 'student' | 'school_admin'; code: string }

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'start' | 'pick' | 'passcode'>('start');
  const [pendingAdmin, setPendingAdmin] = useState<MsAccount | null>(null);
  const access = useAdminAccess();
  const [accounts, setAccounts] = useState<MsAccount[] | null>(null);
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const startMicrosoft = async () => {
    setError(null); setBusy('start');
    try {
      await api(`/auth/microsoft/authorize?org=${ORG}&role=teacher`, { as: 'public' });
      const r = await api<{ org: { domain: string }; items: MsAccount[] }>(`/auth/microsoft/accounts?org=${ORG}`, { as: 'public' });
      setAccounts(r.items.filter((a) => a.role !== 'student'));
      setDomain(r.org?.domain ?? '');
      setStep('pick');
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };

  const pick = async (a: MsAccount) => {
    // School admin data is protected by the admin passcode on the public demo.
    if (a.role === 'school_admin' && access !== 'ok') { setPendingAdmin(a); setStep('passcode'); return; }
    setError(null); setBusy(a.id);
    try {
      const r = await api<{ user: MsAccount; org: { id: string; name: string }; session: { role: 'teacher' | 'school_admin'; headers: Record<string, string> } }>('/auth/microsoft/callback', { method: 'POST', body: { code: a.code }, as: 'public' });
      setSession({ role: r.session.role, name: r.user.name, email: r.user.email, orgId: r.org.id, orgName: r.org.name, headers: r.session.headers });
      router.push(r.session.role === 'teacher' ? '/teacher' : '/school');
    } catch (e) { setError((e as Error).message); setBusy(null); }
  };

  // One-click demo logins from the judges page: /login?demo=teacher (Ms. Sana Thomas) or /login?demo=admin.
  const [demo, setDemo] = useState<string | null>(null);
  useEffect(() => { setDemo(new URLSearchParams(window.location.search).get('demo')); }, []);
  useEffect(() => {
    if (authEnabled || !demo || access === 'checking') return;
    let on = true;
    (async () => {
      try {
        const r = await api<{ org: { domain: string }; items: MsAccount[] }>(`/auth/microsoft/accounts?org=${ORG}`, { as: 'public' });
        if (!on) return;
        const a = demo === 'admin' ? r.items.find((x) => x.role === 'school_admin') : r.items.find((x) => x.role === 'teacher' && /Sana Thomas/.test(x.name)) ?? r.items.find((x) => x.role === 'teacher');
        if (a) { setDemo(null); await pick(a); }
      } catch (e) { setError((e as Error).message); }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, access]);
  useEffect(() => { if (step === 'passcode' && access === 'ok' && pendingAdmin) { const a = pendingAdmin; setPendingAdmin(null); void pick(a); } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [access, step, pendingAdmin]);

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-3 bg-[var(--bg)] p-3 lg:grid-cols-[1.08fr_1fr]">
      <section className="on-deep relative isolate hidden flex-col overflow-hidden rounded-[var(--radius-band)] p-10 lg:flex xl:p-12">
        {/* the school week as five columns, as on the planner */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 grid grid-cols-5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d, i) => (
            <div key={d} className={i ? 'border-l border-white/[0.07]' : ''}>
              <span className="mt-[7.5rem] block px-5 text-[10.5px] font-medium uppercase tracking-[0.24em] text-white/[0.18]">{d}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[28%] bg-white text-[var(--deep)]"><MurshidStar className="size-6" strokeWidth={1.9} /></span>
          <span className="text-[14px] font-medium uppercase tracking-[0.24em]">Murshid <span className="text-white/55">for Schools</span></span>
        </div>
        {/* the mark, as an object */}
        <Star3D className="pointer-events-none absolute end-[6%] top-[11%] -z-10 aspect-square w-[38%] max-w-[21rem]" />
        <div className="mt-auto">
          <span className="eyebrow">Teacher &amp; school portal</span>
          <h1 className="mt-6 text-[clamp(3rem,5.4vw,5.25rem)] font-medium uppercase leading-[0.9] tracking-[-0.02em]">
            <span className="rise block">Every student.</span>
            <span className="rise block" style={{ animationDelay: '110ms' }}>The full</span>
            <span className="rise block" style={{ animationDelay: '220ms' }}>picture.</span>
          </h1>
          <p className="mt-7 max-w-md text-[15px] leading-relaxed text-white/70">Post work once and it lands in every student&rsquo;s plan. See who is on track, who needs support, and the best day to set homework.</p>
          <div className="mt-10 flex items-end justify-between gap-6 border-t border-white/15 pt-6 text-[13px]">
            {authEnabled ? <div><div className="font-medium">Murshid for Schools</div><div className="mt-0.5 text-white/60">UAE &middot; data kept per school</div></div>
              : <div><div className="font-medium">Demo Secondary School, Dubai</div><div className="mt-0.5 text-white/60">Fictional school &middot; proposed Grade 11 pilot (demo)</div></div>}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2" aria-hidden>{['#5790e6', '#c2e029', '#0b6e97', '#ffffff'].map((c) => <span key={c} className="size-6 rounded-full border border-[rgb(15_47_99/0.5)]" style={{ background: c }} />)}</div>
              <span className="text-white/60">30 students</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          {authEnabled ? <LiveSignIn /> : step === 'passcode' ? (
            <>
              <button onClick={() => { setStep('start'); setPendingAdmin(null); }} className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] hover:text-[var(--text)]"><ArrowLeft className="size-3.5" />Back</button>
              <PasscodeGate compact />
            </>
          ) : step === 'start' ? (
            <>
              <span className="mb-8 grid size-12 place-items-center rounded-[28%] bg-[var(--deep)] text-white lg:hidden"><MurshidStar className="size-7" strokeWidth={1.9} /></span>
              <div className="eyebrow">Staff sign-in</div>
              <h2 className="display mt-5 text-[3rem] leading-[0.98]">Sign in to your school</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">Use your school Microsoft 365 account. Murshid only sees your own school&rsquo;s classes.</p>
              <div className="mt-4"><ErrorBox error={error} /></div>
              <button onClick={startMicrosoft} disabled={busy !== null}
                className="group mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-white text-[15px] font-medium text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:opacity-60">
                <MicrosoftMark className="size-5" />Continue with Microsoft 365
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="nudge size-4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
              <p className="mt-3 text-center text-xs text-[var(--text-muted)]">Demo: the Microsoft sign-in is simulated</p>
              <div className="mt-10 flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--surface)] p-5 text-[13px] leading-relaxed text-[var(--text-muted)]">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                <span><span className="font-medium text-[var(--text)]">Demo Secondary School</span> (fictional). School accounts are kept separate from family accounts, and every change is audit-logged.</span>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setStep('start')} className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)] hover:text-[var(--text)]"><ArrowLeft className="size-3.5" />Back</button>
              <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-muted)]"><MicrosoftMark className="size-4" />Microsoft</div>
              <h2 className="display mt-4 text-[2.5rem]">Pick an account</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">to continue to Murshid for Schools &middot; {domain}</p>
              <div className="mt-3"><ErrorBox error={error} /></div>
              <ul className="mt-6 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface)]">
                {(accounts ?? []).map((a, i) => (
                  <li key={a.id} className={i ? 'border-t border-[var(--border)]' : ''}>
                    <button onClick={() => pick(a)} disabled={busy !== null} className="group flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-white disabled:opacity-60">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--deep)] text-xs font-medium text-white">{a.name.replace(/^(Ms|Mr|Dr)\.\s*/, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{a.name} <span className="font-normal text-[var(--text-muted)]">&middot; {a.role === 'teacher' ? 'Teacher' : 'School admin'}</span></span><span className="block break-all text-xs text-[var(--text-muted)]">{a.email}</span></span>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors group-hover:border-[var(--text)] group-hover:text-[var(--text)]"><ChevronRight className="size-4" /></span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[var(--text-muted)]">Simulated Microsoft Entra ID sign-in for the demo.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
