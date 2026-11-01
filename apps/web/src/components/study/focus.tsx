'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot } from '@/components/mascot/my-mascot';
import { Page, PageHeader } from '@/components/shared/page';
import { isTyping } from '@/components/shell/shortcuts';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { study, todayFocusMinutes, useStudy, weekFocusMinutes } from '@/lib/study';

type Mode = 'focus' | 'short' | 'long' | 'deep';
const MINUTES: Record<Mode, number> = { focus: 25, short: 5, long: 15, deep: 50 };

/** A soft two-note chime (Web Audio, no files). */
function chime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.16; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 1.3);
    });
  } catch { /* no audio */ }
}

export function FocusView() {
  const { tx, world, toast } = useApp();
  const params = useSearchParams();
  const s = useStudy();
  const [mode, setMode] = useState<Mode>('focus');
  const [label, setLabel] = useState('');
  const [endAt, setEndAt] = useState<number | null>(null);     // running when set
  const [left, setLeft] = useState(MINUTES.focus * 60_000);    // remaining ms while paused
  const [, tick] = useState(0);
  const total = MINUTES[mode] * 60_000;
  const remaining = endAt ? Math.max(0, endAt - Date.now()) : left;
  const running = endAt !== null;
  const started = useRef(false);

  const start = () => { if (!running) setEndAt(Date.now() + remaining); };
  const pause = () => { if (running) { setLeft(Math.max(0, endAt! - Date.now())); setEndAt(null); } };
  const reset = (m: Mode = mode) => { setEndAt(null); setLeft(MINUTES[m] * 60_000); };
  const choose = (m: Mode) => { setMode(m); reset(m); };

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      tick((n) => n + 1);
      if (endAt! - Date.now() <= 0) {
        setEndAt(null); chime();
        if (mode === 'focus' || mode === 'deep') {
          study.logFocus(MINUTES[mode], label || tx('Focus', 'تركيز'));
          toast({ title: tx('Session complete', 'اكتملت الجلسة'), description: tx(`${MINUTES[mode]} minutes logged. Take a short break.`, `سُجّلت ${MINUTES[mode]} دقيقة. خذ استراحة قصيرة.`) });
          setMode('short'); setLeft(MINUTES.short * 60_000);
        } else { toast({ title: tx('Break over', 'انتهت الاستراحة'), tone: 'info' }); setMode('focus'); setLeft(MINUTES.focus * 60_000); }
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, endAt, mode, label, toast, tx]);
  // the tab title shows the countdown while it runs
  const mm = String(Math.floor(remaining / 60_000)).padStart(2, '0'); const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, '0');
  useEffect(() => { if (running) document.title = `${mm}:${ss} · ${mode === 'focus' || mode === 'deep' ? tx('Focus', 'تركيز') : tx('Break', 'استراحة')}`; else document.title = `${tx('Focus timer', 'مؤقت التركيز')} · Murshid`; }, [mm, ss, running, mode, tx]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key === ' ') { e.preventDefault(); if (running) pause(); else start(); }
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) reset();
    };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });
  // /app/study/focus?start=25 starts straight away
  useEffect(() => {
    if (started.current) return; started.current = true;
    const m = Number(params.get('start'));
    if (m) { const md: Mode = m >= 50 ? 'deep' : 'focus'; setMode(md); setEndAt(Date.now() + MINUTES[md] * 60_000); }
  }, [params]);

  const pct = 1 - remaining / total;
  const R = 120; const C = 2 * Math.PI * R;
  const today = todayFocusMinutes(s.sessions); const week = weekFocusMinutes(s.sessions);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); const end = d.getTime() + 86_400_000; return { d, m: s.sessions.filter((x) => x.startedAt >= d.getTime() && x.startedAt < end).reduce((a, x) => a + x.minutes, 0) }; });
  const max = Math.max(25, ...days.map((x) => x.m));
  const tasks = world.dashboard.today.filter((t) => !t.done).slice(0, 4);
  const isBreak = mode === 'short' || mode === 'long';

  return (
    <Page>
      <PageHeader eyebrow={<Link href="/app/study" className="hover:text-foreground">{tx('Study tools', 'أدوات الدراسة')}</Link>} title={tx('Focus timer', 'مؤقت التركيز')}
        subtitle={tx('Work in short, focused blocks with breaks in between. Space starts and pauses; R resets.', 'اعمل في فترات قصيرة مركّزة بينها استراحات. المسافة للبدء والإيقاف، وR لإعادة الضبط.')} />
      <div className="grid grid-cols-12 gap-4">
        <section className="card col-span-12 items-center p-6 lg:col-span-7" aria-label={tx('Timer', 'المؤقت')}>
          <Segmented stretch className="max-w-md" ariaLabel={tx('Timer length', 'مدة المؤقت')} value={mode} onChange={choose} options={[{ value: 'focus', label: tx('Focus 25', 'تركيز 25') }, { value: 'short', label: tx('Break 5', 'استراحة 5') }, { value: 'long', label: tx('Break 15', 'استراحة 15') }, { value: 'deep', label: tx('Deep 50', 'عميق 50') }]} />
          <div className="relative my-6 grid place-items-center">
            <svg viewBox="0 0 280 280" className="size-[min(72vw,300px)] -rotate-90" aria-hidden>
              <circle cx="140" cy="140" r={R} fill="none" stroke="color-mix(in oklab, var(--text) 8%, transparent)" strokeWidth="10" />
              <circle cx="140" cy="140" r={R} fill="none" stroke={isBreak ? 'var(--teal)' : 'var(--brand)'} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: running ? 'stroke-dashoffset 0.25s linear' : 'none' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[var(--deep)]"><MyMascot size={64} mood={running ? (isBreak ? 'sleepy' : 'listening') : remaining === 0 ? 'happy' : 'idle'} track={!running} /></span>
              <p className="figure mt-1 text-[3.25rem] leading-none tabular" role="timer" aria-live="off">{mm}:{ss}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground rtl:tracking-normal">{isBreak ? tx('Break', 'استراحة') : tx('Focus', 'تركيز')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {running ? <Button size="lg" onClick={pause}><Pause />{tx('Pause', 'إيقاف مؤقت')}</Button> : <Button size="lg" onClick={start}><Play />{remaining < total ? tx('Resume', 'استئناف') : tx('Start', 'ابدأ')}</Button>}
            <Button size="lg" variant="secondary" onClick={() => reset()} aria-label={tx('Reset', 'إعادة الضبط')}><RotateCcw /></Button>
          </div>
          <div className="mt-6 w-full max-w-md">
            <Label htmlFor="focus-label">{tx('What are you working on?', 'على ماذا تعمل؟')}</Label>
            <Input id="focus-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={tx('e.g. Physics revision', 'مثل: مراجعة الفيزياء')} maxLength={60} />
            {tasks.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tasks.map((t) => <button key={t.id} type="button" onClick={() => setLabel(t.title)} className="rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground hover:text-foreground">{t.title}</button>)}</div>}
          </div>
        </section>
        <section className="card col-span-12 p-6 lg:col-span-5">
          <h2 className="card-title">{tx('Your focus this week', 'تركيزك هذا الأسبوع')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tx(`${today} min today · ${week} min in the last 7 days`, `${today} دقيقة اليوم · ${week} دقيقة في آخر 7 أيام`)}</p>
          <div className="mt-6 flex h-40 items-end gap-2" role="img" aria-label={tx('Minutes of focus per day for the last 7 days', 'دقائق التركيز يومياً لآخر 7 أيام')}>
            {days.map(({ d, m }) => (
              <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[0.6875rem] tabular text-muted-foreground">{m || ''}</span>
                <div className="w-full rounded-t-[6px] bg-[var(--brand)]" style={{ height: `${Math.max(3, (m / max) * 120)}px`, opacity: m ? 1 : 0.18 }} title={`${m} min`} />
                <span className="text-[0.6875rem] text-muted-foreground">{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-medium">{tx('Recent sessions', 'الجلسات الأخيرة')}</h3>
          <ul className="mt-2 flex flex-col">
            {[...s.sessions].reverse().slice(0, 5).map((x) => (
              <li key={x.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span className="truncate">{x.label}</span><span className="shrink-0 tabular text-muted-foreground">{x.minutes} min · {new Date(x.startedAt).toLocaleDateString(undefined, { weekday: 'short' })}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </Page>
  );
}
