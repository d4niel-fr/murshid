'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Flame, Heart, RotateCcw, Timer, Trophy, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildQuiz, checkAnswer, distractors, rng, shuffle, type Question } from '@murshid/study';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot } from '@/components/mascot/my-mascot';
import { isTyping } from '@/components/shell/shortcuts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { count, nAr } from '@/lib/plural';
import { study, useStudy, type Card } from '@/lib/study';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------- shared pieces */

export function ModeBar({ onEnd, done, total, right }: { onEnd: () => void; done: number; total: number; right?: React.ReactNode }) {
  const { tx } = useApp();
  return (
    <div className="mb-5 flex items-center gap-3">
      <button type="button" onClick={onEnd} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm"><X className="size-4" />{tx('End', 'إنهاء')}</button>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text)_8%,transparent)]" role="progressbar" aria-label={tx('Progress', 'التقدم')} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <motion.div className="h-full rounded-full bg-[var(--brand)]" animate={{ width: `${(done / Math.max(1, total)) * 100}%` }} />
      </div>
      {right}
    </div>
  );
}

function XpChip({ xp }: { xp: number }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--lime,#c2e029)_30%,transparent)] px-2.5 py-1 text-xs font-semibold tabular text-[#2f3a05] dark:text-[#e6f59a]"><Zap className="size-3.5" />{xp} XP</span>;
}

function Finish({ title, children, mood = 'happy', actions }: { title: string; children?: React.ReactNode; mood?: 'happy' | 'thinking'; actions: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-10 text-center">
      <span className="text-[var(--deep)]"><MyMascot size={120} mood={mood} /></span>
      <h2 className="display text-[2rem]">{title}</h2>
      {children}
      <div className="flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  );
}

const deckCards = (cards: Card[], deckId: string, only?: string | null) => cards.filter((c) => c.deckId === deckId && (only !== 'starred' || c.starred));

/** Multiple choice options for a card: the answer and up to three that look like it. */
function optionsFor(card: Card, pool: Card[], rand: () => number) {
  return shuffle([card.back, ...distractors(card, pool, 3, rand)], rand);
}

/** A typed answer with Murshid's verdict, and "I was right" for when the student knows better. */
function TypedAnswer({ card, onDone }: { card: Card; onDone: (correct: boolean) => void }) {
  const { tx } = useApp();
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<null | { v: 'right' | 'close' | 'wrong'; note?: string }>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setValue(''); setVerdict(null); setTimeout(() => input.current?.focus(), 30); }, [card.id]);
  const check = () => { if (!value.trim()) return; const r = checkAnswer(value, card.back); setVerdict({ v: r.verdict, note: r.note }); };
  return (
    <div className="flex flex-col gap-3">
      {!verdict ? (
        <form onSubmit={(e) => { e.preventDefault(); check(); }} className="flex gap-2">
          <Input ref={input} dir="auto" value={value} onChange={(e) => setValue(e.target.value)} aria-label={tx('Your answer', 'إجابتك')} placeholder={tx('Type the answer', 'اكتب الإجابة')} className="h-12 flex-1 text-base" autoComplete="off" />
          <Button type="submit" size="lg" disabled={!value.trim()}>{tx('Check', 'تحقق')}</Button>
          <Button type="button" size="lg" variant="ghost" onClick={() => setVerdict({ v: 'wrong' })}>{tx('Don’t know', 'لا أعرف')}</Button>
        </form>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('rounded-[20px] p-4', verdict.v === 'right' ? 'tint-success' : verdict.v === 'close' ? 'tint-warning' : 'tint-danger')}>
          <p className="font-medium">{verdict.v === 'right' ? (verdict.note === 'typo' ? tx('Right (watch the spelling)', 'صحيح (انتبه للإملاء)') : tx('Right!', 'صحيح!')) : verdict.v === 'close' ? tx('Close. Compare with the answer:', 'قريب. قارن بالإجابة:') : tx('Not quite. The answer:', 'ليس تماماً. الإجابة:')}</p>
          {verdict.v !== 'right' && <p dir="auto" className="mt-1 text-[0.9375rem]">{card.back}</p>}
          {value && verdict.v !== 'right' && <p dir="auto" className="mt-2 text-sm opacity-80">{tx('You wrote:', 'كتبت:')} {value}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {verdict.v === 'right' ? <Button autoFocus onClick={() => onDone(true)}>{tx('Next', 'التالي')}</Button> : <>
              <Button autoFocus onClick={() => onDone(false)}>{tx('Continue', 'متابعة')}</Button>
              <Button variant="secondary" onClick={() => onDone(true)}>{tx('I was right', 'كنت محقاً')}</Button>
            </>}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ChoiceList({ options, answer, picked, onPick }: { options: string[]; answer: string; picked: number | null; onPick: (i: number) => void }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (isTyping(e) || picked !== null) return; const n = Number(e.key); if (n >= 1 && n <= options.length) onPick(n - 1); };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  }, [options, picked, onPick]);
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {options.map((o, k) => {
        const state = picked === null ? 'idle' : o === answer ? 'right' : picked === k ? 'wrong' : 'idle';
        return (
          <li key={k}><button type="button" onClick={() => onPick(k)} disabled={picked !== null}
            className={cn('flex h-full min-h-14 w-full items-start gap-3 rounded-[18px] border px-4 py-3 text-start text-[0.9375rem] transition-colors', state === 'right' ? 'border-transparent tint-success' : state === 'wrong' ? 'border-transparent tint-danger' : 'border-border hover:border-foreground disabled:opacity-60')}>
            <kbd className="mt-0.5 rounded-md border border-current/20 px-1.5 text-[0.6875rem] pointer-coarse:hidden">{k + 1}</kbd><span dir="auto" className="flex-1">{o}</span>{state === 'right' && <Check className="size-4" />}
          </button></li>
        );
      })}
    </ol>
  );
}

function Prompt({ label, text, extra }: { label: string; text: string; extra?: React.ReactNode }) {
  return <div className="card mb-3 p-7"><p className="eyebrow">{label}</p><p dir="auto" className="mt-3 whitespace-pre-line text-[1.375rem] font-medium leading-snug">{text}</p>{extra}</div>;
}

/* ---------------------------------------------------------------- Learn: recognise, recall, master */

export function LearnMode({ deckId, only, onDone }: { deckId: string; only?: string | null; onDone: () => void }) {
  const { tx } = useApp();
  const s = useStudy();
  const all = useMemo(() => deckCards(s.cards, deckId, only), [s.cards, deckId, only]);
  const rand = useMemo(() => rng(Date.now()), []);
  const pickRound = useCallback(() => {
    const left = all.filter((c) => (c.learn ?? 0) < 3).sort((a, b) => (a.learn ?? 0) - (b.learn ?? 0) || a.due - b.due);
    return left.slice(0, 7).map((c) => c.id);
  }, [all]);
  const [round, setRound] = useState<string[]>(() => pickRound());
  const [roundNo, setRoundNo] = useState(1);
  const [pos, setPos] = useState(0);
  const [moved, setMoved] = useState(0);
  const [xp, setXp] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const cardId = round[pos];
  const card = all.find((c) => c.id === cardId);
  const stage = card?.learn ?? 0;
  const options = useMemo(() => (card && stage === 0 && all.length >= 2 ? optionsFor(card, all, rand) : []), [card?.id, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  const mastered = all.filter((c) => (c.learn ?? 0) >= 3).length;
  useEffect(() => { if (all.length && mastered === all.length) study.unlock('mastered'); }, [mastered, all.length]);

  const answered = (correct: boolean) => {
    if (!card) return;
    if (correct) {
      const next = Math.min(3, stage + 1) as 1 | 2 | 3;
      study.setLearn(card.id, next); setMoved((m) => m + 1);
      setXp((x) => x + 10); study.addXp(10);
      if (next === 3) study.grade(card.id, 2);
    } else {
      // it comes back at the end of this round
      setRound((r) => [...r, card.id]);
    }
    setPicked(null); setPos((p) => p + 1);
  };
  const pick = (i: number) => {
    if (picked !== null) return; setPicked(i);
    const ok = options[i] === card!.back;
    setTimeout(() => answered(ok), ok ? 550 : 1300);
  };

  if (!all.length) return <Finish title={tx('No cards to learn', 'لا بطاقات للتعلم')} mood="thinking" actions={<Button onClick={onDone}>{tx('Back', 'رجوع')}</Button>} />;
  if (mastered === all.length) {
    return (
      <Finish title={tx('Deck mastered', 'أتقنت المجموعة')} actions={<>
        <Button onClick={onDone}>{tx('Back to deck', 'العودة إلى المجموعة')}</Button>
        <Button variant="secondary" onClick={() => { study.resetLearn(deckId); setRound(all.slice(0, 7).map((c) => c.id)); setPos(0); setRoundNo(1); }}><RotateCcw />{tx('Learn again', 'تعلّم مجدداً')}</Button>
      </>}><p className="text-muted-foreground">{tx(`All ${all.length} cards recalled from memory. They now come back on a spaced schedule.`, `تذكرت كل البطاقات (${all.length}). ستعود الآن على جدول متباعد.`)}</p>{xp > 0 && <XpChip xp={xp} />}</Finish>
    );
  }
  if (!card) {
    return (
      <Finish title={tx(`Round ${roundNo} done`, `انتهت الجولة ${roundNo}`)} actions={<>
        <Button autoFocus onClick={() => { setRound(pickRound()); setPos(0); setMoved(0); setRoundNo((n) => n + 1); }}>{tx('Next round', 'الجولة التالية')}</Button>
        <Button variant="secondary" onClick={onDone}>{tx('Stop for now', 'توقف الآن')}</Button>
      </>}>
        <p className="text-muted-foreground">{tx(`${mastered} of ${all.length} mastered. ${moved} steps forward this round.`, `أتقنت ${mastered} من ${all.length}. ${moved} خطوات للأمام في هذه الجولة.`)}</p>
        <StageBar cards={all} />
        {xp > 0 && <XpChip xp={xp} />}
      </Finish>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <ModeBar onEnd={onDone} done={mastered} total={all.length} right={<XpChip xp={xp} />} />
      <p className="mb-2 text-xs font-medium text-muted-foreground">{stage === 0 ? tx('New: pick the answer', 'جديدة: اختر الإجابة') : stage === 1 ? tx('Now from memory: type it', 'الآن من الذاكرة: اكتبها') : tx('One more time to master it', 'مرة أخرى لإتقانها')}</p>
      <Prompt label={tx('Question', 'السؤال')} text={card.front} />
      {stage === 0 && options.length >= 2 ? <ChoiceList options={options} answer={card.back} picked={picked} onPick={pick} /> : <TypedAnswer card={card} onDone={answered} />}
      <StageBar cards={all} className="mt-6" />
    </div>
  );
}

function StageBar({ cards, className }: { cards: Card[]; className?: string }) {
  const { tx } = useApp();
  const n = [0, 1, 2, 3].map((st) => cards.filter((c) => (c.learn ?? 0) === st).length);
  const labels = [tx('New', 'جديدة'), tx('Recognised', 'تعرّفت'), tx('Recalled', 'تذكّرت'), tx('Mastered', 'متقنة')];
  const colors = ['var(--surface-2)', 'color-mix(in oklab, var(--brand) 35%, transparent)', 'color-mix(in oklab, var(--brand) 65%, transparent)', 'var(--brand)'];
  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full">{n.map((v, i) => v > 0 && <span key={i} style={{ width: `${(v / cards.length) * 100}%`, background: colors[i] }} />)}</div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">{n.map((v, i) => <span key={i} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: colors[i] }} />{labels[i]} {v}</span>)}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- Write: type every answer */

export function WriteMode({ deckId, only, onDone }: { deckId: string; only?: string | null; onDone: () => void }) {
  const { tx } = useApp();
  const s = useStudy();
  const [queue] = useState(() => shuffle(deckCards(s.cards, deckId, only), rng(Date.now())).map((c) => c.id));
  const [i, setI] = useState(0); const [right, setRight] = useState(0); const [missed, setMissed] = useState<string[]>([]);
  const card = s.cards.find((c) => c.id === queue[i]);
  const done = (ok: boolean) => {
    if (!card) return;
    if (ok) { setRight((r) => r + 1); study.addXp(8); } else setMissed((m) => [...m, card.id]);
    setI((x) => x + 1);
  };
  if (!card) {
    return (
      <Finish title={`${right} / ${queue.length}`} mood={right >= queue.length * 0.7 ? 'happy' : 'thinking'} actions={<>
        <Button onClick={() => { study.dueNow(missed); onDone(); }}>{tx('Done', 'تم')}</Button>
        {missed.length > 0 && <Button variant="secondary" asChild><Link href={`/app/study/flashcards/${deckId}?mode=learn`}>{tx('Learn the missed ones', 'تعلّم ما فاتك')}</Link></Button>}
      </>}><p className="text-muted-foreground">{missed.length ? tx(`${count(missed.length, 'card')} to practise. They are due now, so they come back first.`, `${nAr(missed.length, 'card')} للتدرب. صارت مستحقة لتعود أولاً.`) : tx('Every answer from memory. Excellent.', 'كل الإجابات من الذاكرة. ممتاز.')}</p></Finish>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <ModeBar onEnd={onDone} done={i} total={queue.length} right={<span className="tabular text-sm text-muted-foreground">{i + 1}/{queue.length}</span>} />
      <Prompt label={tx('Write the answer', 'اكتب الإجابة')} text={card.front} />
      <TypedAnswer card={card} onDone={done} />
    </div>
  );
}

/* ---------------------------------------------------------------- Match: pair terms against the clock */

type Tile = { id: string; cardId: string; text: string; side: 'f' | 'b' };
export function MatchMode({ deckId, onDone }: { deckId: string; onDone: () => void }) {
  const { tx } = useApp();
  const s = useStudy();
  const deck = s.decks.find((d) => d.id === deckId);
  const build = useCallback(() => {
    const rand = rng(Date.now());
    const pick = shuffle(deckCards(s.cards, deckId), rand).slice(0, 6);
    const short = (t: string) => (t.length > 90 ? `${t.slice(0, 87)}…` : t);
    return shuffle(pick.flatMap((c): Tile[] => [{ id: `${c.id}f`, cardId: c.id, text: short(c.front), side: 'f' }, { id: `${c.id}b`, cardId: c.id, text: short(c.back), side: 'b' }]), rand);
  }, [s.cards, deckId]);
  const [tiles, setTiles] = useState<Tile[]>(() => build());
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [start, setStart] = useState(() => Date.now());
  const [penalty, setPenalty] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  useEffect(() => { if (finished !== null) return; const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, [finished]);
  const tap = (t: Tile) => {
    if (gone.has(t.id) || finished !== null) return;
    if (!sel) { setSel(t.id); return; }
    if (sel === t.id) { setSel(null); return; }
    const a = tiles.find((x) => x.id === sel)!;
    if (a.cardId === t.cardId && a.side !== t.side) {
      const next = new Set(gone); next.add(a.id); next.add(t.id); setGone(next); setSel(null);
      if (next.size === tiles.length) {
        const ms = Date.now() - start + penalty; setFinished(ms);
        setRecord(study.best(deckId, 'match', ms)); study.addXp(20);
        if (ms < 25_000) study.unlock('speedy');
      }
    } else { setWrong([a.id, t.id]); setPenalty((p) => p + 1000); setSel(null); setTimeout(() => setWrong([]), 450); }
  };
  const secs = ((finished ?? now - start + penalty) / 1000).toFixed(1);
  if (tiles.length < 6) return <Finish title={tx('Add a few more cards', 'أضف بطاقات أكثر')} mood="thinking" actions={<Button onClick={onDone}>{tx('Back', 'رجوع')}</Button>}><p className="text-muted-foreground">{tx('Match needs at least 3 cards.', 'تحتاج المطابقة 3 بطاقات على الأقل.')}</p></Finish>;
  if (finished !== null) {
    return (
      <Finish title={tx(`${secs} seconds`, `${secs} ثانية`)} actions={<>
        <Button autoFocus onClick={() => { setTiles(build()); setGone(new Set()); setStart(Date.now()); setPenalty(0); setFinished(null); setRecord(false); }}><RotateCcw />{tx('Play again', 'العب مجدداً')}</Button>
        <Button variant="secondary" onClick={onDone}>{tx('Back to deck', 'العودة إلى المجموعة')}</Button>
      </>}>
        <p className="text-muted-foreground">{record ? tx('A new personal best!', 'رقم شخصي جديد!') : deck?.best?.match ? tx(`Your best: ${(deck.best.match / 1000).toFixed(1)} s`, `أفضل وقت لك: ${(deck.best.match / 1000).toFixed(1)} ث`) : ''}{penalty ? tx(` Includes ${penalty / 1000} s for wrong pairs.`, ` يشمل ${penalty / 1000} ث للأزواج الخاطئة.`) : ''}</p>
        <XpChip xp={20} />
      </Finish>
    );
  }
  return (
    <div className="mx-auto max-w-3xl">
      <ModeBar onEnd={onDone} done={gone.size / 2} total={tiles.length / 2} right={<span className="inline-flex items-center gap-1 tabular text-sm font-medium"><Timer className="size-4" />{tx(`${secs}s`, `${secs} ث`)}</span>} />
      <p className="mb-3 text-sm text-muted-foreground">{tx('Tap a term, then its meaning. A wrong pair adds a second.', 'انقر مصطلحاً ثم معناه. الزوج الخاطئ يضيف ثانية.')}</p>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
        <AnimatePresence>
          {tiles.map((t) => !gone.has(t.id) && (
            <motion.li key={t.id} layout exit={{ opacity: 0, scale: 0.85 }} animate={wrong.includes(t.id) ? { x: [0, -6, 6, -4, 0] } : { x: 0 }}>
              <button type="button" onClick={() => tap(t)} aria-pressed={sel === t.id}
                className={cn('flex h-28 w-full items-center justify-center rounded-[18px] border p-3 text-center text-sm leading-snug transition-colors', sel === t.id ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : wrong.includes(t.id) ? 'border-transparent tint-danger' : t.side === 'f' ? 'border-border bg-surface font-medium hover:border-foreground' : 'border-border hover:border-foreground')}>
                <span dir="auto" className="line-clamp-4">{t.text}</span>
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- Test: mixed questions, marked at the end */

type TType = 'mc' | 'tf' | 'type' | 'blank';
interface TQ extends Question { kind: TType; blankText?: string; blankAnswer?: string }

/** A fill-in-the-blank version of a card: the longest key word of the answer becomes the gap. */
function blankOf(c: Card): { text: string; answer: string } | null {
  const ws = c.back.split(/\s+/);
  if (ws.length < 4) return null;
  let best = -1;
  ws.forEach((w, i) => { const clean = w.replace(/[^\p{L}\p{N}-]/gu, ''); if (clean.length >= 5 && (best < 0 || clean.length > ws[best]!.replace(/[^\p{L}\p{N}-]/gu, '').length)) best = i; });
  if (best < 0) return null;
  const answer = ws[best]!.replace(/[^\p{L}\p{N}-]/gu, '');
  return { text: ws.map((w, i) => (i === best ? w.replace(answer, '_____') : w)).join(' '), answer };
}

export function TestMode({ deckId, only, onDone }: { deckId: string; only?: string | null; onDone: () => void }) {
  const { tx } = useApp();
  const s = useStudy();
  const cards = useMemo(() => deckCards(s.cards, deckId, only), [s.cards, deckId, only]);
  const [setup, setSetup] = useState(true);
  const [n, setN] = useState(Math.min(10, cards.length));
  const [types, setTypes] = useState<TType[]>(['mc', 'tf', 'type', 'blank']);
  const [qs, setQs] = useState<TQ[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [i, setI] = useState(0);
  const [marked, setMarked] = useState<null | { ok: boolean[] }>(null);
  const begin = () => {
    const base = buildQuiz(cards, { count: n, types: types.map((t) => (t === 'blank' ? 'type' : t)) as ('mc' | 'tf' | 'type')[], seed: Date.now() });
    const out: TQ[] = base.map((q, k) => {
      const want = types[k % types.length]!;
      if (want === 'blank') { const c = cards.find((x) => x.id === q.cardId)!; const b = blankOf(c); if (b) return { ...q, kind: 'blank', blankText: b.text, blankAnswer: b.answer }; }
      return { ...q, kind: q.type };
    });
    setQs(out); setAnswers({}); setI(0); setMarked(null); setSetup(false);
  };
  const correct = (q: TQ, a: string | undefined) => {
    if (a === undefined || a === '') return false;
    if (q.kind === 'mc') return a === q.answer;
    if (q.kind === 'tf') return (a === 'true') === q.truth;
    if (q.kind === 'blank') return checkAnswer(a, q.blankAnswer!).verdict === 'right';
    return checkAnswer(a, q.answer).verdict === 'right';
  };
  const submit = () => {
    const ok = qs.map((q, k) => correct(q, answers[k]));
    const score = ok.filter(Boolean).length;
    setMarked({ ok }); study.logQuiz(deckId, score, qs.length); study.addXp(score * 6);
    study.dueNow(qs.filter((_, k) => !ok[k]).map((q) => q.cardId));
  };
  if (cards.length < 2) return <Finish title={tx('Add a few more cards', 'أضف بطاقات أكثر')} mood="thinking" actions={<Button onClick={onDone}>{tx('Back', 'رجوع')}</Button>} />;
  if (setup) {
    const all: [TType, string][] = [['mc', tx('Multiple choice', 'اختيار من متعدد')], ['tf', tx('True or false', 'صح أو خطأ')], ['type', tx('Written', 'كتابي')], ['blank', tx('Fill the blank', 'املأ الفراغ')]];
    return (
      <div className="mx-auto max-w-lg">
        <ModeBar onEnd={onDone} done={0} total={1} />
        <div className="card flex flex-col gap-5 p-6">
          <h2 className="display text-[1.75rem]">{tx('Practice test', 'اختبار تدريبي')}</h2>
          <p className="text-sm text-muted-foreground">{tx('No hints while you answer; it is marked at the end, like the real thing.', 'لا تلميحات أثناء الإجابة؛ يُصحح في النهاية كالاختبار الحقيقي.')}</p>
          <fieldset><legend className="mb-2 text-sm font-medium">{tx('Questions', 'الأسئلة')}</legend>
            <div className="flex flex-wrap gap-2">{[5, 10, 20, cards.length].filter((x, k, a) => x <= cards.length && a.indexOf(x) === k).map((x) => <button key={x} type="button" aria-pressed={n === x} onClick={() => setN(x)} className={cn('h-10 rounded-full px-4 text-sm', n === x ? 'bg-[var(--deep)] text-white' : 'bg-surface')}>{x === cards.length ? tx(`All ${x}`, `الكل ${x}`) : x}</button>)}</div>
          </fieldset>
          <fieldset><legend className="mb-2 text-sm font-medium">{tx('Question types', 'أنواع الأسئلة')}</legend>
            <div className="grid grid-cols-2 gap-2">{all.map(([t, l]) => <label key={t} className="flex min-h-11 items-center gap-2.5 rounded-2xl bg-surface px-3 text-sm"><input type="checkbox" className="size-4 accent-[var(--deep)]" checked={types.includes(t)} onChange={(e) => setTypes((x) => (e.target.checked ? [...x, t] : x.filter((y) => y !== t)))} />{l}</label>)}</div>
          </fieldset>
          <Button size="lg" disabled={!types.length} onClick={begin}>{tx('Start the test', 'ابدأ الاختبار')}</Button>
        </div>
      </div>
    );
  }
  if (marked) {
    const score = marked.ok.filter(Boolean).length; const pct = Math.round((score / qs.length) * 100);
    return (
      <div className="mx-auto max-w-2xl py-6">
        <Finish title={`${pct}%`} mood={pct >= 70 ? 'happy' : 'thinking'} actions={<>
          <Button onClick={onDone}>{tx('Done', 'تم')}</Button>
          <Button variant="secondary" onClick={() => setSetup(true)}><RotateCcw />{tx('New test', 'اختبار جديد')}</Button>
        </>}><p className="text-muted-foreground">{tx(`${score} of ${qs.length} right. Missed cards are due now.`, `${score} من ${qs.length} صحيحة. صارت البطاقات الفائتة مستحقة.`)}</p><XpChip xp={score * 6} /></Finish>
        <ol className="flex flex-col gap-2">
          {qs.map((q, k) => (
            <li key={k} className={cn('rounded-2xl p-4 text-sm', marked.ok[k] ? 'bg-surface' : 'tint-danger')}>
              <p className="flex items-start gap-2 font-medium">{marked.ok[k] ? <Check className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0" />}<span dir="auto">{q.kind === 'blank' ? q.blankText : q.prompt}</span></p>
              {q.kind === 'tf' && <p dir="auto" className="mt-1 ps-6 opacity-80">“{q.statement}” · {q.truth ? tx('True', 'صح') : tx('False', 'خطأ')}</p>}
              {!marked.ok[k] && <p dir="auto" className="mt-1 ps-6">{tx('Answer:', 'الإجابة:')} {q.kind === 'blank' ? q.blankAnswer : q.answer}{answers[k] && q.kind !== 'tf' ? ` · ${tx('you:', 'أنت:')} ${answers[k]}` : ''}</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  const q = qs[i]!;
  const set = (v: string) => setAnswers((a) => ({ ...a, [i]: v }));
  return (
    <div className="mx-auto max-w-2xl">
      <ModeBar onEnd={onDone} done={Object.keys(answers).length} total={qs.length} right={<span className="tabular text-sm text-muted-foreground">{i + 1}/{qs.length}</span>} />
      {q.kind === 'blank' ? <Prompt label={tx('Fill the blank', 'املأ الفراغ')} text={q.blankText!} extra={<p dir="auto" className="mt-3 text-sm text-muted-foreground">{q.prompt}</p>} />
        : q.kind === 'tf' ? <Prompt label={tx('True or false?', 'صح أم خطأ؟')} text={q.prompt} extra={<p dir="auto" className="mt-4 rounded-2xl bg-surface p-4 text-[1.0625rem]">{q.statement}</p>} />
        : <Prompt label={q.kind === 'mc' ? tx('Pick the answer', 'اختر الإجابة') : tx('Write the answer', 'اكتب الإجابة')} text={q.prompt} />}
      {q.kind === 'mc' && <ol className="grid gap-2 sm:grid-cols-2">{q.options!.map((o, k) => <li key={k}><button type="button" aria-pressed={answers[i] === o} onClick={() => set(o)} className={cn('flex min-h-14 w-full items-start gap-3 rounded-[18px] border px-4 py-3 text-start text-[0.9375rem]', answers[i] === o ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-border hover:border-foreground')}><kbd className="mt-0.5 rounded-md border border-current/20 px-1.5 text-[0.6875rem] pointer-coarse:hidden">{k + 1}</kbd><span dir="auto">{o}</span></button></li>)}</ol>}
      {q.kind === 'tf' && <div className="grid grid-cols-2 gap-2">{(['true', 'false'] as const).map((v) => <button key={v} type="button" aria-pressed={answers[i] === v} onClick={() => set(v)} className={cn('h-14 rounded-[18px] border text-base font-medium', answers[i] === v ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-border hover:border-foreground')}>{v === 'true' ? tx('True', 'صح') : tx('False', 'خطأ')}</button>)}</div>}
      {(q.kind === 'type' || q.kind === 'blank') && <Input dir="auto" value={answers[i] ?? ''} onChange={(e) => set(e.target.value)} aria-label={tx('Your answer', 'إجابتك')} placeholder={tx('Type your answer', 'اكتب إجابتك')} className="h-12 text-base" autoFocus />}
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{tx('Back', 'السابق')}</Button>
        {i + 1 < qs.length ? <Button onClick={() => setI(i + 1)}>{tx('Next', 'التالي')}</Button> : <Button onClick={submit}>{tx(`Submit (${Object.keys(answers).length}/${qs.length} answered)`, `سلّم (${Object.keys(answers).length}/${qs.length})`)}</Button>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Challenge: three lives, a clock and combos */

export function ChallengeMode({ deckId, onDone }: { deckId: string; onDone: () => void }) {
  const { tx } = useApp();
  const s = useStudy();
  const cards = useMemo(() => deckCards(s.cards, deckId), [s.cards, deckId]);
  const deck = s.decks.find((d) => d.id === deckId);
  const LIMIT = 12;
  const make = useCallback(() => buildQuiz(cards, { count: cards.length, types: ['mc', 'tf', 'mc'], seed: Date.now() }), [cards]);
  const [qs, setQs] = useState<Question[]>(() => make());
  const [i, setI] = useState(0); const [lives, setLives] = useState(3); const [combo, setCombo] = useState(0); const [points, setPoints] = useState(0);
  const [picked, setPicked] = useState<string | null>(null); const [left, setLeft] = useState(LIMIT); const [over, setOver] = useState(false); const [record, setRecord] = useState(false);
  const q = qs[i];
  const end = (pts: number) => { setOver(true); setRecord(study.best(deckId, 'challenge', pts)); study.addXp(pts); if (pts >= 15) study.unlock('survivor'); };
  const answer = (v: string | null) => {
    if (!q || picked !== null) return;
    setPicked(v ?? '__timeout');
    const ok = v !== null && (q.type === 'mc' ? v === q.answer : (v === 'true') === q.truth);
    const nextCombo = ok ? combo + 1 : 0; const mult = nextCombo >= 6 ? 3 : nextCombo >= 3 ? 2 : 1;
    const pts = points + (ok ? mult : 0); const lv = ok ? lives : lives - 1;
    setCombo(nextCombo); setPoints(pts); setLives(lv);
    setTimeout(() => {
      setPicked(null); setLeft(LIMIT);
      if (lv <= 0) return end(pts);
      if (i + 1 >= qs.length) { setQs(make()); setI(0); } else setI(i + 1);
    }, ok ? 500 : 1200);
  };
  useEffect(() => {
    if (over || picked !== null || !q) return;
    if (left <= 0) { answer(null); return; }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000); return () => clearTimeout(t);
  }); // ticks once a second while a question is open
  if (cards.length < 3) return <Finish title={tx('Add a few more cards', 'أضف بطاقات أكثر')} mood="thinking" actions={<Button onClick={onDone}>{tx('Back', 'رجوع')}</Button>}><p className="text-muted-foreground">{tx('Challenge needs at least 3 cards.', 'يحتاج التحدي 3 بطاقات على الأقل.')}</p></Finish>;
  if (over || !q) {
    return (
      <Finish title={tx(`${points} points`, nAr(points, 'point'))} mood={points >= 10 ? 'happy' : 'thinking'} actions={<>
        <Button autoFocus onClick={() => { setQs(make()); setI(0); setLives(3); setCombo(0); setPoints(0); setLeft(LIMIT); setOver(false); setRecord(false); }}><RotateCcw />{tx('Play again', 'العب مجدداً')}</Button>
        <Button variant="secondary" onClick={onDone}>{tx('Back to deck', 'العودة إلى المجموعة')}</Button>
      </>}><p className="text-muted-foreground">{record ? tx('A new personal best!', 'رقم شخصي جديد!') : deck?.best?.challenge !== undefined ? tx(`Your best: ${deck.best.challenge}`, `أفضل نتيجة: ${deck.best.challenge}`) : ''}</p><XpChip xp={points} /></Finish>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={onDone} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm"><X className="size-4" />{tx('End', 'إنهاء')}</button>
        <span className="flex gap-1" aria-label={tx(`${lives} lives left`, `${lives} محاولات متبقية`)}>{[0, 1, 2].map((k) => <Heart key={k} className={cn('size-5', k < lives ? 'fill-[var(--danger)] text-[var(--danger)]' : 'text-muted-foreground opacity-40')} />)}</span>
        <span className="flex-1" />
        {combo >= 3 && <span className="inline-flex items-center gap-1 rounded-full tint-warning px-2.5 py-1 text-xs font-semibold"><Flame className="size-3.5" />×{combo >= 6 ? 3 : 2}</span>}
        <span className="inline-flex items-center gap-1 tabular text-sm font-semibold"><Trophy className="size-4" />{points}</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text)_8%,transparent)]"><motion.div key={`${i}-${qs.length}`} className={cn('h-full rounded-full', left <= 3 ? 'bg-[var(--danger)]' : 'bg-[var(--brand)]')} initial={{ width: '100%' }} animate={{ width: '0%' }} transition={{ duration: LIMIT, ease: 'linear' }} /></div>
      {q.type === 'mc' ? <>
        <Prompt label={tx('Quick: pick the answer', 'بسرعة: اختر الإجابة')} text={q.prompt} />
        <ChoiceList options={q.options!} answer={q.answer} picked={picked === null ? null : q.options!.indexOf(picked)} onPick={(k) => answer(q.options![k]!)} />
      </> : <>
        <Prompt label={tx('Quick: true or false?', 'بسرعة: صح أم خطأ؟')} text={q.prompt} extra={<p dir="auto" className="mt-4 rounded-2xl bg-surface p-4 text-[1.0625rem]">{q.statement}</p>} />
        <div className="grid grid-cols-2 gap-2">{(['true', 'false'] as const).map((v) => {
          const isRight = (v === 'true') === q.truth;
          return <button key={v} type="button" disabled={picked !== null} onClick={() => answer(v)} className={cn('h-14 rounded-[18px] border text-base font-medium', picked === null ? 'border-border hover:border-foreground' : isRight ? 'border-transparent tint-success' : picked === v ? 'border-transparent tint-danger' : 'border-border opacity-60')}>{v === 'true' ? tx('True', 'صح') : tx('False', 'خطأ')}</button>;
        })}</div>
      </>}
    </div>
  );
}
