'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BarChart3, Building2, ClipboardList, GraduationCap, KeyRound, LogIn, LogOut, Megaphone, Menu, ScrollText, Users, WifiOff, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { adminAccess, api, API_BASE, checkAdminPasscode, getAdminPasscode, getSession, setAdminPasscode, setSession, type StaffSession } from '@/lib/api';
import { cn, PasswordInput } from './ui';

type NavGroup = { section: string; items: { href: string; label: string; icon: typeof Users }[] };
/** Teachers see their own classes and students; the school sections are for school admins only. */
const TEACHER_NAV: NavGroup[] = [
  { section: 'Teaching', items: [{ href: '/teacher', label: 'My classes', icon: ClipboardList }, { href: '/teacher/students', label: 'My students', icon: GraduationCap }] },
];
const ADMIN_NAV: NavGroup[] = [
  { section: 'Teaching', items: [{ href: '/teacher', label: 'All classes', icon: ClipboardList }, { href: '/teacher/students', label: 'Student progress', icon: GraduationCap }] },
  { section: 'School', items: [
    { href: '/', label: 'Students', icon: Users },
    { href: '/school', label: 'School & licence', icon: Building2 },
    { href: '/opportunities', label: 'Opportunities', icon: Megaphone },
    { href: '/audit', label: 'Audit log', icon: ScrollText },
  ] },
  { section: 'Validation', items: [{ href: '/survey', label: 'Survey results', icon: BarChart3 }] },
];
const isActive = (href: string, path: string) =>
  href === '/' ? path === '/' || path.startsWith('/students') : href === '/teacher' ? path === '/teacher' : path.startsWith(href);

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

/** 'ok' when admin data is readable (passcode saved, or the API needs none); 'locked' when the passcode is required; 'offline' when the API can't be reached. */
export function useAdminAccess(enabled = true): 'checking' | 'ok' | 'locked' | 'offline' {
  const [state, setState] = useState<'checking' | 'ok' | 'locked' | 'offline'>('checking');
  useEffect(() => {
    if (!enabled) return;
    let on = true;
    const sync = async () => {
      const saved = getAdminPasscode();
      const r = await adminAccess(saved ?? '');
      if (!on) return;
      if (r === 'locked' && saved) setAdminPasscode(null);
      setState(r);
    };
    void sync();
    window.addEventListener('murshid-passcode', sync);
    return () => { on = false; window.removeEventListener('murshid-passcode', sync); };
  }, [enabled]);
  return state;
}

/** The API can't be reached: say so plainly (a passcode would not help). */
export function ApiOffline() {
  return (
    <div className="card mx-auto mt-16 w-full max-w-[460px] p-8" role="alert">
      <div className="flex items-center gap-2 text-sm font-semibold"><WifiOff className="size-4 text-[var(--danger)]" />Can&rsquo;t reach the Murshid API</div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">The portal could not load data from <code className="rounded bg-[var(--surface)] px-1">{API_BASE}</code>. If the demo was just deployed, wait a few seconds and reload. Nothing is wrong with your passcode.</p>
      <button onClick={() => window.location.reload()} className="mt-4 h-10 rounded-full bg-[var(--text)] px-5 text-sm font-medium text-[var(--bg)] hover:bg-[var(--deep)]">Try again</button>
    </div>
  );
}

/** A teacher opened a school-admin page: explain, and point back to their classes (no passcode prompt). */
function AdminOnly() {
  return (
    <div className="card mx-auto mt-16 w-full max-w-[460px] p-8">
      <div className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-[var(--accent)]" />This page is for school admins</div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">You are signed in as a teacher. Your classes, students and assignments are all under My classes and My students.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/teacher" className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--text)] px-5 text-sm font-medium text-[var(--bg)] hover:bg-[var(--deep)]"><ArrowLeft className="size-4" />My classes</Link>
        <Link href="/login?demo=admin" className="inline-flex h-10 items-center rounded-full border border-[var(--border)] px-5 text-sm font-medium hover:border-[var(--text)]">Open the school admin demo</Link>
      </div>
    </div>
  );
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
  const [menu, setMenu] = useState(false);
  const teacher = session?.role === 'teacher';
  const teacherPage = path.startsWith('/teacher');
  // teachers never need the admin passcode: their pages use their own session
  const access = useAdminAccess(!teacher && !teacherPage);
  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => {
    if (!menu) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [menu]);
  if (path.startsWith('/login')) return <>{children}</>;
  const nav = teacher ? TEACHER_NAV : ADMIN_NAV;
  const here = nav.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section }))).find((i) => isActive(i.href, path)) ?? (path.startsWith('/teacher/students/') ? { section: 'Teaching', label: 'Student' } : undefined);
  const initials = session?.name.replace(/^(Ms|Mr|Dr)\.\s*/, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() ?? '';
  const body = teacherPage ? children
    : teacher ? <AdminOnly />
    : access === 'ok' ? children
    : access === 'locked' ? <PasscodeGate />
    : access === 'offline' ? <ApiOffline /> : null;
  const sidebar = (
    <>
      <Link href={teacher ? '/teacher' : '/'} className="mb-6 flex h-10 items-center gap-2.5 px-2.5">
        <span className="grid size-8 place-items-center rounded-[28%] bg-white text-[var(--deep)]"><MurshidStar className="size-5" strokeWidth={1.9} /></span>
        <span className="leading-tight"><span className="block text-[14px] font-medium uppercase tracking-[0.2em]">Murshid</span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.2em] text-white/60">for Schools</span></span>
      </Link>
      <nav className="flex flex-col gap-6" aria-label="Portal">
        {nav.map((g) => (
          <div key={g.section} className="flex flex-col gap-1">
            <div className="px-3.5 pb-1 text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/60">{g.section}</div>
            {g.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href, path);
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('group flex h-11 items-center gap-3 rounded-full px-3.5 text-[14px] transition-colors lg:h-10',
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
            <button onClick={() => { setSession(null); setAdminPasscode(null); window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/login`; }} aria-label="Sign out" title="Sign out" className="grid size-10 shrink-0 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white"><LogOut className="size-4" /></button>
          </div>
        ) : (
          <Link href="/login" className="flex h-11 items-center gap-2.5 rounded-full bg-white px-4 text-[13px] font-medium text-[var(--deep)] hover:bg-[var(--brand-light)] hover:text-white"><LogIn className="size-4" />Staff sign-in</Link>
        )}
      </div>
    </>
  );
  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      {/* desktop: fixed sidebar */}
      <aside className="on-deep fixed inset-y-[var(--inset)] start-[var(--inset)] z-40 hidden w-[var(--side)] flex-col overflow-y-auto rounded-[var(--radius-band)] px-3 pb-3 pt-5 lg:flex">{sidebar}</aside>
      {/* phones and tablets: the same menu slides in */}
      {menu && <div className="fixed inset-0 z-50 bg-[rgb(15_47_99/0.45)] lg:hidden" onClick={() => setMenu(false)} aria-hidden />}
      <aside id="portal-menu" aria-label="Menu" className={cn('on-deep fixed inset-y-2 start-2 z-50 flex w-[min(84vw,18rem)] flex-col overflow-y-auto rounded-[var(--radius-band)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 transition-transform duration-200 ease-[var(--ease-out)] lg:hidden', menu ? 'translate-x-0' : '-translate-x-[110%] rtl:translate-x-[110%]')} inert={!menu}>
        <button onClick={() => setMenu(false)} aria-label="Close menu" className="absolute end-3 top-3 grid size-10 place-items-center rounded-full text-white/70 hover:bg-white/[0.1] hover:text-white"><X className="size-4" /></button>
        {sidebar}
      </aside>
      <div className="min-w-0 lg:ps-[calc(var(--side)+var(--inset))]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-6 lg:h-[4.25rem] lg:px-8 lg:pt-[var(--inset)] xl:px-10">
          <button onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu} aria-controls="portal-menu" className="-ms-1 grid size-10 place-items-center rounded-full bg-[var(--deep)] text-white lg:hidden"><Menu className="size-4" /></button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em]">
            <span className="hidden text-[var(--text-muted)] sm:inline">{here?.section ?? 'Portal'}</span>
            <span className="hidden text-[var(--ghost)] sm:inline">/</span>
            <span className="truncate">{here?.label ?? ''}</span>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {!teacher && access === 'ok' && <AiStatus />}
            <span className="hidden h-10 items-center gap-2 rounded-full bg-[var(--surface)] px-4 text-xs font-medium text-[var(--text-muted)] md:inline-flex"><MicrosoftMark className="size-3.5" />Simulated Microsoft 365</span>
          </div>
        </header>
        <main className="min-w-0 px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pt-6 xl:px-10">{body}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="display text-[2rem] sm:text-[2.75rem]">{typeof title === 'string' ? <span className="rise">{title}</span> : title}</h1>
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
