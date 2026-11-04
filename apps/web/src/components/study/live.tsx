'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Copy, Crown, Loader2, Play, Radio, SkipForward, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { buildQuiz } from '@murshid/study';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot } from '@/components/mascot/my-mascot';
import { Page, PageHeader } from '@/components/shared/page';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { ApiError, request } from '@/lib/http';
import { nAr } from '@/lib/plural';
import { study, useStudy } from '@/lib/study';
import { cn } from '@/lib/utils';

interface LiveState {
  code: string; title: string; status: 'lobby' | 'question' | 'reveal' | 'done'; index: number; total: number; seconds: number; remainingMs: number;
  question: { prompt: string; options: string[]; answer?: number; counts?: number[] | null } | null;
  players: number; answered: number; leaderboard: { rank: number; name: string; score: number }[] | null; lobby?: string[];
  me?: { name: string; score: number; rank: number; answer: { choice: number; points: number; correct?: boolean } | null };
}
const COLORS = ['bg-[#2563c9]', 'bg-[#c2410c]', 'bg-[#15803d]', 'bg-[#7c3aed]'];
const SHAPES = ['▲', '◆', '●', '■'];

/** Poll a room every second while the screen is open. */
function usePoll(code: string | null, query: string, onState: (s: LiveState) => void, onGone?: (why: 'ended' | 'removed') => void) {
  const cb = useRef(onState); cb.current = onState;
  const gone = useRef(onGone); gone.current = onGone;
  useEffect(() => {
    if (!code) return;
    let live = true; let t: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      try { const s = await request<LiveState>(`/live/rooms/${code}?${query}`, { timeoutMs: 4000, retries: 0 }); if (live) cb.current(s); if (s.status === 'done') clearInterval(t); }
      catch (e) {
        // a room that no longer exists (ended, or the server restarted) or a player the host removed: stop asking
        if (e instanceof ApiError && (e.status === 404 || e.status === 410)) { clearInterval(t); if (live) gone.current?.(e.status === 410 ? 'removed' : 'ended'); }
      }
    };
    void tick(); t = setInterval(tick, 1000);
    return () => { live = false; clearInterval(t); };
  }, [code, query]);
}

function Countdown({ ms, total }: { ms: number; total: number }) {
  const [left, setLeft] = useState(ms);
  useEffect(() => { setLeft(ms); const start = Date.now(); const t = setInterval(() => setLeft(Math.max(0, ms - (Date.now() - start))), 100); return () => clearInterval(t); }, [ms]);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><div className={cn('h-full rounded-full transition-[width] duration-100', left < 5000 ? 'bg-[var(--danger)]' : 'bg-[var(--brand)]')} style={{ width: `${(left / (total * 1000)) * 100}%` }} /></div>
      <span className="w-8 text-end text-lg font-semibold tabular">{Math.ceil(left / 1000)}</span>
    </div>
  );
}

function Board({ rows, me }: { rows: LiveState['leaderboard']; me?: string }) {
  const { tx } = useApp();
  if (!rows?.length) return null;
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <motion.li layout key={r.name} className={cn('flex items-center gap-3 rounded-2xl px-4 py-3', r.name === me ? 'bg-[var(--deep)] text-white' : 'bg-surface')}>
          <span className="w-6 text-center font-semibold tabular">{r.rank === 1 ? <Crown className="mx-auto size-4" /> : r.rank}</span>
          <span className="flex-1 font-medium"><bdi>{r.name}</bdi>{r.name === me ? ` (${tx('you', 'أنت')})` : ''}</span>
          <span className="tabular">{r.score.toLocaleString('en-US')}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------------- host */

export function LiveHost() {
  const { tx, toast } = useApp();
  const s = useStudy();
  const params = useSearchParams();
  const deck = s.decks.find((d) => d.id === params.get('deck'));
  const cards = s.cards.filter((c) => c.deckId === deck?.id);
  const [room, setRoom] = useState<{ code: string; hostKey: string } | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [howMany, setHowMany] = useState<'5' | '10' | '15' | 'all'>('10');
  const [seconds, setSeconds] = useState<'10' | '20' | '30'>('20');
  usePoll(room?.code ?? null, `host=${room?.hostKey ?? ''}`, setState, () => { setRoom(null); setState(null); setError(tx('That room has closed. Open a new one to play again.', 'أُغلقت تلك الغرفة. افتح غرفة جديدة للعب مرة أخرى.')); });
  // a count the deck cannot fill falls back to all of it
  const pick = howMany === 'all' || Number(howMany) < cards.length ? howMany : 'all';
  const total = Math.min(40, cards.length, pick === 'all' ? 40 : Number(pick));

  const open = async () => {
    if (!deck) return; setBusy(true); setError(null);
    const qs = buildQuiz(cards, { count: total, types: ['mc'], seed: Date.now() }).map((q) => ({ prompt: q.prompt.slice(0, 300), options: q.options!.map((o) => o.slice(0, 200)), answer: q.options!.indexOf(q.answer) }));
    try {
      const r = await request<{ code: string; hostKey: string; state: LiveState }>('/live/rooms', { method: 'POST', body: { title: deck.title.slice(0, 120), questions: qs, seconds: Number(seconds) }, timeoutMs: 8000 });
      setRoom({ code: r.code, hostKey: r.hostKey }); setState(r.state);
    } catch { setError(tx('Live quizzes need the Murshid server, which is not reachable right now.', 'تحتاج الاختبارات المباشرة إلى خادم مرشد، وهو غير متاح الآن.')); }
    finally { setBusy(false); }
  };
  const host = async (action: 'next' | 'end' | 'remove', extra: Record<string, string> = {}) => {
    if (!room) return;
    try { setError(null); setState(await request<LiveState>(`/live/rooms/${room.code}/${action}`, { method: 'POST', body: { hostKey: room.hostKey, ...extra }, timeoutMs: 6000 })); }
    catch (e) { setError((e as Error).message); }
  };
  const next = () => host('next');
  const joinUrl = typeof window !== 'undefined' && room ? `${window.location.origin}/app/study/live?code=${room.code}` : '';

  if (!deck || cards.length < 4) {
    return <Page><PageHeader eyebrow={tx('Live quiz', 'اختبار مباشر')} title={tx('Pick a deck to host', 'اختر مجموعة لاستضافتها')} subtitle={tx('A live quiz needs a deck with at least 4 cards. Open a deck and choose “Live quiz”.', 'يحتاج الاختبار المباشر مجموعة فيها 4 بطاقات على الأقل. افتح مجموعة واختر «اختبار مباشر».')} actions={<Button asChild><Link href="/app/study/flashcards">{tx('My decks', 'مجموعاتي')}</Link></Button>} /></Page>;
  }
  if (!room || !state) {
    return (
      <Page>
        <Link href={`/app/study/flashcards/${deck.id}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{deck.title}</Link>
        <PageHeader eyebrow={tx('Live quiz', 'اختبار مباشر')} title={tx('Play this deck with your class', 'العب هذه المجموعة مع صفك')}
          subtitle={tx(`Questions from “${deck.title}”. Classmates join on their own device with a 6-digit code; faster right answers score more.`, `أسئلة من «${deck.title}». ينضم زملاؤك من أجهزتهم برمز من 6 أرقام؛ الإجابة الصحيحة الأسرع تحصد نقاطاً أكثر.`)} />
        <div className="card flex max-w-xl flex-col gap-5 p-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{tx('Questions', 'الأسئلة')}</p>
            <Segmented className="self-start" ariaLabel={tx('Questions', 'الأسئلة')} value={pick} onChange={setHowMany} options={[
              ...(['5', '10', '15'] as const).filter((n) => Number(n) < cards.length).map((n) => ({ value: n, label: n })),
              { value: 'all' as const, label: tx(`All ${Math.min(40, cards.length)}`, `الكل ${Math.min(40, cards.length)}`) }]} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{tx('Time per question', 'الوقت لكل سؤال')}</p>
            <Segmented className="self-start" ariaLabel={tx('Time per question', 'الوقت لكل سؤال')} value={seconds} onChange={setSeconds} options={(['10', '20', '30'] as const).map((n) => ({ value: n, label: tx(`${n} s`, `${n} ث`) }))} />
          </div>
          <p className="text-sm text-muted-foreground">{tx(`${total} questions · about ${Math.max(1, Math.round((total * (Number(seconds) + 8)) / 60))} min with the answers`, `${nAr(total, 'question')} · نحو ${nAr(Math.max(1, Math.round((total * (Number(seconds) + 8)) / 60)), 'minute')} مع الإجابات`)}</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button size="lg" onClick={() => void open()} disabled={busy} className="self-start">{busy ? <Loader2 className="animate-spin" /> : <Radio />}{tx('Open the room', 'افتح الغرفة')}</Button>
        </div>
      </Page>
    );
  }
  const q = state.question;
  return (
    <Page wide>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">{state.title}</span>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 text-sm"><Users className="size-4" />{state.players}</span>
        {state.status !== 'lobby' && state.status !== 'done' && <span className="text-sm tabular text-muted-foreground">{tx(`Question ${state.index + 1} of ${state.total}`, `السؤال ${state.index + 1} من ${state.total}`)}</span>}
        {state.status !== 'done' && <Button size="sm" variant="ghost" onClick={() => { if (state.status === 'lobby' || window.confirm(tx('End the quiz now and show the final board?', 'إنهاء الاختبار الآن وعرض النتائج النهائية؟'))) void host('end'); }}>{tx('End quiz', 'إنهاء الاختبار')}</Button>}
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
      {state.status === 'lobby' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="on-deep flex flex-col items-center justify-center gap-3 rounded-[var(--radius-band)] bg-[var(--deep)] p-10 text-center text-white">
            <p className="eyebrow">{tx('Join at Study › Live quiz with the code', 'انضم من الدراسة › اختبار مباشر بالرمز')}</p>
            <p dir="ltr" className="font-mono text-[4.5rem] font-semibold leading-none tracking-[0.12em] tabular">{state.code.slice(0, 3)} {state.code.slice(3)}</p>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(joinUrl).then(() => toast({ title: tx('Join link copied', 'نُسخ رابط الانضمام') })); }} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20"><Copy className="size-4" />{tx('Copy join link', 'انسخ رابط الانضمام')}</button>
          </div>
          <div className="card flex flex-col p-6">
            <h2 className="card-title mb-3">{tx(`Players (${state.players})`, `اللاعبون (${state.players})`)}</h2>
            <ul className="flex flex-1 flex-wrap content-start gap-2">{(state.lobby ?? []).map((n) => (
              <motion.li key={n} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-full bg-surface py-1 pe-1 ps-3 text-sm font-medium">
                <bdi>{n}</bdi>
                <button type="button" onClick={() => void host('remove', { name: n })} aria-label={tx(`Remove ${n}`, `أزل ${n}`)} title={tx('Remove from the game', 'أزل من اللعبة')} className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"><X className="size-3.5" /></button>
              </motion.li>))}</ul>
            {!state.players && <p className="text-sm text-muted-foreground">{tx('Waiting for players…', 'بانتظار اللاعبين…')}</p>}
            <Button size="lg" className="mt-4" onClick={() => void next()} disabled={!state.players}><Play />{tx('Start', 'ابدأ')}</Button>
          </div>
        </div>
      )}
      {(state.status === 'question' || state.status === 'reveal') && q && (
        <div className="flex flex-col gap-5">
          <div className="card p-8 text-center"><p dir="auto" className="text-[1.75rem] font-medium leading-snug">{q.prompt}</p></div>
          {state.status === 'question' && <Countdown ms={state.remainingMs} total={state.seconds} />}
          <ol className="grid gap-3 sm:grid-cols-2">
            {q.options.map((o, i) => (
              <li key={i} className={cn('relative flex min-h-20 items-center gap-3 overflow-hidden rounded-[22px] px-5 py-4 text-lg font-medium text-white', COLORS[i], state.status === 'reveal' && q.answer !== i && 'opacity-35')}>
                <span aria-hidden className="text-xl">{SHAPES[i]}</span><span dir="auto" className="flex-1">{o}</span>
                {state.status === 'reveal' && q.counts && <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-sm tabular">{q.counts[i]}</span>}
                {state.status === 'reveal' && q.answer === i && <Check className="size-6" />}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{tx(`${state.answered} of ${state.players} answered`, `أجاب ${state.answered} من ${state.players}`)}</span>
            <Button onClick={() => void next()}>{state.status === 'question' ? tx('Show the answer', 'اعرض الإجابة') : state.index + 1 >= state.total ? tx('Final results', 'النتائج النهائية') : tx('Next question', 'السؤال التالي')}<SkipForward className="rtl:-scale-x-100" /></Button>
          </div>
          {state.status === 'reveal' && <Board rows={state.leaderboard?.slice(0, 5) ?? null} />}
        </div>
      )}
      {state.status === 'done' && (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
          <span className="text-[var(--deep)]"><MyMascot size={120} mood="happy" /></span>
          <h2 className="display text-[2.25rem]">{state.leaderboard?.[0] ? tx(`${state.leaderboard[0].name} wins!`, `${state.leaderboard[0].name} يفوز!`) : tx('Quiz over', 'انتهى الاختبار')}</h2>
          <div className="w-full"><Board rows={state.leaderboard} /></div>
          <Button variant="secondary" asChild><Link href={`/app/study/flashcards/${deck.id}`}>{tx('Back to the deck', 'العودة إلى المجموعة')}</Link></Button>
        </div>
      )}
    </Page>
  );
}

/* ---------------------------------------------------------------- player */

export function LivePlay() {
  const { tx, world } = useApp();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [name, setName] = useState(world.dashboard.student.firstName ?? '');
  const [joined, setJoined] = useState<{ code: string; player: string } | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<'ended' | 'removed' | null>(null);
  // the option tapped for the open question, shown at once while the answer is sent
  const [picked, setPicked] = useState<{ index: number; choice: number } | null>(null);
  const scored = useRef(false);
  usePoll(joined?.code ?? null, `player=${joined?.player ?? ''}`, setState, setGone);
  useEffect(() => { if (state?.status === 'done' && !scored.current && state.me) { scored.current = true; study.addXp(Math.min(60, Math.round(state.me.score / 100))); } }, [state]);

  const join = async () => {
    const c = code.replace(/\D/g, ''); if (c.length !== 6 || !name.trim()) return;
    setBusy(true); setError(null);
    try { const r = await request<{ player: string; state: LiveState }>(`/live/rooms/${c}/join`, { method: 'POST', body: { name: name.trim() }, timeoutMs: 8000 }); setJoined({ code: c, player: r.player }); setState(r.state); }
    catch (e) { setError((e as Error).message || tx('Could not join.', 'تعذّر الانضمام.')); }
    finally { setBusy(false); }
  };
  const answer = async (choice: number) => {
    if (!joined || !state || picked?.index === state.index) return;
    setPicked({ index: state.index, choice });
    try { setState(await request<LiveState>(`/live/rooms/${joined.code}/answer`, { method: 'POST', body: { player: joined.player, choice }, timeoutMs: 6000 })); }
    catch (e) { if (e instanceof ApiError && e.status === 409) return; setPicked(null); /* not sent: let them tap again */ }
  };

  if (gone) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-[var(--deep)]"><MyMascot size={110} mood="idle" /></span>
          <h1 className="display text-[1.75rem]">{gone === 'removed' ? tx('The host removed you from this quiz', 'أزالك المضيف من هذا الاختبار') : tx('This quiz has ended', 'انتهى هذا الاختبار')}</h1>
          <p className="max-w-sm text-muted-foreground">{gone === 'removed' ? tx('You can join another game with a new code.', 'يمكنك الانضمام إلى لعبة أخرى برمز جديد.') : tx('The room closed before the last question. Ask the host for a new code.', 'أُغلقت الغرفة قبل السؤال الأخير. اطلب من المضيف رمزاً جديداً.')}</p>
          <Button variant="secondary" onClick={() => { setGone(null); setJoined(null); setState(null); setCode(''); scored.current = false; }}>{tx('Join another quiz', 'انضم إلى اختبار آخر')}</Button>
        </div>
      </Page>
    );
  }

  if (!joined || !state) {
    return (
      <Page>
        <Link href="/app/study" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('Study', 'الدراسة')}</Link>
        <PageHeader eyebrow={tx('Live quiz', 'اختبار مباشر')} title={tx('Join a live quiz', 'انضم إلى اختبار مباشر')} subtitle={tx('Enter the code on your teacher’s or classmate’s screen.', 'أدخل الرمز الظاهر على شاشة معلمك أو زميلك.')} />
        <form onSubmit={(e) => { e.preventDefault(); void join(); }} className="card flex max-w-md flex-col gap-4 p-6">
          <div><Label htmlFor="lv-code">{tx('Code', 'الرمز')}</Label><Input id="lv-code" dir="ltr" inputMode="numeric" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))} placeholder="123 456" className="h-14 text-center font-mono text-2xl tracking-[0.2em]" autoFocus={!params.get('code')} /></div>
          <div><Label htmlFor="lv-name">{tx('Your name in the game', 'اسمك في اللعبة')}</Label><Input id="lv-name" dir="auto" value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} maxLength={24} autoComplete="nickname" autoFocus={!!params.get('code')} /></div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button size="lg" type="submit" disabled={busy || code.replace(/\D/g, '').length !== 6 || !name.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Play />}{tx('Join', 'انضم')}</Button>
        </form>
      </Page>
    );
  }
  const q = state.question; const mine = state.me?.answer;
  return (
    <Page>
      <div className="mb-5 flex items-center gap-3"><span className="font-medium"><bdi>{state.me?.name}</bdi></span><span className="flex-1" /><span className="tabular text-sm">{(state.me?.score ?? 0).toLocaleString('en-US')} {tx('points', 'نقطة')}</span></div>
      {state.status === 'lobby' && <div className="flex flex-col items-center gap-4 py-12 text-center"><span className="text-[var(--deep)]"><MyMascot size={110} mood="listening" /></span><h2 className="display text-[1.75rem]">{tx('You’re in!', 'أنت في اللعبة!')}</h2><p className="text-muted-foreground">{tx(`${state.title}: waiting for the host to start. ${state.players === 1 ? 'You are the first one here.' : `${state.players} players here now.`}`, `${state.title}: بانتظار بدء المضيف. ${state.players === 1 ? 'أنت أول من انضم.' : `هنا الآن ${nAr(state.players, 'player')}.`}`)}</p></div>}
      {state.status === 'question' && q && (
        mine || picked?.index === state.index ? <div className="flex flex-col items-center gap-3 py-16 text-center"><Loader2 className="size-8 animate-spin text-muted-foreground" /><p className="text-lg font-medium">{tx('Locked in. Waiting for the others…', 'تم القفل. بانتظار الآخرين…')}</p></div> : (
          <div className="flex flex-col gap-4">
            <div className="card p-6 text-center"><p dir="auto" className="text-[1.375rem] font-medium leading-snug">{q.prompt}</p></div>
            <Countdown ms={state.remainingMs} total={state.seconds} />
            <div className="grid gap-3 sm:grid-cols-2">{q.options.map((o, i) => <button key={i} type="button" onClick={() => void answer(i)} className={cn('flex min-h-24 items-center gap-3 rounded-[22px] px-5 text-start text-lg font-medium text-white active:scale-[0.98]', COLORS[i])}><span aria-hidden className="text-xl">{SHAPES[i]}</span><span dir="auto">{o}</span></button>)}</div>
          </div>
        )
      )}
      {state.status === 'reveal' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className={cn('grid size-20 place-items-center rounded-full text-white', mine?.correct ? 'bg-[var(--success)]' : 'bg-[var(--danger)]')}>{mine?.correct ? <Check className="size-10" /> : <X className="size-10" />}</span>
          <h2 className="display text-[1.75rem]">{!mine ? tx('Too slow this time', 'كنت أبطأ هذه المرة') : mine.correct ? tx(`+${mine.points} points`, `+${mine.points} نقطة`) : tx('Not this one', 'ليست هذه')}</h2>
          {q?.answer !== undefined && <p dir="auto" className="text-muted-foreground">{tx('Answer:', 'الإجابة:')} {q.options[q.answer]}</p>}
          <p className="font-medium">{tx(`You are #${state.me?.rank} of ${state.players}`, `ترتيبك ${state.me?.rank} من ${state.players}`)}</p>
          <div className="w-full max-w-md"><Board rows={state.leaderboard} me={state.me?.name} /></div>
        </div>
      )}
      {state.status === 'done' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <span className="text-[var(--deep)]"><MyMascot size={120} mood={state.me?.rank === 1 ? 'happy' : 'idle'} /></span>
          <h2 className="display text-[2rem]">{state.me?.rank === 1 ? tx('You won!', 'فزت!') : tx(`You finished #${state.me?.rank}`, `أنهيت في المركز ${state.me?.rank}`)}</h2>
          <div className="w-full max-w-md"><Board rows={state.leaderboard} me={state.me?.name} /></div>
          <Button variant="secondary" asChild><Link href="/app/study">{tx('Back to Study', 'العودة إلى الدراسة')}</Link></Button>
        </div>
      )}
    </Page>
  );
}
