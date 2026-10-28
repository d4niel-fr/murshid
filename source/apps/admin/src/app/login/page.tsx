'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, GraduationCap, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MicrosoftMark, PasscodeGate, useAdminAccess } from '@/components/shell';
import { ErrorBox } from '@/components/ui';
import { api, setSession } from '@/lib/api';

const ORG = 'gems-oow';

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
    if (!demo || access === 'checking') return;
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
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#1f2a37] p-10 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[10px] bg-[var(--accent)] text-white"><GraduationCap className="size-5" /></span>
          <span className="text-base font-semibold">Murshid <span className="font-normal text-white/80">for Schools</span></span>
        </div>
        <div className="max-w-md">
          <h1 className="text-[34px] font-semibold leading-tight tracking-tight">Every student on top of their work. Every teacher with the full picture.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/85">Post work once and it lands in every student&rsquo;s plan. See who is on track, who needs support, and the best day to set homework.</p>
        </div>
        <div className="text-sm text-white/80">
          <div className="font-medium text-white">Our Own High School Al Warqa&rsquo;a</div>
          <div>GEMS Education &middot; proposed Grade 11 pilot (demo)</div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[var(--bg)] p-6">
        <div className="card w-full max-w-[440px] p-7">
          {step === 'passcode' ? (
            <>
              <button onClick={() => { setStep('start'); setPendingAdmin(null); }} className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"><ArrowLeft className="size-3.5" />Back</button>
              <PasscodeGate compact />
            </>
          ) : step === 'start' ? (
            <>
              <div className="eyebrow">Staff sign-in</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Sign in to your school</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Use your school Microsoft 365 account. Murshid only sees your own school&rsquo;s classes.</p>
              <ErrorBox error={error} />
              <button onClick={startMicrosoft} disabled={busy !== null}
                className="mt-6 flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-sm)] border border-[#8c8c8c] bg-white text-[15px] font-semibold text-[#3a3a3a] transition-colors hover:bg-[#f3f3f3] disabled:opacity-60">
                <MicrosoftMark className="size-5" />Demo: simulated Microsoft 365 sign-in
              </button>
              <div className="mt-6 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-3 text-xs text-[var(--text-muted)]">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
                <span>School tenant: Our Own High School Al Warqa&rsquo;a (GEMS Education). School accounts are kept separate from family accounts.</span>
              </div>
              <p className="mt-4 text-[11px] text-[var(--text-muted)]">Demo: Microsoft Entra ID sign-in is simulated; no real Microsoft account is used.</p>
            </>
          ) : (
            <>
              <button onClick={() => setStep('start')} className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"><ArrowLeft className="size-3.5" />Back</button>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#3a3a3a]"><MicrosoftMark className="size-5" />Microsoft</div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">Pick an account</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">to continue to Murshid for Schools &middot; {domain}</p>
              <ErrorBox error={error} />
              <ul className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)]">
                {(accounts ?? []).map((a) => (
                  <li key={a.id}>
                    <button onClick={() => pick(a)} disabled={busy !== null} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--surface-2)] disabled:opacity-60">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">{a.name.replace(/^(Ms|Mr|Dr)\.\s*/, '').split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{a.name} <span className="font-normal text-[var(--text-muted)]">&middot; {a.role === 'teacher' ? 'Teacher' : 'School admin'}</span></span><span className="block break-all text-xs text-[var(--text-muted)]">{a.email}</span></span>
                      <ChevronRight className="size-4 shrink-0 text-[var(--text-muted)]" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[11px] text-[var(--text-muted)]">Simulated Microsoft Entra ID sign-in for the demo.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
