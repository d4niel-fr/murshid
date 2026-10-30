'use client';

/**
 * The marketing frame, in the Navy system: intro loader, header, full-screen menu, the "pick a seat"
 * sheet, the video sheet, the footer, and the small parts every block shares (eyebrow, pills,
 * arrow buttons, dots, framed shots, the week columns).
 */

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MurshidStar } from '@/components/shell/icons';
import { ADMIN_DEMO_URL, TEACHER_DEMO_URL, openStudent } from '@/lib/demo';
import { EASE, Lines, ReadyContext, Rise, spring } from './motion';
import { SmoothScroll, useScroller } from './scroll';
import './marketing.css';

/* ───────────────────────── shared bits ───────────────────────── */

export function Eyebrow({ children, tone = 'dark', className = '' }: { children: ReactNode; tone?: 'dark' | 'light'; className?: string }) {
  return <span className={`mk-eyebrow ${tone === 'light' ? 'is-light' : ''} ${className}`}>{children}</span>;
}

export function ArrowIcon({ className = 'size-4', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const PILL = {
  light: 'bg-white text-[var(--deep)] hover:bg-[var(--brand-light)] hover:text-white',
  solid: 'bg-[var(--text)] text-white hover:bg-[var(--deep)]',
  outline: 'border border-current text-[var(--text)] hover:bg-[var(--text)] hover:text-white hover:border-[var(--text)]',
  glass: 'border border-white/15 bg-white/10 text-white backdrop-blur hover:bg-white/20',
  accent: 'bg-[var(--brand)] text-white hover:bg-[var(--deep)]',
} as const;

/** The pill button: uppercase, tracked, with a trailing arrow that nudges on hover. */
export function Pill({
  children, href, onClick, variant = 'solid', className = '', testid, external, arrow = true, icon,
}: { children: ReactNode; href?: string; onClick?: () => void; variant?: keyof typeof PILL; className?: string; testid?: string; external?: boolean; arrow?: boolean; icon?: ReactNode }) {
  const cls = `mk-pill inline-flex items-center justify-center gap-[0.6rem] whitespace-nowrap rounded-full px-[1.75rem] py-[0.875rem] text-[0.875rem] font-medium uppercase leading-none tracking-[0.06em] transition-colors duration-200 ${PILL[variant]} ${className}`;
  const inner = <>{icon}{children}{arrow && <ArrowIcon className="mk-nudge size-4" />}</>;
  if (href) return <a href={href} className={cls} data-testid={testid} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls} data-testid={testid}>{inner}</button>;
}
/** Older name, same pill. */
export const Cta = Pill;

/** Round carousel control. The arrow grows a little on hover; `prev` is the same arrow, flipped. */
export function ArrowButton({ dir = 'next', variant = 'outline', onClick, label }: { dir?: 'prev' | 'next'; variant?: 'outline' | 'solid'; onClick: () => void; label: string }) {
  const cls = variant === 'solid'
    ? 'border-[var(--text)] bg-[var(--text)] text-white hover:bg-[var(--deep)] hover:border-[var(--deep)]'
    : 'border-[var(--border)] text-[var(--text)] hover:border-[var(--text)]';
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`group grid size-12 place-items-center rounded-full border transition-colors sm:size-14 ${cls}`}>
      <ArrowIcon flip={dir === 'prev'} className="size-5 transition-transform duration-300 group-hover:scale-[1.15]" />
    </button>
  );
}

export function Dots({ count, active, onPick, tone = 'dark' }: { count: number; active: number; onPick?: (i: number) => void; tone?: 'dark' | 'light' }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" onClick={() => onPick?.(i)} aria-label={`Slide ${i + 1}`} aria-current={i === active || undefined} className="p-1.5">
          <span className={`block h-1.5 rounded-full transition-all duration-500 ${i === active ? `w-5 ${tone === 'light' ? 'bg-white' : 'bg-[var(--text)]'}` : `w-1.5 ${tone === 'light' ? 'bg-white/40' : 'bg-[var(--ghost)]'}`}`} />
        </button>
      ))}
    </div>
  );
}

/** A grey card (or, on navy, a glass one). */
export function Panel({ children, className = '', tone = 'light' }: { children: ReactNode; className?: string; tone?: 'light' | 'glass' }) {
  return <div className={`${tone === 'glass' ? 'mk-glass' : 'rounded-[1.5rem] bg-[var(--surface)]'} relative p-[1.5rem] ${className}`}>{children}</div>;
}

/** A product screenshot in a rounded frame. `focus` picks the crop, `zoom` scales it. */
export function Shot({ src, alt, className = '', focus = 'top', zoom = 1, eager }: { src: string; alt: string; className?: string; focus?: string; zoom?: number; eager?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-[1.5rem] bg-[var(--surface)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} className="absolute inset-0 size-full object-cover" style={{ objectPosition: focus, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: focus }} />
    </div>
  );
}
/** Older name, same frame. */
export const Plate = Shot;

/** The school week as faint columns: the texture of every navy block. */
export function WeekColumns({ days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], labelTop = '7rem', className = '' }: { days?: string[]; labelTop?: string; className?: string }) {
  return (
    <div aria-hidden className={`mk-week ${className}`} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
      {days.map((d, i) => <div key={i}><span style={{ marginTop: labelTop }}>{d}</span></div>)}
    </div>
  );
}

export function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.5rem] ${className}`}>
      <MurshidStar className="size-[1.25rem]" strokeWidth={1.8} />
      <span className="text-[1rem] font-medium uppercase leading-none tracking-[0.2em]">Murshid</span>
    </span>
  );
}

/* ───────────────────────── seats (who the demo is for) ───────────────────────── */

export interface Seat {
  id: 'student' | 'teacher' | 'admin';
  n: string;
  name: string;
  role: string;
  line: string;
  shot: string;
  cta: string;
  testid: string;
  href?: string;
  action?: () => void;
}

export const SEATS: Seat[] = [
  {
    id: 'student', n: '01', name: 'Ahamed Mehta', role: 'Student · Grade 11 · football and swimming',
    line: 'Ask “Plan my week around my mid-term and both sports”, then open “How Murshid worked this out” under the reply.',
    shot: '/shots/m-home.jpg', cta: 'Open as Ahamed', testid: 'demo-student', action: openStudent,
  },
  {
    id: 'teacher', n: '02', name: 'Ms. Sana Thomas', role: 'Teacher · Grade 11 English · 30 students',
    line: 'Open “Best day for homework”, then post an assignment and watch every student’s week replan around it.',
    shot: '/shots/d-bestday.jpg', cta: 'Open as Ms. Thomas', testid: 'demo-teacher', href: TEACHER_DEMO_URL,
  },
  {
    id: 'admin', n: '03', name: 'School admin', role: 'Demo Secondary School',
    line: 'School and licence, the audit log of every change, and the anonymous survey results. Needs the admin passcode from the submission notes.',
    shot: '/shots/d-school.jpg', cta: 'Open as admin', testid: 'demo-admin', href: ADMIN_DEMO_URL,
  },
];

/* ───────────────────────── page context ───────────────────────── */

type Overlay = 'menu' | 'demo' | 'video' | null;
const PageContext = createContext<{ open: (o: Overlay) => void }>({ open: () => {} });
export const usePage = () => useContext(PageContext);

export const NAV = [
  { label: 'Demo', href: '/judges' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Survey', href: '/survey' },
  { label: 'Get Murshid', href: '/welcome' },
];

/* ───────────────────────── header ───────────────────────── */

/** The header that sits inside a navy block: nav on the left, the brand in the middle, the demo on the right. */
export function Masthead({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { open } = usePage();
  const fg = tone === 'light' ? 'text-white' : 'text-[var(--text)]';
  return (
    <header className={`relative z-30 flex items-center px-[1.5rem] pt-[1.5rem] text-[0.75rem] sm:px-[2.5rem] sm:pt-[2rem] ${fg}`}>
      <nav aria-label="Primary" className="hidden flex-1 gap-[2rem] lg:flex">
        {NAV.slice(1, 4).map((n) => <Link key={n.href} href={n.href} className="mk-link uppercase tracking-[0.14em] opacity-90 hover:opacity-100">{n.label}</Link>)}
      </nav>
      <div className="flex flex-1 lg:justify-center">
        <Link href="/judges" aria-label="Murshid home"><Brand /></Link>
      </div>
      <div className="flex flex-1 items-center justify-end gap-[1rem] sm:gap-[1.25rem]">
        <button type="button" onClick={() => open('demo')} className="mk-link hidden uppercase tracking-[0.14em] sm:inline">Open the demo</button>
        <button type="button" onClick={() => open('menu')} aria-label="Open menu"
          className={`grid size-[2.5rem] place-items-center rounded-full backdrop-blur transition-colors ${tone === 'light' ? 'bg-white/15 hover:bg-white/25' : 'bg-[var(--surface)] hover:bg-[var(--border)]'}`}>
          <span className="flex flex-col gap-[5px]"><span className="block h-px w-[1rem] bg-current" /><span className="block h-px w-[1rem] bg-current" /></span>
        </button>
      </div>
    </header>
  );
}

/* ───────────────────────── overlays ───────────────────────── */

/** Move keyboard focus into an overlay when it opens (Escape closes it; see Overlays). */
function useFocusIn<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const id = window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], button, a[href]')?.focus(), 120);
    return () => clearTimeout(id);
  }, []);
  return ref;
}

function CloseButton({ onClick, tone = 'dark' }: { onClick: () => void; tone?: 'dark' | 'light' }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close" data-autofocus
      className={`grid size-[2.5rem] shrink-0 place-items-center rounded-full transition-colors ${tone === 'light' ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)]'}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="mk-turn size-[1.125rem]" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}

function MenuSheet({ onClose }: { onClose: () => void }) {
  const { open } = usePage();
  const ref = useFocusIn<HTMLDivElement>();
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[70] flex flex-col text-white">
      <motion.button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-[var(--deep)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring(260, 30)} />
      <motion.div className="relative flex h-full flex-col p-[var(--mk-inset)]" initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={spring(220, 28)}>
        <div className="flex h-full flex-col px-[1.5rem] py-[1.5rem] sm:px-[2.5rem] sm:pt-[2rem]">
          <div className="flex items-center justify-between">
            <Link href="/judges" onClick={onClose}><Brand /></Link>
            <CloseButton onClick={onClose} tone="light" />
          </div>
          <nav className="flex flex-1 flex-col justify-center gap-[0.5rem]">
            {NAV.map((n, i) => (
              <motion.div key={n.href} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring(200, 26), delay: (120 + i * 70) / 1000 }}>
                <Link href={n.href} onClick={onClose} className="block text-[3rem] font-medium leading-[1.05] tracking-[-0.03em] transition-colors hover:text-[var(--brand-light)] sm:text-[4.5rem]">{n.label}</Link>
              </motion.div>
            ))}
          </nav>
          <div className="flex flex-col gap-[1.25rem] border-t border-white/15 pt-[2rem] sm:flex-row sm:items-center sm:justify-between">
            <Pill variant="light" onClick={() => { onClose(); setTimeout(() => open('demo'), 60); }}>Open the demo</Pill>
            <button type="button" onClick={() => { onClose(); setTimeout(() => open('video'), 60); }} className="mk-link w-max text-[0.875rem] uppercase tracking-[0.14em] text-white/70 hover:text-white">Watch the demo · 01:53</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SeatRow({ seat, onPick }: { seat: Seat; onPick?: () => void }) {
  const body = (
    <>
      <span className="w-[2.5rem] shrink-0 text-[0.875rem] font-medium tabular-nums text-[var(--text-muted)]">{seat.n}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.5rem] font-medium leading-tight tracking-[-0.02em]">{seat.name}</span>
        <span className="mt-1 block text-[0.875rem] text-[var(--text-muted)]">{seat.role}</span>
      </span>
      <span className="grid size-[2.75rem] shrink-0 place-items-center rounded-full border border-[var(--border)]"><ArrowIcon className="mk-row-arrow size-4" /></span>
    </>
  );
  const cls = 'mk-row flex w-full items-center gap-[1.5rem] border-t border-[var(--border)] py-[1.5rem] text-start last:border-b';
  if (seat.href) return <a href={seat.href} onClick={onPick} className={cls}>{body}</a>;
  return <button type="button" onClick={() => { onPick?.(); seat.action?.(); }} className={cls}>{body}</button>;
}

function DemoSheet({ onClose }: { onClose: () => void }) {
  const { open } = usePage();
  const ref = useFocusIn<HTMLDivElement>();
  return (
    <div ref={ref} className="fixed inset-0 z-[90] flex items-end justify-center p-[0.75rem] sm:items-center sm:p-[1.5rem]">
      <motion.button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[rgb(15_47_99/0.4)] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring(240, 30)} />
      <motion.div role="dialog" aria-modal="true" aria-label="Pick a seat" className="relative max-h-[92svh] w-full overflow-y-auto rounded-[2rem] bg-white p-[1.5rem] text-[var(--text)] shadow-[0_2rem_5rem_-2rem_rgb(15_47_99/0.5)] sm:max-w-[34rem] sm:p-[2rem]"
        initial={{ opacity: 0, y: 28, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={spring(240, 26)}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>One-click demo · synthetic students</Eyebrow>
            <h2 className="mk-h2 mt-[0.75rem] text-[2.25rem] sm:text-[3rem]"><Lines lines={['Pick a', 'seat']} stagger={90} duration={800} margin="0px" /></h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="mt-[1.75rem]">{SEATS.map((s) => <SeatRow key={s.id} seat={s} />)}</div>
        <button type="button" onClick={() => { onClose(); setTimeout(() => open('video'), 60); }} className="mt-[1.5rem] inline-flex items-center gap-[0.75rem] text-[0.875rem] font-medium uppercase tracking-[0.1em]">
          <PlayMark className="size-[2.25rem]" />Rather watch? The 2-minute demo
        </button>
      </motion.div>
    </div>
  );
}

export function PlayMark({ className = '', tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  return (
    <span className={`grid place-items-center rounded-full ${tone === 'dark' ? 'bg-[var(--text)] text-white' : 'bg-white text-[var(--deep)]'} ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="ms-[8%] size-[42%]" fill="currentColor"><path d="M8 5.5v13l10.5-6.5L8 5.5Z" /></svg>
    </span>
  );
}

function VideoSheet({ onClose }: { onClose: () => void }) {
  const ref = useFocusIn<HTMLDivElement>();
  return (
    <div ref={ref} className="fixed inset-0 z-[95] flex items-center justify-center p-[1rem] sm:p-[2.5rem]">
      <motion.button type="button" aria-label="Close video" onClick={onClose} className="absolute inset-0 bg-[rgb(15_47_99/0.85)] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring(240, 30)} />
      <motion.div className="relative w-full max-w-[80rem]" initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring(240, 26)}>
        <div className="mb-[0.75rem] flex items-center justify-between text-white">
          <Eyebrow tone="light">Murshid · demo walkthrough · 01:53</Eyebrow>
          <CloseButton onClick={onClose} tone="light" />
        </div>
        <video src="/media/murshid-demo.mp4" poster="/media/murshid-demo-poster.jpg" controls autoPlay playsInline className="aspect-video w-full rounded-[2rem] bg-[var(--deep)]" />
      </motion.div>
    </div>
  );
}

/* ───────────────────────── intro loader ───────────────────────── */

const MIN_VISIBLE_MS = 1400;
const MAX_VISIBLE_MS = 2600;
const EXIT_MS = 850;

/** Navy curtain: the wordmark rises, a hairline fills, then the curtain slides up and the hero plays in. */
function Loader({ onReady }: { onReady: () => void }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<'run' | 'lift' | 'gone'>('run');
  const { lock, unlock } = useScroller();
  const min = reduce ? 200 : MIN_VISIBLE_MS;
  useEffect(() => {
    lock();
    let started = false;
    let timer = 0;
    const go = () => {
      if (started) return;
      started = true;
      timer = window.setTimeout(() => {
        setPhase('lift'); onReady(); unlock();
        window.setTimeout(() => setPhase('gone'), reduce ? 0 : EXIT_MS);
      }, min);
    };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    const force = window.setTimeout(go, MAX_VISIBLE_MS);
    return () => { clearTimeout(force); clearTimeout(timer); window.removeEventListener('load', go); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (phase === 'gone') return null;
  return (
    <motion.div role="status" aria-label={phase === 'run' ? 'Loading Murshid' : 'Loaded'} className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-[2rem] bg-[var(--deep)] text-white"
      initial={{ y: '0%' }} animate={{ y: phase === 'lift' ? '-105%' : '0%' }} transition={{ duration: reduce ? 0 : EXIT_MS / 1000, ease: EASE.inOutCubic }}>
      <motion.div className="flex items-center gap-[0.75rem]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring(200, 22)}>
        <MurshidStar className="size-[1.75rem]" strokeWidth={1.8} />
        <span className="text-[1.5rem] font-medium uppercase tracking-[0.2em]">Murshid</span>
      </motion.div>
      <div className="h-px w-[10rem] overflow-hidden rounded-full bg-white/20">
        <motion.div className="h-full origin-left bg-white" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.12, duration: (min - 120) / 1000, ease: EASE.inOutCubic }} />
      </div>
    </motion.div>
  );
}

/* ───────────────────────── footer ───────────────────────── */

const FOOT_COLS: { h: string; links: { label: string; href?: string; overlay?: Overlay }[] }[] = [
  { h: 'Try it', links: [{ label: 'Open the demo', overlay: 'demo' }, { label: 'Watch the video', overlay: 'video' }, { label: 'Student app', href: '/judges#seats' }, { label: 'Teacher portal', href: TEACHER_DEMO_URL }] },
  { h: 'Product', links: [{ label: 'How it works', href: '/how-it-works' }, { label: 'Pricing', href: '/pricing' }, { label: 'Get Murshid', href: '/welcome' }] },
  { h: 'Project', links: [{ label: 'Survey', href: '/survey' }, { label: 'Guardrails', href: '/how-it-works#guards' }, { label: 'Contact', href: '#contact' }] },
];

export function Footer() {
  const { open } = usePage();
  return (
    <footer id="contact" className="mk-band mt-[0.75rem] bg-[var(--deep)] px-[1.5rem] py-[3.5rem] text-white sm:px-[2.5rem] sm:py-[4rem]">
      <div className="flex flex-col gap-[2rem] border-b border-white/15 pb-[3.5rem] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow tone="light">Get started</Eyebrow>
          <p className="mk-h2 mt-[1rem] text-[3.75rem] leading-[0.92]"><Lines lines={['Ready to', 'try it?']} /></p>
        </div>
        <Rise delay={150} y={20} config={spring(200, 24)}><Pill variant="light" onClick={() => open('demo')}>Open the demo</Pill></Rise>
      </div>
      <div className="grid gap-[2.5rem] py-[3.5rem] md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-[20rem]">
          <span className="inline-flex items-center gap-[0.5rem]"><MurshidStar className="size-[1.25rem]" strokeWidth={1.8} /><span className="text-[1.125rem] font-medium uppercase tracking-[0.2em]">Murshid</span></span>
          <p className="mt-[1rem] text-[0.875rem] leading-relaxed text-white/65">An AI agent that plans a UAE student’s school week and tells teachers who needs support, and why. <span lang="ar" className="font-[family-name:var(--font-arabic)]">مرشد</span> means guide.</p>
          <p className="mt-[1.5rem] text-[0.875rem] text-white/55">Dubai · 2026</p>
        </div>
        {FOOT_COLS.map((c) => (
          <nav key={c.h} aria-label={c.h}>
            <p className="text-[0.75rem] font-medium uppercase tracking-[0.2em] text-white/60">{c.h}</p>
            <ul className="mt-[1rem] space-y-[0.75rem] text-[0.875rem] text-white/80">
              {c.links.map((l) => (
                <li key={l.label}>{l.overlay ? <button type="button" onClick={() => open(l.overlay!)} className="mk-link hover:text-white">{l.label}</button> : <a href={l.href} className="mk-link hover:text-white">{l.label}</a>}</li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="flex flex-col gap-[1.25rem] border-t border-white/15 pt-[2rem] text-[0.875rem] text-white/60 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Murshid. Demo build: every student and teacher is fictional.</p>
        <p>Proposed Grade 11 pilot, subject to the school’s approval.</p>
      </div>
    </footer>
  );
}

/* ───────────────────────── the shell ───────────────────────── */

export function MarketingShell({ children, intro = false }: { children: ReactNode; intro?: boolean }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [ready, setReady] = useState(!intro);
  const onReady = useCallback(() => setReady(true), []);
  return (
    <SmoothScroll>
      <ReadyContext.Provider value={ready}>
        <PageContext.Provider value={{ open: setOverlay }}>
          <div className="mk">
            {intro && <Loader onReady={onReady} />}
            <div className="mk-main">{children}</div>
          </div>
          <Overlays overlay={overlay} close={() => setOverlay(null)} />
        </PageContext.Provider>
      </ReadyContext.Provider>
    </SmoothScroll>
  );
}

function Overlays({ overlay, close }: { overlay: Overlay; close: () => void }) {
  const { lock, unlock } = useScroller();
  const [mounted, setMounted] = useState(false);
  const was = useRef<Overlay>(null);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (overlay && !was.current) lock();
    if (!overlay && was.current) unlock();
    was.current = overlay;
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, close, lock, unlock]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {overlay === 'menu' && <MenuSheet key="menu" onClose={close} />}
      {overlay === 'demo' && <DemoSheet key="demo" onClose={close} />}
      {overlay === 'video' && <VideoSheet key="video" onClose={close} />}
    </AnimatePresence>,
    document.body,
  );
}
