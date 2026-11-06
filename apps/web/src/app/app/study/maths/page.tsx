'use client';

import { Check, ChevronLeft, Lightbulb, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { isRight, makeQuestion, nextLevel, practice, SKILLS, usePractice, type Skill } from '@/lib/practice';
import { cn } from '@/lib/utils';

const ROUND = 10;

/** Maths practice that adapts: ten questions, the level moves with you, every mistake shows the working. */
export default function MathsPage() {
  const { tx, locale } = useApp();
  const p = usePractice();
  const [skill, setSkill] = useState<Skill | null>(null);
  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Maths practice', 'تدريب الرياضيات')}
        subtitle={tx('Ten questions at a time. Three right in a row moves you up a level; a slip shows the working so you can see where it went wrong.', 'عشرة أسئلة في كل مرة. ثلاث إجابات صحيحة متتالية ترفع مستواك؛ والخطأ يعرض طريقة الحل لترى أين أخطأت.')} />
      {skill ? <Round skill={skill} start={p.levels[skill] ?? 1} onExit={() => setSkill(null)} /> : (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-8">
            {SKILLS.map((s) => {
              const runs = p.maths.filter((m) => m.skill === s.id);
              const last = runs.at(-1);
              return (
                <button key={s.id} onClick={() => setSkill(s.id)} className="lift card flex min-h-32 flex-col items-start p-4 text-start">
                  <span className="text-sm font-medium">{locale === 'ar' ? s.ar : s.en}</span>
                  <span className="mt-auto flex w-full items-center justify-between pt-4 text-xs text-muted-foreground">
                    <span>{tx(`Level ${p.levels[s.id] ?? 1}`, `المستوى ${p.levels[s.id] ?? 1}`)}</span>
                    {last && <span className="tabular-nums">{last.correct}/{last.total}</span>}
                  </span>
                  <span className="mt-1.5 flex w-full gap-0.5">{[1, 2, 3, 4, 5].map((l) => <span key={l} className={cn('h-1 flex-1 rounded-full', l <= (p.levels[s.id] ?? 1) ? 'bg-[var(--brand)]' : 'bg-surface-2')} />)}</span>
                </button>
              );
            })}
          </div>
          <Card className="col-span-12 lg:col-span-4">
            <CardHeader title={tx('Mistakes to look at again', 'أخطاء تستحق المراجعة')} />
            {(() => {
              const m = p.maths.flatMap((r) => r.mistakes.map((x) => ({ ...x, at: r.at }))).slice(-6).reverse();
              return !m.length ? <Muted>{tx('None yet. Pick a skill to start.', 'لا شيء بعد. اختر مهارة لتبدأ.')}</Muted> : (
                <ul className="divide-y divide-border text-sm">{m.map((x, i) => <li key={i} className="flex items-center justify-between gap-3 py-2" dir="ltr"><span className="font-medium">{x.prompt}</span><span className="text-xs text-muted-foreground"><s>{x.given}</s> → <b className="text-foreground">{x.answer}</b></span></li>)}</ul>
              );
            })()}
          </Card>
        </div>
      )}
    </Page>
  );
}

function Round({ skill, start, onExit }: { skill: Skill; start: number; onExit: () => void }) {
  const { tx, locale } = useApp();
  const [level, setLevel] = useState(start);
  const [n, setN] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState<null | boolean>(null);
  const [hint, setHint] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  // answers since the level last changed (so one streak moves it once)
  const [since, setSince] = useState(0);
  const [mistakes, setMistakes] = useState<{ prompt: string; answer: string; given: string }[]>([]);
  const t0 = useRef(Date.now());
  const input = useRef<HTMLInputElement>(null);
  const q = useMemo(() => makeQuestion(skill, level, seed), [skill, level, seed]);
  const done = n >= ROUND;
  useEffect(() => { if (!done && checked === null) input.current?.focus(); }, [n, checked, done]);

  const check = () => {
    if (!answer.trim() || checked !== null) return;
    const ok = isRight(q, answer);
    setChecked(ok);
    const next = [...results, ok]; setResults(next);
    if (!ok) setMistakes((m) => [...m, { prompt: q.prompt, answer: q.answerText, given: answer.trim() }]);
  };
  const advance = () => {
    const lv = nextLevel(level, results.slice(since));
    if (lv !== level) setSince(results.length);
    const count = n + 1;
    if (count >= ROUND) {
      practice.addMaths({ skill, level: lv, correct: results.filter(Boolean).length, total: results.length, seconds: Math.round((Date.now() - t0.current) / 1000), mistakes });
    }
    setLevel(lv); setN(count); setSeed((s) => s + 7919); setAnswer(''); setChecked(null); setHint(false);
  };
  const again = () => { setN(0); setResults([]); setSince(0); setMistakes([]); setSeed(Math.floor(Math.random() * 1e9)); t0.current = Date.now(); setChecked(null); setAnswer(''); };
  const name = SKILLS.find((s) => s.id === skill)!;

  if (done) {
    const right = results.filter(Boolean).length;
    return (
      <Card className="mx-auto w-full max-w-xl p-6 text-center sm:p-8">
        <p className="eyebrow">{locale === 'ar' ? name.ar : name.en}</p>
        <p className="mt-3 text-5xl font-medium tabular-nums">{right}/{results.length}</p>
        <p className="mt-2 text-sm text-muted-foreground">{right >= 9 ? tx('Excellent. The next round starts a level up.', 'ممتاز. الجولة القادمة تبدأ بمستوى أعلى.') : right >= 6 ? tx('Solid work. Look over the mistakes, then go again.', 'عمل جيد. راجع الأخطاء ثم أعد المحاولة.') : tx('Keep going: the level has eased so you can build up.', 'استمر: خُفّض المستوى لتبني ثقتك.')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{tx(`Now at level ${level}`, `المستوى الآن ${level}`)}</p>
        {mistakes.length > 0 && <ul className="mt-5 divide-y divide-border text-start text-sm">{mistakes.map((m, i) => <li key={i} className="flex justify-between gap-3 py-2" dir="ltr"><span className="font-medium">{m.prompt}</span><span className="text-muted-foreground"><s>{m.given}</s> → <b className="text-foreground">{m.answer}</b></span></li>)}</ul>}
        <div className="mt-6 flex justify-center gap-2"><Button onClick={again}><RotateCcw className="size-4" />{tx('Another round', 'جولة أخرى')}</Button><Button variant="secondary" onClick={onExit}>{tx('Pick a skill', 'اختر مهارة')}</Button></div>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button onClick={onExit} className="inline-flex h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="size-4 rtl:rotate-180" />{locale === 'ar' ? name.ar : name.en}</button>
        <Badge tone="outline">{tx(`Level ${level}`, `المستوى ${level}`)}</Badge>
      </div>
      <div className="mb-4 flex gap-1">{Array.from({ length: ROUND }, (_, i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < results.length ? (results[i] ? 'bg-[var(--success)]' : 'bg-[var(--danger)]') : i === n ? 'bg-[var(--brand)]' : 'bg-surface-2')} />)}</div>
      <Card className="p-6 sm:p-8">
        <p className="text-center text-4xl font-medium tracking-[-0.02em] tabular-nums sm:text-5xl" dir="ltr">{q.prompt}{skill === 'equations' ? '' : ' ='}</p>
        {skill === 'equations' && <p className="mt-2 text-center text-sm text-muted-foreground">{tx('Find x', 'أوجد x')}</p>}
        <form onSubmit={(e) => { e.preventDefault(); if (checked === null) check(); else advance(); }} className="mt-6 flex gap-2">
          <input ref={input} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={checked !== null} inputMode={q.fraction ? 'text' : 'decimal'} autoComplete="off" dir="ltr" aria-label={tx('Your answer', 'إجابتك')} placeholder={q.fraction ? tx('e.g. 3/4', 'مثل 3/4') : '?'}
            className={cn('h-14 min-w-0 flex-1 rounded-full border bg-transparent px-5 text-center text-2xl tabular-nums outline-none focus:border-[var(--brand-light)]', checked === true && 'border-[var(--success)]', checked === false && 'border-[var(--danger)]')} />
          <Button type="submit" className="h-14 px-6" disabled={!answer.trim() && checked === null}>{checked === null ? tx('Check', 'تحقق') : n + 1 >= ROUND ? tx('Finish', 'إنهاء') : tx('Next', 'التالي')}</Button>
        </form>
        {checked !== null && (
          <div className={cn('mt-4 rounded-[18px] px-4 py-3 text-sm', checked ? 'tint-success' : 'tint-danger')} role="status">
            <p className="flex items-center gap-2 font-medium">{checked ? <><Check className="size-4" />{tx('Right!', 'صحيح!')}</> : <><X className="size-4" />{tx(`Not quite: it is ${q.answerText}`, `ليس تماماً: الإجابة ${q.answerText}`)}</>}</p>
            {!checked && <ol className="mt-2 list-decimal space-y-1 ps-5" dir="ltr">{q.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>}
          </div>
        )}
        {checked === null && (hint ? <p className="mt-4 rounded-[18px] bg-surface px-4 py-3 text-sm" dir="ltr">{q.steps[0]}</p>
          : <button type="button" onClick={() => setHint(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary"><Lightbulb className="size-4" />{tx('Show a hint', 'أظهر تلميحاً')}</button>)}
      </Card>
    </div>
  );
}
