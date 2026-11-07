'use client';

import { Minus, Pause, Play, Plus, Square, Type, X } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { isArabic, practice, usePractice, type ReaderPrefs } from '@/lib/practice';
import { cn } from '@/lib/utils';

const THEMES: Record<ReaderPrefs['theme'], { bg: string; fg: string; en: string; ar: string }> = {
  paper: { bg: '#fbf6ea', fg: '#1d1b16', en: 'Cream', ar: 'كريمي' },
  white: { bg: '#ffffff', fg: '#0a0a0a', en: 'White', ar: 'أبيض' },
  blue: { bg: '#e9f1fb', fg: '#0f2f63', en: 'Blue', ar: 'أزرق' },
  dark: { bg: '#11161f', fg: '#e8ebf0', en: 'Dark', ar: 'داكن' },
};
const FONTS: Record<ReaderPrefs['font'], { family: string; en: string; ar: string }> = {
  sans: { family: 'var(--font-sans), system-ui, sans-serif', en: 'Clear', ar: 'واضح' },
  serif: { family: 'Georgia, "Times New Roman", serif', en: 'Book', ar: 'كتاب' },
  wide: { family: 'Verdana, Tahoma, system-ui, sans-serif', en: 'Easy read', ar: 'سهل القراءة' },
};

/** Split into paragraphs of words, keeping each word's index in the whole text. */
function layout(text: string) {
  let i = 0;
  return text.split(/\n{2,}|\n(?=\s*[-•*#])/).map((p) => p.replace(/^\s*[#>*•-]+\s*/gm, '').trim()).filter(Boolean).map((p) => p.split(/\s+/).map((w) => ({ w, i: i++ })));
}
/** Reading in chunks of a sentence or two: long utterances stop early in some browsers. */
function chunks(all: string[], from: number) {
  const out: { start: number; text: string }[] = [];
  let start = from; let buf: string[] = [];
  for (let k = from; k < all.length; k++) {
    buf.push(all[k]!);
    if (/[.!?؟。]$/.test(all[k]!) || buf.join(' ').length > 180 || k === all.length - 1) { out.push({ start, text: buf.join(' ') }); start = k + 1; buf = []; }
  }
  return out;
}

/**
 * An immersive reader: bigger, calmer text with the spacing, font and colours you choose; read aloud with each word lit
 * up as it is spoken; and a line focus that dims everything except the line or three you are on.
 */
export function Reader({ text, title, onClose }: { text: string; title?: string; onClose?: () => void }) {
  const { tx, locale } = useApp();
  const p = usePractice().reader;
  const paras = useMemo(() => layout(text), [text]);
  const all = useMemo(() => paras.flat().map((x) => x.w), [paras]);
  const rtl = isArabic(text);
  const [word, setWord] = useState(-1);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState('');
  const [rulerY, setRulerY] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const run = useRef(0);
  // known only in the browser (set after the first paint, so server and browser render the same)
  const [can, setCan] = useState(true);
  useEffect(() => { setCan('speechSynthesis' in window); }, []);
  const lineH = p.size * p.spacing;

  useEffect(() => {
    if (!can) return;
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(rtl ? 'ar' : 'en')));
    load(); window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', load); window.speechSynthesis.cancel(); };
  }, [can, rtl]);

  const stop = useCallback(() => { run.current++; if (can) window.speechSynthesis.cancel(); setState('idle'); setWord(-1); }, [can]);
  const play = useCallback((from = 0) => {
    if (!can) return;
    window.speechSynthesis.cancel();
    const id = ++run.current;
    const list = chunks(all, Math.max(0, from));
    const v = voices.find((x) => x.name === voice) ?? voices[0];
    const next = (k: number) => {
      if (id !== run.current) return;
      const c = list[k]; if (!c) { setState('idle'); setWord(-1); return; }
      const u = new SpeechSynthesisUtterance(c.text);
      u.lang = rtl ? 'ar-AE' : 'en-GB'; u.rate = p.rate; if (v) u.voice = v;
      // the spoken character -> the word it is in
      const starts: number[] = []; let at = 0; for (const w of c.text.split(' ')) { starts.push(at); at += w.length + 1; }
      u.onboundary = (e) => { if (id !== run.current || e.name === 'sentence') return; let j = 0; while (j + 1 < starts.length && starts[j + 1]! <= e.charIndex) j++; setWord(c.start + j); };
      u.onstart = () => { if (id === run.current) setWord(c.start); };
      u.onend = () => next(k + 1);
      u.onerror = () => { if (id === run.current) setState('idle'); };
      window.speechSynthesis.speak(u);
    };
    setState('playing'); next(0);
  }, [all, can, p.rate, rtl, voice, voices]);
  const toggle = () => {
    if (state === 'idle') play(word >= 0 ? word : 0);
    else if (state === 'playing') { window.speechSynthesis.pause(); setState('paused'); }
    else { window.speechSynthesis.resume(); setState('playing'); }
  };

  // keep the spoken word in view, and the line focus on it
  useEffect(() => {
    if (word < 0 || !box.current) return;
    const el = box.current.querySelector<HTMLElement>(`[data-w="${word}"]`);
    if (!el) return;
    if (p.focus) setRulerY(el.offsetTop + el.offsetHeight / 2);
    const r = el.getBoundingClientRect();
    if (r.top < 120 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [word, p.focus]);

  const t = THEMES[p.theme];
  const band = p.focus ? lineH * p.focus : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-[calc(var(--topbar-h,64px)+8px)] z-20 flex flex-wrap items-center gap-2 rounded-full border border-border bg-[var(--bg)]/95 p-1.5 shadow-sm backdrop-blur no-print">
        <Button size="sm" onClick={toggle} disabled={!can || !all.length} aria-label={state === 'playing' ? tx('Pause', 'إيقاف مؤقت') : tx('Read aloud', 'اقرأ بصوت عالٍ')}>
          {state === 'playing' ? <Pause className="size-4" /> : <Play className="size-4" />}{state === 'playing' ? tx('Pause', 'إيقاف مؤقت') : state === 'paused' ? tx('Resume', 'متابعة') : tx('Read aloud', 'اقرأ بصوت عالٍ')}
        </Button>
        {state !== 'idle' && <Button size="sm" variant="secondary" onClick={stop} aria-label={tx('Stop', 'إيقاف')}><Square className="size-3.5" /></Button>}
        <label className="flex h-8 items-center gap-2 rounded-full bg-surface px-3 text-xs">
          {tx('Speed', 'السرعة')}
          <input type="range" min={0.5} max={1.6} step={0.1} value={p.rate} onChange={(e) => { practice.setReader({ rate: Number(e.target.value) }); if (state === 'playing') play(word); }} className="w-20 accent-[var(--deep)]" aria-label={tx('Reading speed', 'سرعة القراءة')} />
          <span className="w-8 tabular-nums">{p.rate.toFixed(1)}×</span>
        </label>
        <div role="radiogroup" aria-label={tx('Line focus', 'تركيز السطر')} className="flex h-8 items-center rounded-full bg-surface p-0.5 text-xs">
          {([0, 1, 3] as const).map((f) => <button key={f} role="radio" aria-checked={p.focus === f} onClick={() => practice.setReader({ focus: f })} className={cn('h-7 rounded-full px-2.5', p.focus === f && 'bg-[var(--bg)] font-medium shadow-sm')}>{f === 0 ? tx('All lines', 'كل الأسطر') : f === 1 ? tx('1 line', 'سطر') : tx('3 lines', '3 أسطر')}</button>)}
        </div>
        <Popover.Root>
          <Popover.Trigger asChild><Button size="sm" variant="secondary"><Type className="size-4" />{tx('Text', 'النص')}</Button></Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={8} collisionPadding={12} className="z-50 w-[min(92vw,20rem)] rounded-[24px] bg-popover p-4 text-sm shadow-lift">
              <div className="flex items-center justify-between"><span>{tx('Size', 'الحجم')}</span>
                <span className="flex items-center gap-1"><button aria-label={tx('Smaller', 'أصغر')} onClick={() => practice.setReader({ size: Math.max(16, p.size - 2) })} className="grid size-9 place-items-center rounded-full bg-surface"><Minus className="size-4" /></button><span className="w-8 text-center tabular-nums">{p.size}</span><button aria-label={tx('Bigger', 'أكبر')} onClick={() => practice.setReader({ size: Math.min(44, p.size + 2) })} className="grid size-9 place-items-center rounded-full bg-surface"><Plus className="size-4" /></button></span>
              </div>
              <label className="mt-3 flex items-center justify-between gap-3">{tx('Line spacing', 'تباعد الأسطر')}<input type="range" min={1.4} max={2.8} step={0.1} value={p.spacing} onChange={(e) => practice.setReader({ spacing: Number(e.target.value) })} className="w-32 accent-[var(--deep)]" /></label>
              <label className="mt-3 flex items-center justify-between gap-3">{tx('Letter spacing', 'تباعد الحروف')}<input type="range" min={0} max={0.12} step={0.02} value={p.letter} onChange={(e) => practice.setReader({ letter: Number(e.target.value) })} className="w-32 accent-[var(--deep)]" /></label>
              <p className="mb-1.5 mt-4 text-xs text-muted-foreground">{tx('Font', 'الخط')}</p>
              <div className="grid grid-cols-3 gap-1.5">{(Object.keys(FONTS) as ReaderPrefs['font'][]).map((f) => <button key={f} onClick={() => practice.setReader({ font: f })} aria-pressed={p.font === f} className={cn('h-10 rounded-[12px] text-xs', p.font === f ? 'bg-[var(--deep)] text-white' : 'bg-surface')} style={{ fontFamily: FONTS[f].family }}>{locale === 'ar' ? FONTS[f].ar : FONTS[f].en}</button>)}</div>
              <p className="mb-1.5 mt-4 text-xs text-muted-foreground">{tx('Colours', 'الألوان')}</p>
              <div className="grid grid-cols-4 gap-1.5">{(Object.keys(THEMES) as ReaderPrefs['theme'][]).map((k) => <button key={k} onClick={() => practice.setReader({ theme: k })} aria-pressed={p.theme === k} className={cn('h-10 rounded-[12px] border text-xs', p.theme === k ? 'border-[var(--deep)] ring-2 ring-[var(--brand-light)]' : 'border-border')} style={{ background: THEMES[k].bg, color: THEMES[k].fg }}>{locale === 'ar' ? THEMES[k].ar : THEMES[k].en}</button>)}</div>
              {voices.length > 1 && (
                <label className="mt-4 block text-xs text-muted-foreground">{tx('Voice', 'الصوت')}
                  <select value={voice} onChange={(e) => setVoice(e.target.value)} className="mt-1 h-10 w-full rounded-full border border-border bg-transparent px-3 text-sm text-foreground">
                    <option value="">{tx('Default', 'الافتراضي')}</option>{voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                </label>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {onClose && <button onClick={() => { stop(); onClose(); }} aria-label={tx('Close the reader', 'أغلق القارئ')} className="ms-auto grid size-8 place-items-center rounded-full hover:bg-surface"><X className="size-4" /></button>}
      </div>
      {!can && <p className="text-xs text-muted-foreground">{tx('This browser cannot read aloud. The text settings still work.', 'لا يدعم هذا المتصفح القراءة الصوتية. إعدادات النص ما زالت تعمل.')}</p>}

      <div ref={box} tabIndex={0} dir={rtl ? 'rtl' : 'ltr'} lang={rtl ? 'ar' : 'en'}
        onPointerMove={(e) => { if (p.focus && state !== 'playing') { const r = box.current!.getBoundingClientRect(); setRulerY(e.clientY - r.top); } }}
        onKeyDown={(e) => { if (!p.focus) return; if (e.key === 'ArrowDown') { e.preventDefault(); setRulerY((y) => y + lineH); } if (e.key === 'ArrowUp') { e.preventDefault(); setRulerY((y) => Math.max(0, y - lineH)); } }}
        className="relative overflow-hidden rounded-[var(--radius-lg)] px-5 py-8 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] sm:px-10 sm:py-12"
        style={{ background: t.bg, color: t.fg, fontFamily: FONTS[p.font].family, fontSize: p.size, lineHeight: p.spacing, letterSpacing: `${p.letter}em`, wordSpacing: p.font === 'wide' ? '0.16em' : undefined }}>
        <div className="mx-auto max-w-[68ch]">
          {title && <h2 className="mb-[0.8em] font-semibold" style={{ fontSize: '1.25em', lineHeight: 1.3 }}>{title}</h2>}
          {paras.map((para, k) => (
            <p key={k} className="mb-[1em]">
              {para.map(({ w, i }) => (
                <span key={i}>
                  <span data-w={i} onClick={() => { setWord(i); if (state !== 'idle') play(i); }} className={cn('cursor-pointer rounded-[0.2em] transition-colors duration-100', i === word && 'bg-[color-mix(in_oklab,var(--brand-light)_45%,transparent)]')}>{w}</span>{' '}
                </span>
              ))}
            </p>
          ))}
        </div>
        {p.focus > 0 && <div aria-hidden className="pointer-events-none absolute inset-x-0 transition-[top] duration-200" style={{ top: Math.max(0, rulerY - band / 2), height: band, boxShadow: `0 0 0 100vmax ${p.theme === 'dark' ? 'rgba(0,0,0,.62)' : 'rgba(10,14,22,.5)'}` }} />}
      </div>
      <p className="text-xs text-muted-foreground no-print">{tx('Tap a word to read from there. With line focus on, move the pointer or use the arrow keys.', 'اضغط كلمة لتبدأ القراءة منها. مع تركيز السطر، حرّك المؤشر أو استخدم الأسهم.')}</p>
    </div>
  );
}
