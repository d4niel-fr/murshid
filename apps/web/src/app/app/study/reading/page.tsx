'use client';

import { Mic, RotateCcw, Square, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { micError, useListen } from '@/components/study/use-listen';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { PASSAGES, type Passage } from '@/lib/passages';
import { align, fluencyGuide, isArabic, practice, say, usePractice, wcpm, words } from '@/lib/practice';
import { cn } from '@/lib/utils';

const BAND_LEVEL: Record<string, 1 | 2 | 3 | 4> = { 'g5-6': 1, 'g7-8': 2, 'g9-10': 3, 'g11-12': 4 };

/** Read a passage aloud: Murshid listens, follows along, and shows words correct per minute and the words to practise. */
export default function ReadingCoachPage() {
  const { tx, locale, band, world } = useApp();
  const history = usePractice().reading;
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(BAND_LEVEL[band] ?? 3);
  const [own, setOwn] = useState<{ title: string; text: string } | null>(null);
  const [pick, setPick] = useState<Passage | null>(null);
  const [draft, setDraft] = useState('');
  const list = PASSAGES.filter((p) => p.level === level && (locale === 'ar' || p.lang === 'en'));
  const passage = own ?? pick ?? list[0] ?? PASSAGES[0]!;
  const lang = isArabic(passage.text) ? 'ar' : 'en';
  const listen = useListen(lang);
  const [startAt, setStartAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<null | { wcpm: number; accuracy: number; correct: number; read: number; seconds: number; practise: string[] }>(null);
  const [manual, setManual] = useState(false);
  const tokens = useMemo(() => passage.text.split(/\s+/), [passage.text]);
  const expected = useMemo(() => tokens.map((t) => words(t)[0] ?? ''), [tokens]);
  const heard = useMemo(() => words(`${listen.text} ${listen.interim}`), [listen.text, listen.interim]);
  const live = useMemo(() => align(expected, heard), [expected, heard]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const grade = world.dashboard.student.grade ?? null;

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const begin = (asManual = false) => {
    setResult(null); setManual(asManual);
    const t0 = Date.now(); setStartAt(t0); setSeconds(0);
    timer.current = setInterval(() => setSeconds(Math.round((Date.now() - t0) / 1000)), 500);
    if (!asManual) listen.start();
  };
  const finish = () => {
    if (timer.current) clearInterval(timer.current);
    const secs = Math.max(1, Math.round((Date.now() - startAt) / 1000));
    if (manual) {
      const n = expected.length;
      setResult({ wcpm: wcpm(n, secs), accuracy: 100, correct: n, read: n, seconds: secs, practise: [] });
      practice.addReading({ title: passage.title, words: n, seconds: secs, wcpm: wcpm(n, secs), accuracy: 100, practise: [] });
      setManual(false); setStartAt(0);
      return;
    }
    const { text } = listen.stop();
    const a = align(expected, words(text));
    const read = Math.max(1, a.read);
    const practise = [...new Set(a.marks.flatMap((m, i) => (m === 'wrong' || m === 'missed' ? [tokens[i]!.replace(/[^\p{L}\p{N}’'-]/gu, '')] : [])))].filter(Boolean).slice(0, 12);
    const r = { wcpm: wcpm(a.correct, secs), accuracy: Math.round((a.correct / read) * 100), correct: a.correct, read, seconds: secs, practise };
    setResult(r); setStartAt(0);
    if (a.read > 3) practice.addReading({ title: passage.title, words: a.read, seconds: secs, wcpm: r.wcpm, accuracy: r.accuracy, practise });
  };
  const running = startAt > 0;
  const marks = result || running ? live.marks : null;
  const guide = fluencyGuide(grade);
  const recent = history.filter((h) => h.wcpm > 0).slice(-8);

  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Reading coach', 'مدرّب القراءة')}
        subtitle={tx('Read a passage out loud. Murshid follows along, then shows how many words you read correctly per minute and which words to practise.', 'اقرأ النص بصوت عالٍ. يتابعك مرشد ثم يعرض عدد الكلمات الصحيحة في الدقيقة والكلمات التي تحتاج إلى تدريب.')} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 grid content-start gap-4 lg:col-span-8">
          {!running && !result && (
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                {([1, 2, 3, 4] as const).map((l) => <button key={l} onClick={() => { setLevel(l); setPick(null); setOwn(null); }} className={cn('h-9 rounded-full px-3.5 text-xs font-medium', level === l && !own ? 'bg-[var(--deep)] text-white' : 'bg-surface')}>{[tx('Grades 5–6', 'الصفوف 5–6'), tx('Grades 7–8', 'الصفوف 7–8'), tx('Grades 9–10', 'الصفوف 9–10'), tx('Grades 11–12', 'الصفوف 11–12')][l - 1]}</button>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {list.map((p) => <button key={p.id} onClick={() => { setPick(p); setOwn(null); }} className={cn('h-9 rounded-full border px-3 text-xs', passage === p ? 'border-[var(--deep)]' : 'border-border')} dir="auto">{p.title}</button>)}
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-primary">{tx('Use my own text', 'استخدم نصي الخاص')}</summary>
                <textarea dir="auto" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={tx('Paste a paragraph from your book…', 'الصق فقرة من كتابك…')} className="mt-2 w-full rounded-[18px] border border-border bg-transparent px-4 py-3" />
                <Button size="sm" variant="secondary" className="mt-2" disabled={words(draft).length < 10} onClick={() => setOwn({ title: tx('My text', 'نصي'), text: draft.trim().slice(0, 3000) })}>{tx('Use this text', 'استخدم هذا النص')}</Button>
              </details>
            </Card>
          )}

          <Card className="p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium" dir="auto">{passage.title}</h2>
              <span className="text-sm tabular-nums text-muted-foreground">{running ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : tx(`${expected.length} words`, `${expected.length} كلمة`)}</span>
            </div>
            <p dir="auto" lang={lang} className="text-[1.25rem] leading-[2.1] sm:text-[1.375rem]">
              {tokens.map((t, i) => (
                <span key={i}>
                  <span className={cn('rounded-[0.2em] transition-colors', marks?.[i] === 'ok' && 'text-success', marks?.[i] === 'wrong' && 'bg-[color-mix(in_oklab,var(--warning)_22%,transparent)]', marks?.[i] === 'missed' && result && 'underline decoration-[var(--danger)] decoration-2 underline-offset-4', running && i === live.read && 'bg-[color-mix(in_oklab,var(--brand-light)_35%,transparent)]')}>{t}</span>{' '}
                </span>
              ))}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {!running ? (
                <>
                  {listen.supported ? <Button onClick={() => begin()}><Mic className="size-4" />{result ? tx('Read again', 'اقرأ مجدداً') : tx('Start reading aloud', 'ابدأ القراءة بصوت عالٍ')}</Button>
                    : <Button onClick={() => begin(true)}><Mic className="size-4" />{tx('Start the timer', 'ابدأ المؤقت')}</Button>}
                  {result && <Button variant="ghost" onClick={() => { setResult(null); }}><RotateCcw className="size-4" />{tx('Pick another passage', 'اختر نصاً آخر')}</Button>}
                </>
              ) : <Button variant="danger" onClick={finish}><Square className="size-4" />{tx('I’ve finished', 'انتهيت')}</Button>}
              {running && listen.listening && <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-[var(--danger)]" />{tx('Listening…', 'أستمع…')}</span>}
            </div>
            {!listen.supported && <Muted className="mt-3 text-xs">{tx('This browser cannot listen, so only your time is measured. Chrome, Edge and Safari can listen.', 'لا يستطيع هذا المتصفح الاستماع، لذا يُقاس الوقت فقط. يمكن لـ Chrome وEdge وSafari الاستماع.')}</Muted>}
            {listen.error && <p className="mt-3 text-sm text-danger">{micError(listen.error, tx)}</p>}
          </Card>

          {result && (
            <Card>
              <CardHeader title={tx('How you did', 'نتيجتك')} />
              <div className="grid grid-cols-3 gap-2 text-center">
                {[[tx('Words correct / min', 'كلمات صحيحة/دقيقة'), result.wcpm], [tx('Accuracy', 'الدقة'), `${result.accuracy}%`], [tx('Time', 'الوقت'), `${Math.floor(result.seconds / 60)}:${String(result.seconds % 60).padStart(2, '0')}`]].map(([l, v]) => (
                  <div key={l as string} className="rounded-[18px] bg-surface p-3"><p className="text-2xl font-medium tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
                ))}
              </div>
              <p className="mt-4 text-sm">{result.accuracy < 90 ? tx('Slow down a little: reading accurately matters more than reading fast. Practise the words below, then read again.', 'تمهّل قليلاً: الدقة أهم من السرعة. تدرّب على الكلمات أدناه ثم اقرأ مجدداً.') : result.wcpm >= guide ? tx('Fluent and accurate. Try a harder passage next time.', 'قراءة طليقة ودقيقة. جرّب نصاً أصعب في المرة القادمة.') : tx(`Accurate. Reading the same passage again usually adds 10–20 words a minute; around ${guide} is typical for your year.`, `قراءة دقيقة. إعادة قراءة النص نفسه تضيف عادة 10–20 كلمة في الدقيقة؛ والمعتاد لصفك نحو ${guide}.`)}</p>
              {result.practise.length > 0 && (
                <>
                  <p className="mb-2 mt-5 text-xs text-muted-foreground">{tx('Words to practise (tap to hear them)', 'كلمات للتدريب (اضغط لسماعها)')}</p>
                  <div className="flex flex-wrap gap-1.5">{result.practise.map((w) => <button key={w} onClick={() => say(w, 0.8)} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm" dir="auto"><Volume2 className="size-3.5" />{w}</button>)}</div>
                </>
              )}
            </Card>
          )}
        </div>

        <Card className="col-span-12 lg:col-span-4">
          <CardHeader title={tx('Your progress', 'تقدّمك')} />
          {!recent.length ? <Muted>{tx('Your reads will show here.', 'ستظهر قراءاتك هنا.')}</Muted> : (
            <>
              <div className="flex h-32 items-end gap-1.5" role="img" aria-label={tx('Words correct per minute, latest reads', 'كلمات صحيحة في الدقيقة لآخر القراءات')}>
                {recent.map((h) => <div key={h.id} className="flex flex-1 flex-col items-center justify-end gap-1"><span className="text-[0.625rem] tabular-nums text-muted-foreground">{h.wcpm}</span><div className="w-full rounded-t-[6px] bg-[var(--brand)]" style={{ height: `${Math.min(100, (h.wcpm / Math.max(guide, ...recent.map((x) => x.wcpm))) * 100)}%` }} /></div>)}
              </div>
              <ul className="mt-4 divide-y divide-border text-sm">
                {[...recent].reverse().slice(0, 5).map((h) => <li key={h.id} className="flex items-center justify-between gap-2 py-2"><span className="truncate" dir="auto">{h.title}</span><Badge tone="outline">{h.accuracy}%</Badge></li>)}
              </ul>
            </>
          )}
        </Card>
      </div>
    </Page>
  );
}
