'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import { MurshidStar } from '@/components/shell/icons';
import { ArrowButton, ArrowIcon, Dots, Eyebrow, Pill, PlayMark, SEATS, Shot, usePage } from '@/components/marketing/chrome';
import { EASE, Lines, Rise, Words, spring, useCanHover, useShown, useScrub } from '@/components/marketing/motion';

/* ───────────────────────── 2 · trust: ghost words around a tilted card ───────────────────────── */

const TRUST = [
  { words: ['Plans', 'every', 'student’s', 'week'], img: '/shots/m-home.jpg', focus: 'top', name: 'Ahamed Mehta', role: 'Student · Grade 11', alt: 'Ahamed’s home screen: today’s tasks and the countdown' },
  { words: ['Shows', 'its', 'working,', 'always'], img: '/shots/m-chat.jpg', focus: '50% 62%', name: 'How Murshid worked this out', role: 'Goal · steps · tools · actions', alt: 'The step-by-step trace under a Murshid reply' },
  { words: ['Spots', 'who', 'needs', 'support'], img: '/shots/d-bestday.jpg', focus: '66% 30%', name: 'Ms. Sana Thomas', role: 'Teacher · Grade 11 English', alt: 'The teacher’s best day for homework, 83% likely on time' },
];
const DRIFT: [string, string][] = [['-3%', '3%'], ['3%', '-3%'], ['-2%', '4%'], ['4%', '-3%']];

function GhostWord({ word, ink, k, drift, scope }: { word: string; ink?: boolean; k: string; drift: [string, string]; scope: React.RefObject<HTMLElement | null> }) {
  const [ref, on] = useShown<HTMLSpanElement>('0px 0px -10% 0px');
  const reduce = useReducedMotion();
  const x = useScrub(scope, drift);
  return (
    <motion.span ref={ref} style={{ x }} className={`inline-block overflow-hidden pb-[0.12em] ${ink ? 'text-[var(--text)]' : 'text-[var(--ghost)]'}`}>
      <motion.span key={k} className="inline-block" initial={reduce ? false : { y: '115%', opacity: 0 }} animate={on || reduce ? { y: '0%', opacity: 1 } : { y: '115%', opacity: 0 }} transition={{ duration: 0.7, ease: EASE.outExpo }}>
        {word}
      </motion.span>
    </motion.span>
  );
}

export function Trust() {
  const ref = useRef<HTMLElement>(null);
  const [i, setI] = useState(0);
  const s = TRUST[i]!;
  const go = (d: number) => setI((v) => (v + d + TRUST.length) % TRUST.length);
  return (
    <section ref={ref} id="trust" className="relative isolate overflow-hidden bg-[var(--bg)] px-[1.5rem] py-[4rem] sm:px-[2.5rem] sm:py-[5rem]">
      <div className="relative z-20 flex flex-col gap-[1.5rem] sm:flex-row sm:items-start sm:justify-between">
        <Rise y={0} scale={0.9} config={spring(220, 22)} className="grid size-[7rem] place-items-center rounded-full bg-[var(--surface)] text-center sm:size-[8rem]">
          <span><span className="block text-[1.5rem] font-medium">100%</span><span className="mx-auto mt-1 block max-w-[7em] text-[0.6rem] leading-snug text-[var(--text-muted)]">of every plan comes from his own data</span></span>
        </Rise>
        <Rise as="article" delay={120} y={24} config={spring(200, 26)} className="flex max-w-[28rem] gap-[1rem] rounded-[1.5rem] bg-[var(--surface)] p-[1.25rem] sm:gap-[1.25rem] sm:p-[1.5rem]">
          <span className="h-max rounded-[0.75rem] bg-[var(--bg)] px-[1rem] py-[0.5rem] text-[1.25rem] font-medium">#01</span>
          <div>
            <h3 className="text-[1.125rem] font-medium">Built for a real school week</h3>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--text-muted)]">Tests, homework from every teacher, training and fixtures. Murshid plans around all of it, in English and Arabic, and shows how it got there.</p>
          </div>
        </Rise>
      </div>

      <h2 id="trust-title" aria-label={s.words.join(' ')} className="pointer-events-none relative z-0 mx-auto mt-[3rem] max-w-[88rem] select-none text-[8.2vw] font-medium uppercase leading-[1.02] tracking-[-0.03em]">
        <span aria-hidden className="flex justify-between"><GhostWord word={s.words[0]!} k={`${i}-0`} drift={DRIFT[0]!} scope={ref} /><GhostWord word={s.words[1]!} k={`${i}-1`} drift={DRIFT[1]!} scope={ref} /></span>
        <span aria-hidden className="flex justify-between"><GhostWord word={s.words[2]!} ink k={`${i}-2`} drift={DRIFT[2]!} scope={ref} /><GhostWord word={s.words[3]!} k={`${i}-3`} drift={DRIFT[3]!} scope={ref} /></span>
      </h2>

      <Rise as="figure" y={60} scale={0.92} config={spring(170, 26)}
        className="relative z-10 mx-auto mt-[2rem] aspect-[3/4] w-[13rem] rotate-[6deg] overflow-hidden rounded-[1.5rem] bg-[var(--brand)] sm:absolute sm:left-1/2 sm:top-1/2 sm:mt-0 sm:w-[16rem] sm:-translate-x-1/2 sm:-translate-y-1/2">
        <AnimatePresence initial={false}>
          <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring(260, 26)}>
            <Shot src={s.img} alt={s.alt} focus={s.focus} className="size-full !rounded-none" />
          </motion.div>
        </AnimatePresence>
        <figcaption className="absolute inset-x-[0.75rem] bottom-[0.75rem] rounded-[0.75rem] bg-[rgb(15_47_99/0.6)] px-[0.75rem] py-[0.5rem] text-white backdrop-blur">
          <p className="truncate text-[0.875rem] font-medium">{s.name}</p>
          <p className="text-[0.65rem] opacity-80">{s.role}</p>
        </figcaption>
      </Rise>

      <div className="relative z-20 mt-[3rem] flex items-center justify-between sm:mt-[6rem]">
        <ArrowButton dir="prev" onClick={() => go(-1)} label="Previous" />
        <Dots count={TRUST.length} active={i} onPick={setI} />
        <ArrowButton dir="next" variant="solid" onClick={() => go(1)} label="Next" />
      </div>
    </section>
  );
}

/* ───────────────────────── 3 · how it works: numbered rows ───────────────────────── */

const STEPS = [
  ['01', 'Ask in plain words', 'Ahamed types “plan my week around my mid-term and both sports”.'],
  ['02', 'It reads the real week', 'Timetable, tests, homework, training and fixtures: his own data, nobody else’s.'],
  ['03', 'Then it acts', 'A revision block the night before the test, a reminder, the plan written into his calendar.'],
  ['04', 'And shows its working', 'Every reply carries a trace: goal, plan, tools used, actions taken, result.'],
  ['05', 'Teachers see who needs help', 'Post work once: every student’s week replans, with at-risk flags and the reason.'],
];

export function Steps() {
  return (
    <section id="how" className="rounded-t-[2rem] bg-[var(--surface)] px-[1.5rem] pb-[7rem] pt-[6rem] sm:px-[2.5rem]">
      <div className="flex flex-col gap-[1.5rem] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>How it works</Eyebrow>
          <h2 id="steps-title" className="mk-h2 mt-[1rem] text-[3rem]"><Lines lines={['From ask', 'to action']} /></h2>
        </div>
        <a href="/how-it-works" className="mk-link w-max text-[0.875rem] uppercase tracking-[0.1em] text-[var(--text-muted)] hover:text-[var(--text)]">The full agent loop →</a>
      </div>
      <ul className="mt-[3.5rem] border-b border-[var(--border)]">
        {STEPS.map(([n, t, d], i) => (
          <li key={n}>
            <a href={`/how-it-works#loop`} className="mk-row block border-t border-[var(--border)] focus-visible:bg-[var(--bg)]">
              <Rise delay={i * 90} y={26} config={spring(190, 26)} className="flex items-center gap-[1.5rem] py-[1.75rem]">
                <span className="w-[2.5rem] text-[0.875rem] font-medium text-[var(--text-muted)]">{n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.5rem] font-medium leading-tight tracking-[-0.02em] sm:text-[1.875rem]">{t}</span>
                  <span className="mt-1 block text-[0.875rem] text-[var(--text-muted)]">{d}</span>
                </span>
                <span className="grid size-[2.75rem] shrink-0 place-items-center rounded-full border border-[var(--border)]"><ArrowIcon className="mk-row-arrow size-4" /></span>
              </Rise>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────────────────────── 4 · two views ───────────────────────── */

const VIEWS = [
  { img: '/shots/m-home.jpg', focus: 'top', name: 'Student app', desc: 'Today, the countdown and Ask Murshid, on his phone.', tone: 'navy', alt: 'The student app on a phone' },
  { img: '/shots/d-teacher.jpg', focus: '39% 18%', name: 'Teacher portal', desc: 'Class progress, who needs what, and the best day for homework.', tone: 'teal', alt: 'The teacher portal: the class this week, in numbers' },
];

export function Views() {
  return (
    <section id="views" className="relative -mt-[2.5rem] rounded-[2rem] bg-[var(--bg)] px-[1.5rem] pb-[5rem] pt-[4rem] sm:px-[2.5rem]">
      <div className="grid items-end gap-[2.5rem] md:grid-cols-2">
        <div className="max-w-[24rem]">
          <Rise y={0} scale={0.85} config={spring(240, 20)} className="grid size-[4rem] place-items-center rounded-[1.5rem] bg-[var(--deep)] text-white">
            <MurshidStar className="size-[2rem]" strokeWidth={1.7} />
          </Rise>
          <h2 id="views-title" className="mk-h2 mt-[1.5rem] text-[3rem]"><Lines lines={['One week,', 'two', 'views']} stagger={120} /></h2>
          <Words as="p" text="Students see a calm plan for the week. Teachers see who needs support and the best day to set homework. Same data, same rules, separate schools." className="mt-[1.5rem] max-w-[20rem] text-[0.875rem] leading-relaxed text-[var(--text-muted)]" gap="0.25em" stagger={28} delay={250} config={spring(170, 26)} />
        </div>
        <div className="flex items-end gap-[1.25rem]">
          {VIEWS.map((v, i) => (
            <Rise as="figure" key={v.name} delay={i * 140} y={48} config={spring(180, 26)} className={`group relative aspect-[3/4] flex-1 overflow-hidden rounded-[1.5rem] bg-[var(--surface)] ${i === 1 ? 'mb-[2rem]' : ''}`}>
              <div className="size-full transition-transform duration-500 ease-[cubic-bezier(.2,0,0,1)] group-hover:scale-[1.03]">
                <Shot src={v.img} alt={v.alt} focus={v.focus} className="size-full !rounded-none" />
              </div>
              <figcaption className={`absolute inset-x-[0.75rem] bottom-[0.75rem] rounded-[0.75rem] px-[1rem] py-[0.75rem] text-white backdrop-blur ${v.tone === 'teal' ? 'bg-[rgb(11_110_151/0.7)]' : 'bg-[rgb(15_47_99/0.65)]'}`}>
                <p className="text-[0.875rem] font-medium">{v.name}</p>
                <p className="mt-0.5 text-[0.65rem] leading-snug opacity-85">{v.desc}</p>
              </figcaption>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── 5 · the demo video, in the page ───────────────────────── */

export function Film() {
  const video = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [live, setLive] = useState(false);
  const [paused, setPaused] = useState(false);
  const play = () => {
    const v = video.current;
    if (!v) return;
    v.muted = false; v.currentTime = 0; v.controls = true; void v.play(); setLive(true);
  };
  // the silent preview can be paused (WCAG 2.2.2), and never starts on its own for reduced motion
  const togglePreview = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };
  return (
    <section id="film" className="bg-[var(--bg)] px-[1.5rem] pb-[5rem] sm:px-[2.5rem]">
      <div className="flex flex-col gap-[1.5rem] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Watch the demo</Eyebrow>
          <h2 className="mk-h2 mt-[1rem] text-[3rem]"><Lines lines={['Two minutes,', 'start to finish']} /></h2>
        </div>
        <p className="max-w-[24rem] text-[0.875rem] leading-relaxed text-[var(--text-muted)] sm:text-right">A student plans his week, a teacher posts work, the best day to set homework, weekly reports and the guardrails. Narrated, 01:53.</p>
      </div>
      <Rise y={40} config={spring(170, 26)} className="relative mt-[3rem] overflow-hidden rounded-[2rem] bg-[var(--deep)]">
        <video ref={video} src="/media/murshid-demo.mp4" poster="/media/murshid-demo-poster.jpg" muted loop={!live} autoPlay={!reduce} playsInline preload="metadata" className="aspect-video w-full" aria-label="Murshid demo walkthrough" />
        {/* the whole preview starts the film with sound; the controls sit below so they never cover the picture */}
        {!live && <button type="button" onClick={play} className="absolute inset-0 cursor-pointer" aria-label="Watch the demo with sound" tabIndex={-1} />}
      </Rise>
      {!live && (
        <div className="mt-[1.25rem] flex flex-wrap items-center justify-between gap-[1rem]">
          <Pill variant="solid" arrow={false} onClick={play} className="!py-[0.5rem] !ps-[0.5rem]" icon={<PlayMark tone="light" className="size-[2.25rem]" />}>Watch with sound · 01:53</Pill>
          {!reduce && (
            <button type="button" onClick={togglePreview} className="rounded-full border border-[var(--border)] px-[1.25rem] py-[0.75rem] text-[0.75rem] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)] transition-colors hover:border-[var(--text)] hover:text-[var(--text)]">
              {paused ? 'Play preview' : 'Pause preview'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── 6 · numbers ───────────────────────── */

const STATS: [string, string][] = [['3', 'Seats to try: student, teacher, school admin'], ['7', 'Parts of student life in one plan'], ['30', 'Students replanned when a teacher posts'], ['2', 'Languages, English and Arabic']];

export function Numbers() {
  return (
    <section className="mk-band relative isolate mt-[0.75rem] overflow-hidden bg-[var(--deep)] px-[1.5rem] py-[5rem] text-white sm:px-[2.5rem]">
      <Eyebrow tone="light">The demo, counted</Eyebrow>
      <h2 id="stats-title" className="mk-h2 mt-[1rem] text-[3rem]"><Lines lines={['A demo that', 'keeps score']} /></h2>
      <dl className="mt-[4rem] grid grid-cols-2 gap-x-[2rem] gap-y-[3rem] lg:grid-cols-4">
        {STATS.map(([v, l], i) => (
          <Rise key={l} delay={i * 110} y={30} config={spring(180, 24)} className="border-t border-white/20 pt-[1.25rem]">
            <dt className="sr-only">{l}</dt>
            <dd className="mk-figure text-[3.75rem] sm:text-[4.5rem]">{v}</dd>
            <dd className="mt-[0.75rem] max-w-[14rem] text-[0.875rem] text-white/65">{l}</dd>
          </Rise>
        ))}
      </dl>
    </section>
  );
}

/* ───────────────────────── 7 · guardrails ───────────────────────── */

const GUARDS = [
  { n: '01', t: 'Consent, per purpose', d: 'Core service, school connector, guardian summaries, notifications: each is agreed separately and can be withdrawn. Under-18s need a verified guardian.', who: 'Privacy' },
  { n: '02', t: 'One school, one tenant', d: 'A teacher sees only the classes they teach. A school admin sees only their school. A school never sees a family account.', who: 'Data separation' },
  { n: '03', t: 'Nothing leaves without a yes', d: 'The chat never posts or sends anything outside Murshid, and every change is logged with who, what and when.', who: 'Human approval · audit log' },
];

export function Guardrails() {
  const canHover = useCanHover();
  return (
    <section id="guardrails" className="bg-[var(--bg)] px-[1.5rem] py-[5rem] sm:px-[2.5rem] sm:py-[6rem]">
      <Eyebrow>Safe by design</Eyebrow>
      <h2 className="mk-h2 mt-[1rem] text-[3rem]"><Lines lines={['Guardrails,', 'in the code']} /></h2>
      <ul className="mt-[3.5rem] grid gap-[1.25rem] md:grid-cols-3">
        {GUARDS.map((g, i) => (
          <Rise as="li" key={g.n} delay={i * 120} y={40} config={spring(180, 26)}>
            <motion.figure whileHover={canHover ? { y: -8 } : undefined} transition={spring(300, 22)} className="flex h-full flex-col justify-between rounded-[1.5rem] bg-[var(--surface)] p-[1.75rem]">
              <div>
                <span className="grid size-[2.75rem] place-items-center rounded-full bg-[var(--deep)] text-[0.8125rem] font-medium text-white">{g.n}</span>
                <blockquote className="mt-[1.5rem] text-[1.5rem] font-medium leading-tight tracking-[-0.02em]">{g.t}</blockquote>
                <p className="mt-[0.75rem] text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">{g.d}</p>
              </div>
              <figcaption className="mt-[1.5rem] border-t border-[var(--border)] pt-[1rem] text-[0.875rem] text-[var(--text-muted)]">{g.who}</figcaption>
            </motion.figure>
          </Rise>
        ))}
      </ul>
    </section>
  );
}

/* ───────────────────────── 8 · pick a seat ───────────────────────── */

export function Seats() {
  const { open } = usePage();
  return (
    <section id="seats" className="rounded-[2rem] bg-[var(--surface)] px-[1.5rem] py-[5rem] sm:px-[2.5rem] sm:py-[6rem]">
      <div className="flex flex-col gap-[1.5rem] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Try it in one click · synthetic students</Eyebrow>
          <h2 className="mk-h2 mt-[1rem] text-[3rem]"><Lines lines={['Pick a', 'seat']} /></h2>
        </div>
        <button type="button" onClick={() => open('video')} className="inline-flex w-max items-center gap-[0.75rem] text-[0.875rem] font-medium uppercase tracking-[0.08em]"><PlayMark className="size-[2.25rem]" />Rather watch first</button>
      </div>
      <ul className="mt-[3.5rem] border-b border-[var(--border)]" data-testid="demo-logins">
        {SEATS.map((s, i) => {
          const inner = (
            <Rise delay={i * 90} y={26} config={spring(190, 26)} className="grid items-center gap-[1.5rem] py-[1.75rem] sm:grid-cols-[2.5rem_1fr_1.2fr_auto]">
              <span className="text-[0.875rem] font-medium text-[var(--text-muted)]">{s.n}</span>
              <span>
                <span className="block text-[1.5rem] font-medium leading-tight tracking-[-0.02em] sm:text-[1.875rem]">{s.name}</span>
                <span className="mt-1 block text-[0.875rem] text-[var(--text-muted)]">{s.role}</span>
              </span>
              <span className="hidden text-[0.875rem] leading-relaxed text-[var(--text-muted)] sm:block">{s.line}</span>
              <span className="inline-flex items-center gap-[0.75rem] justify-self-start sm:justify-self-end">
                <span className="text-[0.75rem] font-medium uppercase tracking-[0.1em]">{s.cta}</span>
                <span className="grid size-[2.75rem] place-items-center rounded-full bg-[var(--deep)] text-white"><ArrowIcon className="mk-row-arrow size-4 !opacity-100" /></span>
              </span>
            </Rise>
          );
          const cls = 'mk-row block w-full border-t border-[var(--border)] text-start';
          return (
            <li key={s.id}>
              {s.href
                ? <a href={s.href} data-testid={s.testid} className={cls}>{inner}</a>
                : <button type="button" onClick={s.action} data-testid={s.testid} className={cls}>{inner}</button>}
            </li>
          );
        })}
      </ul>
      <div className="mt-[2.5rem]"><Pill onClick={() => open('demo')}>See every seat</Pill></div>
    </section>
  );
}
