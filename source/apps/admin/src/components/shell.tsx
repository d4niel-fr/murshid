'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Building2, ClipboardList, GraduationCap, KeyRound, LogIn, LogOut, Megaphone, ScrollText, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { API_BASE, api, checkAdminPasscode, getAdminPasscode, getSession, setAdminPasscode, setSession, type StaffSession } from '@/lib/api';
import { cn } from './ui';

const NAV: { section: string; items: { href: string; label: string; icon: typeof Users }[] }[] = [
  { section: 'Teaching', items: [{ href: '/teacher', label: 'My classes', icon: ClipboardList }] },
  { section: 'School', items: [
    { href: '/', label: 'Students', icon: Users },
    { href: '/school', label: 'School & licence', icon: Building2 },
    { href: '/opportunities', label: 'Opportunities', icon: Megaphone },
    { href: '/audit', label: 'Audit log', icon: ScrollText },
  ] },
  { section: 'Validation', items: [{ href: '/survey', label: 'Survey results', icon: BarChart3 }] },
];

export function useSession(): StaffSession | null {
  const [s, setS] = useState<StaffSession | null>(null);
  useEffect(() => {
    const sync = () => setS(getSession());
    sync();
    window.addEventListener('murshid-session', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('murshid-session', sync); window.removeEventListener('storage', sync); };
  }, []);
  return s;
}

/** The four-square Microsoft mark used on "Sign in with Microsoft" buttons. */
export function MicrosoftMark({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" className={className} aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

/** 'ok' when admin data is readable (passcode saved, or the API needs none); 'locked' when the passcode is required. */
export function useAdminAccess(): 'checking' | 'ok' | 'locked' {
  const [state, setState] = useState<'checking' | 'ok' | 'locked'>('checking');
  useEffect(() => {
    let on = true;
    const sync = async () => {
      const saved = getAdminPasscode();
      const ok = await checkAdminPasscode(saved ?? '');
      if (!on) return;
      if (!ok && saved) setAdminPasscode(null);
      setState(ok ? 'ok' : 'locked');
    };
    void sync();
    window.addEventListener('murshid-passcode', sync);
    return () => { on = false; window.removeEventListener('murshid-passcode', sync); };
  }, []);
  return state;
}

/** Shown instead of admin pages on the public demo until the admin passcode is entered. */
export function PasscodeGate({ compact = false }: { compact?: boolean }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    const ok = await checkAdminPasscode(code.trim());
    setBusy(false);
    if (ok) setAdminPasscode(code.trim()); else setErr('That passcode is not right.');
  };
  return (
    <div className={cn(compact ? 'w-full' : 'card mx-auto mt-16 w-full max-w-[420px] p-6')} data-testid="passcode-gate">
      <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-[var(--accent)]" />Admin passcode</div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">School admin data and survey results are protected on this public demo. Enter the admin passcode to continue. Teachers can use the teacher demo without it.</p>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passcode" aria-label="Admin passcode"
          className="h-10 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm" />
        <button disabled={busy || !code.trim()} className="h-10 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-60">Unlock</button>
      </form>
      {err && <p className="mt-2 text-xs text-[var(--danger,#b42318)]">{err}</p>}
      {!compact && <p className="mt-4 text-xs text-[var(--text-muted)]">Teacher? <Link href="/login?demo=teacher" className="font-medium text-[var(--accent)]">Open the teacher demo</Link></p>}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const session = useSession();
  const access = useAdminAccess();
  if (path.startsWith('/login')) return <>{children}</>;
  const adminPage = !path.startsWith('/teacher');
  return (
    <div className="grid min-h-dvh grid-cols-[232px_1fr]">
      <aside className="sticky top-0 flex h-dvh flex-col border-r border-[var(--border)] bg-[var(--surface)] px-3 py-4">
        <Link href="/" className="mb-5 flex items-center gap-2 px-2">
          <span className="grid size-8 place-items-center rounded-[10px] bg-[var(--accent)] text-[var(--accent-fg)]"><GraduationCap className="size-4" /></span>
          <span className="leading-tight"><span className="block text-sm font-semibold">Murshid</span><span className="block text-[11px] text-[var(--text-muted)]">for Schools</span></span>
        </Link>
        <nav className="flex flex-col gap-4">
          {NAV.map((g) => (
            <div key={g.section} className="flex flex-col gap-0.5">
              <div className="eyebrow px-2.5 pb-1">{g.section}</div>
              {g.items.map(({ href, label, icon: Icon }) => {
                const active = href === '/' ? path === '/' || path.startsWith('/students') : path.startsWith(href);
                return (
                  <Link key={href} href={href} className={cn('flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm',
                    active ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]')}>
                    <Icon className="size-4" />{label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          {session ? (
            <div className="rounded-[var(--radius)] border border-[var(--border)] p-2.5">
              <div className="flex items-start gap-2">
                <MicrosoftMark className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0"><span className="block truncate text-xs font-medium">{session.name}</span><span className="block text-[11px] leading-snug text-[var(--text-muted)]">{session.orgName}</span></span>
              </div>
              <button onClick={() => { setSession(null); setAdminPasscode(null); window.location.href = '/login'; }} className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"><LogOut className="size-3" />Sign out</button>
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] px-2.5 py-2 text-xs font-medium hover:bg-[var(--surface-2)]"><LogIn className="size-3.5" />Staff sign-in</Link>
          )}
          {access === 'ok' && <AiStatus />}
          <div className="space-y-1 px-2 text-[11px] text-[var(--text-muted)]">
            <div>All students are synthetic demo data.</div>
            <div className="truncate">API: {API_BASE}</div>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-8 py-6">{adminPage && access !== 'ok' ? (access === 'locked' ? <PasscodeGate /> : null) : children}</main>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-[var(--text-muted)]">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** AI engine indicator: live models, rules (daily model budget used), or rules only. Polls /admin/ai-status. */
export function AiStatus({ detailed = false }: { detailed?: boolean }) {
  const [s, setS] = useState<any>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let on = true;
    const load = () => api('/admin/ai-status').then((x) => { if (on) { setS(x); setErr(false); } }).catch(() => on && setErr(true));
    void load();
    const t = setInterval(load, 30_000);
    return () => { on = false; clearInterval(t); };
  }, []);
  const g = s?.guard;
  const tone = err ? 'danger' : !s ? 'neutral' : s.mode === 'live' ? 'success' : s.mode === 'rules_only' ? 'neutral' : 'warning';
  const label = err ? 'API unreachable' : !s ? 'Checking AI…' : s.mode === 'live' ? 'AI models live' : s.mode === 'rules_budget' ? 'Rules (daily AI budget used)' : s.mode === 'degraded' ? 'AI degraded: rules fallback' : 'Rules engine only';
  const dot = { success: 'bg-[var(--success)]', warning: 'bg-[var(--warning)]', danger: 'bg-[var(--danger)]', neutral: 'bg-[var(--text-muted)]' }[tone];
  return (
    <div className={cn('rounded-[var(--radius)] border border-[var(--border)] p-2.5 text-[11px]', detailed && 'p-4 text-sm')} data-testid="ai-status">
      <div className="flex items-center gap-2 font-medium"><span className={cn('size-2 rounded-full', dot)} />{label}</div>
      {g && <div className="mt-1 text-[var(--text-muted)]">{g.used}/{g.dailyLimit} model requests today &middot; {g.cache.hitsToday} replayed &middot; {g.fallbacksToday} rule fallbacks</div>}
      {detailed && s && (
        <div className="mt-2 space-y-1 text-[var(--text-muted)]">
          {s.models?.length > 0 && <div>Models: {s.models.join(' > ')}</div>}
          {g && <div>Demo replay cache: {g.cache.entries} saved answers{g.lastError ? ` · last error ${new Date(g.lastError.at).toLocaleTimeString()}: ${g.lastError.message}` : ''}</div>}
          <div>{s.note}</div>
        </div>
      )}
    </div>
  );
}
