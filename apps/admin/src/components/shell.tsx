'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Building2, ClipboardList, KeyRound, LogIn, LogOut, Megaphone, ScrollText, Users } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, checkAdminPasscode, getAdminPasscode, getSession, setAdminPasscode, setSession, type StaffSession } from '@/lib/api';
import { cn, PasswordInput } from './ui';

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

/** Murshid's mark: an eight-point star (two squares, one turned 45°). "Murshid" means guide. */
export function MurshidStar({ className = 'size-5', strokeWidth = 1.8 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" aria-hidden>
      <path d="M12.00 1.80 L13.76 7.75 L19.21 4.79 L16.25 10.24 L22.20 12.00 L16.25 13.76 L19.21 19.21 L13.76 16.25 L12.00 22.20 L10.24 16.25 L4.79 19.21 L7.75 13.76 L1.80 12.00 L7.75 10.24 L4.79 4.79 L10.24 7.75Z" />
    </svg>
  );
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
    <div className={cn(compact ? 'w-full' : 'card mx-auto mt-16 w-full max-w-[440px] p-8')} data-testid="passcode-gate">
      <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-[var(--accent)]" />Admin passcode</div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">School admin data and survey results are protected on this public demo. Enter the admin passcode to continue. Teachers can use the teacher demo without it.</p>
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <PasswordInput autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Passcode" aria-label="Admin passcode" className="flex-1" />
        <button disabled={busy || !code.trim()} className="h-11 rounded-full bg-[var(--text)] px-5 text-sm font-medium text-[var(--bg)] hover:bg-[var(--deep)] disabled:opacity-60">Unlock</button>
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
  const here = NAV.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section }))).find((i) => (i.href === '/' ? path === '/' || path.startsWith('/students') : path.startsWith(i.href)));
  const initials = session?.name.replace(/^(Ms|Mr|Dr)\.\s*/, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '';
  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <aside className="on-deep fixed inset-y-[var(--inset)] start-[var(--inset)] z-40 flex w-[var(--side)] flex-col overflow-y-auto rounded-[var(--radius-band)] px-3 pb-3 pt-5">
        <Link href="/" className="mb-6 flex h-10 items-center gap-2.5 px-2.5">
          <span className="grid size-8 place-items-center rounded-[28%] bg-white text-[var(--deep)]"><MurshidStar className="size-5" strokeWidth={1.9} /></span>
          <span className="leading-tight"><span className="block text-[14px] font-medium uppercase tracking-[0.2em]">Murshid</span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.2em] text-white/60">for Schools</span></span>
        </Link>
        <nav className="flex flex-col gap-6">
          {NAV.map((g) => (
            <div key={g.section} className="flex flex-col gap-1">
              <div className="px-3.5 pb-1 text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/60">{g.section}</div>
              {g.items.map(({ href, label, icon: Icon }) => {
                const active = href === '/' ? path === '/' || path.startsWith('/students') : path.startsWith(href);
                return (
                  <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('group flex h-10 items-center gap-3 rounded-full px-3.5 text-[14px] transition-colors',
                    active ? 'bg-white font-medium text-[var(--deep)]' : 'text-white/70 hover:bg-white/[0.08] hover:text-white')}>
                    <Icon className={cn('size-[18px]', active ? 'text-[var(--deep)]' : 'text-white/60 group-hover:text-white')} strokeWidth={1.7} />{label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-4">
          <p className="mb-3 px-3.5 text-[11.5px] leading-snug text-white/60">All students are synthetic demo data.</p>
          {session ? (
            <div className="flex items-center gap-2.5 border-t border-white/15 px-1 pt-3">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand-light)] text-[11.5px] font-medium text-white">{initials}<span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-white"><MicrosoftMark className="size-2.5" /></span></span>
              <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[13px] font-medium">{session.name}</span><span className="block truncate text-xs text-white/60">{session.orgName}</span></span>
              <button onClick={() => { setSession(null); setAdminPasscode(null); window.location.href = '/login'; }} aria-label="Sign out" title="Sign out" className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white"><LogOut className="size-4" /></button>
            </div>
          ) : (
            <Link href="/login" className="flex h-10 items-center gap-2.5 rounded-full bg-white px-4 text-[13px] font-medium text-[var(--deep)] hover:bg-[var(--brand-light)] hover:text-white"><LogIn className="size-4" />Staff sign-in</Link>
          )}
        </div>
      </aside>
      <div className="min-w-0 ps-[calc(var(--side)+var(--inset))]">
        <header className="sticky top-0 z-30 flex h-[4.25rem] items-center gap-3 bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-8 pt-[var(--inset)] backdrop-blur-xl xl:px-10">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em]">
            <span className="text-[var(--text-muted)]">{here?.section ?? 'Portal'}</span>
            <span className="text-[var(--ghost)]">/</span>
            <span className="truncate">{here?.label ?? ''}</span>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {access === 'ok' && <AiStatus />}
            <span className="hidden h-10 items-center gap-2 rounded-full bg-[var(--surface)] px-4 text-xs font-medium text-[var(--text-muted)] md:inline-flex"><MicrosoftMark className="size-3.5" />Simulated Microsoft 365</span>
          </div>
        </header>
        <main className="min-w-0 px-8 pb-12 pt-6 xl:px-10">{adminPage && access !== 'ok' ? (access === 'locked' ? <PasscodeGate /> : null) : children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-[2.75rem]">{typeof title === 'string' ? <span className="rise">{title}</span> : title}</h1>
        {sub && <p className="mt-3 text-[15px] text-[var(--text-muted)]">{sub}</p>}
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
  if (!detailed) {
    return (
      <span className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--surface)] px-4 text-xs font-medium text-[var(--text-muted)]" data-testid="ai-status"
        title={g ? `${g.used}/${g.dailyLimit} model requests today · ${g.cache.hitsToday} replayed · ${g.fallbacksToday} rule fallbacks` : undefined}>
        <span className={cn('size-2 rounded-full', dot)} />{label}
      </span>
    );
  }
  return (
    <div className="card p-5 text-sm" data-testid="ai-status">
      <div className="flex items-center gap-2 font-medium"><span className={cn('size-2 rounded-full', dot)} />{label}</div>
      {g && <div className="mt-1 text-[var(--text-muted)]">{g.used}/{g.dailyLimit} model requests today &middot; {g.cache.hitsToday} replayed &middot; {g.fallbacksToday} rule fallbacks</div>}
      {s && (
        <div className="mt-2 space-y-1 text-[var(--text-muted)]">
          {s.models?.length > 0 && <div>Models: {s.models.join(' > ')}</div>}
          {g && <div>Demo replay cache: {g.cache.entries} saved answers{g.lastError ? ` · last error ${new Date(g.lastError.at).toLocaleTimeString()}: ${g.lastError.message}` : ''}</div>}
          <div>{s.note}</div>
        </div>
      )}
    </div>
  );
}
