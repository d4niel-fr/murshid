'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Check, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot } from '@/components/mascot/my-mascot';
import { Page } from '@/components/shared/page';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { SaveButton, ShareButton } from '@/components/shared/actions';
import { isTyping } from '@/components/shell/shortcuts';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Ago } from '@/components/shared/ago';
import { cardsFromText, isDue, preview, study, SUBJECTS, useStudy, type Card, type Grade } from '@/lib/study';
import { useAutosave } from '@/lib/use-autosave';
import { cn } from '@/lib/utils';
import { count } from '@/lib/plural';

/* ---------------------------------------------------------------- study session */
function StudySession({ deckId, cram, onDone }: { deckId: string; cram: boolean; onDone: () => void }) {
  const { tx } = useApp();
  const s = useStudy();
  const [queue, setQueue] = useState<string[]>(() => {
    const cards = s.cards.filter((c) => c.deckId === deckId);
    const due = cards.filter((c) => isDue(c)).sort((a, b) => a.due - b.due);
    return (cram || !due.length ? cards : due).map((c) => c.id);
  });
  const [flipped, setFlipped] = useState(false);
  const [tally, setTally] = useState<number[]>([0, 0, 0, 0]);
  const [total] = useState(queue.length);
  const card = s.cards.find((c) => c.id === queue[0]);
  const grade = (g: Grade) => {
    if (!card) return;
    study.grade(card.id, g); setTally((t) => t.map((x, i) => (i === g ? x + 1 : x))); setFlipped(false);
    // "again" comes back at the end of this session
    setQueue((q) => (g === 0 ? [...q.slice(1), q[0]!] : q.slice(1)));
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) grade((Number(e.key) - 1) as Grade);
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });
  const done = total - queue.length;
  if (!card) {
    const [again, hard, good, easy] = tally;
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-10 text-center">
        <span className="text-[var(--deep)]"><MyMascot size={120} mood="happy" /></span>
        <h2 className="display text-[2rem]">{tx('Session done', 'انتهت الجلسة')}</h2>
        <p className="text-muted-foreground">{tx(`You reviewed ${count(total, 'card')}. Again ${again} · Hard ${hard} · Good ${good} · Easy ${easy}.`, `راجعت ${total} بطاقة. مجدداً ${again} · صعبة ${hard} · جيدة ${good} · سهلة ${easy}.`)}</p>
        <div className="flex gap-2"><Button onClick={onDone}>{tx('Back to deck', 'العودة إلى المجموعة')}</Button><Button variant="secondary" asChild><Link href={`/app/study/flashcards/${deckId}?mode=quiz`}>{tx('Take a quiz', 'خذ اختباراً')}</Link></Button></div>
      </div>
    );
  }
  const pv = preview(card);
  const labels: [Grade, string, string][] = [[0, tx('Again', 'مجدداً'), 'tint-danger'], [1, tx('Hard', 'صعبة'), 'tint-warning'], [2, tx('Good', 'جيدة'), 'tint-success'], [3, tx('Easy', 'سهلة'), 'tint-info']];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onDone} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm"><X className="size-4" />{tx('End', 'إنهاء')}</button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text)_8%,transparent)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}><motion.div className="h-full rounded-full bg-[var(--brand)]" animate={{ width: `${(done / Math.max(1, total)) * 100}%` }} /></div>
        <span className="tabular text-sm text-muted-foreground">{done}/{total}</span>
      </div>
      <button type="button" onClick={() => setFlipped((f) => !f)} data-flipped={flipped} className="flip block h-[min(52vh,360px)] w-full text-start" aria-label={flipped ? tx('Show the question', 'اعرض السؤال') : tx('Show the answer', 'اعرض الإجابة')}>
        <div className="flip-inner h-full">
          <div className="flip-face card flex flex-col justify-between p-7"><p className="eyebrow">{tx('Question', 'السؤال')}</p><p className="text-center text-[1.5rem] font-medium leading-snug">{card.front}</p><p className="text-center text-xs text-muted-foreground">{tx('Space to flip', 'المسافة للقلب')}</p></div>
          <div className="flip-face flip-back on-deep flex flex-col justify-between rounded-[var(--radius-lg)] bg-[var(--deep)] p-7 text-white"><p className="eyebrow">{tx('Answer', 'الإجابة')}</p><p className="text-center text-[1.25rem] leading-relaxed">{card.back}</p><p className="text-center text-xs text-white/60">{card.front}</p></div>
        </div>
      </button>
      <AnimatePresence>
        {flipped && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 grid grid-cols-4 gap-2" role="group" aria-label={tx('How well did you know it?', 'ما مدى معرفتك بها؟')}>
            {labels.map(([g, l, tone]) => (
              <button key={g} type="button" onClick={() => grade(g)} className={cn('flex flex-col items-center rounded-[18px] px-2 py-3 text-sm font-medium transition-[transform,filter] duration-150 ease-[var(--ease-out)] hover:brightness-[0.97] active:scale-[0.97]', tone)}>
                {l}<span className="mt-0.5 text-[0.6875rem] font-normal opacity-80">{pv[g]} · {g + 1}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- quiz */
function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j]!, b[i]!]; } return b; }

function Quiz({ deckId, onDone }: { deckId: string; onDone: () => void }) {
  const { tx } = useApp();
  const s = useStudy();
  const [qs] = useState(() => {
    const cards = s.cards.filter((c) => c.deckId === deckId);
    const pool = s.cards; // distractors can come from other decks when this one is small
    return shuffle(cards).slice(0, 10).map((c) => {
      const others = shuffle([...cards, ...pool].filter((x) => x.id !== c.id && x.back !== c.back)).map((x) => x.back);
      return { card: c, options: shuffle([c.back, ...Array.from(new Set(others)).slice(0, 3)]) };
    });
  });
  const [i, setI] = useState(0); const [pick, setPick] = useState<number | null>(null); const [right, setRight] = useState(0); const [missed, setMissed] = useState<Card[]>([]);
  const cur = qs[i];
  const answer = (k: number) => {
    if (pick !== null || !cur) return; setPick(k);
    if (cur.options[k] === cur.card.back) setRight((r) => r + 1); else setMissed((m) => [...m, cur.card]);
  };
  const next = () => {
    if (i + 1 >= qs.length) { study.logQuiz(deckId, right, qs.length); setI(qs.length); return; }
    setI(i + 1); setPick(null);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (['1', '2', '3', '4'].includes(e.key) && pick === null) answer(Number(e.key) - 1);
      else if (e.key === 'Enter' && pick !== null) next();
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on);
  });
  if (!cur) {
    const pct = Math.round((right / Math.max(1, qs.length)) * 100);
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-10 text-center">
        <span className="text-[var(--deep)]"><MyMascot size={120} mood={pct >= 70 ? 'happy' : 'thinking'} /></span>
        <h2 className="display text-[2rem]">{right} / {qs.length}</h2>
        <p className="text-muted-foreground">{pct >= 70 ? tx('Strong result. Keep the streak going with a review tomorrow.', 'نتيجة قوية. حافظ على تقدّمك بمراجعة غداً.') : tx('Good practice. The ones you missed are now due, so they come back first.', 'تدريب جيد. صارت البطاقات التي أخطأت فيها مستحقة لتعود أولاً.')}</p>
        {missed.length > 0 && <ul className="w-full rounded-[var(--radius)] bg-surface p-4 text-start text-sm">{missed.map((c) => <li key={c.id} className="border-b border-border py-2 last:border-0"><span className="font-medium">{c.front}</span><br /><span className="text-muted-foreground">{c.back}</span></li>)}</ul>}
        <div className="flex gap-2">
          <Button onClick={() => { missed.forEach((c) => study.grade(c.id, 0)); onDone(); }}>{tx('Done', 'تم')}</Button>
          <Button variant="secondary" asChild><Link href={`/app/study/flashcards/${deckId}?mode=study`}>{tx('Study the deck', 'ادرس المجموعة')}</Link></Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" onClick={onDone} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm"><X className="size-4" />{tx('End', 'إنهاء')}</button>
        <span className="flex-1 text-sm text-muted-foreground">{tx(`Question ${i + 1} of ${qs.length}`, `السؤال ${i + 1} من ${qs.length}`)}</span>
        <span className="tabular text-sm">{right} ✓</span>
      </div>
      <div className="card p-7"><p className="eyebrow">{tx('Pick the answer', 'اختر الإجابة')}</p><p className="mt-3 text-[1.375rem] font-medium leading-snug">{cur.card.front}</p></div>
      <ol className="mt-3 grid gap-2">
        {cur.options.map((o, k) => {
          const correct = o === cur.card.back; const state = pick === null ? 'idle' : correct ? 'right' : pick === k ? 'wrong' : 'idle';
          return (
            <li key={k}><button type="button" onClick={() => answer(k)} disabled={pick !== null}
              className={cn('flex w-full items-start gap-3 rounded-[18px] border px-4 py-3 text-start text-[0.9375rem] transition-colors', state === 'right' ? 'border-transparent tint-success' : state === 'wrong' ? 'border-transparent tint-danger' : 'border-border hover:border-foreground disabled:opacity-60')}>
              <kbd className="mt-0.5 rounded-md border border-current/20 px-1.5 text-[0.6875rem]">{k + 1}</kbd><span className="flex-1">{o}</span>{state === 'right' && <Check className="size-4" />}
            </button></li>
          );
        })}
      </ol>
      {pick !== null && <div className="mt-4 flex justify-end"><Button onClick={next}>{i + 1 >= qs.length ? tx('See results', 'عرض النتيجة') : tx('Next', 'التالي')} <kbd className="ms-1 rounded border border-white/30 px-1 text-[0.625rem]">Enter</kbd></Button></div>}
    </div>
  );
}

/* ---------------------------------------------------------------- deck page */
export function DeckView() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { tx, toast, locale } = useApp();
  const s = useStudy();
  const deck = s.decks.find((d) => d.id === id);
  const cards = useMemo(() => s.cards.filter((c) => c.deckId === id), [s.cards, id]);
  const mode = params.get('mode');
  const draft = useAutosave(`card:${id}`, { front: '', back: '' });
  const [bulk, setBulk] = useState(false); const [bulkText, setBulkText] = useState('');
  const [editing, setEditing] = useState<string | null>(null); const [edit, setEdit] = useState({ front: '', back: '' });
  const [rename, setRename] = useState(false); const [title, setTitle] = useState('');
  const setMode = (m: string | null) => router.replace(m ? `/app/study/flashcards/${id}?mode=${m}` : `/app/study/flashcards/${id}`, { scroll: false });
  // sessions shuffle and read the clock: build them in the browser only, so server and client markup agree
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!deck) {
    return <Page><EmptyState title={tx('This deck isn’t here', 'هذه المجموعة غير موجودة')} action={<Button asChild><Link href="/app/study/flashcards">{tx('All decks', 'كل المجموعات')}</Link></Button>}>{tx('It may have been deleted on this device.', 'ربما حُذفت على هذا الجهاز.')}</EmptyState></Page>;
  }
  if ((mode === 'study' || mode === 'quiz') && !mounted) return <Page><h1 className="sr-only">{mode === 'quiz' ? tx(`Quiz: ${deck.title}`, `اختبار: ${deck.title}`) : tx(`Studying ${deck.title}`, `دراسة ${deck.title}`)}</h1><LoadingState /></Page>;
  if (mode === 'study' && cards.length) return <Page><h1 className="sr-only">{tx(`Studying ${deck.title}`, `دراسة ${deck.title}`)}</h1><StudySession deckId={deck.id} cram={params.get('all') === '1'} onDone={() => setMode(null)} /></Page>;
  if (mode === 'quiz' && cards.length >= 2) return <Page><h1 className="sr-only">{tx(`Quiz: ${deck.title}`, `اختبار: ${deck.title}`)}</h1><Quiz deckId={deck.id} onDone={() => setMode(null)} /></Page>;

  const now = Date.now();
  const due = cards.filter((c) => isDue(c, now)).length;
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const n = study.addCards(deck.id, [[draft.value.front, draft.value.back]]);
    if (n) { draft.setValue({ front: '', back: '' }); draft.clear(); toast({ title: tx('Card added', 'أُضيفت البطاقة') }); (document.getElementById('card-front') as HTMLTextAreaElement | null)?.focus(); }
  };
  const importBulk = () => {
    const pairs = cardsFromText(bulkText);
    const n = study.addCards(deck.id, pairs);
    toast({ title: n ? tx(`${count(n, 'card')} added`, `أُضيفت ${n} بطاقة`) : tx('No cards found', 'لم تُعثر على بطاقات'), description: n ? undefined : tx('Write one card per line as “front :: back”.', 'اكتب بطاقة في كل سطر بصيغة «أمام :: خلف».'), tone: n ? 'success' : 'info' });
    if (n) { setBulk(false); setBulkText(''); }
  };
  const columns: Column<Card>[] = [
    { key: 'front', header: tx('Front', 'الأمام'), value: (c) => c.front, cell: (c) => editing === c.id ? <Textarea aria-label={tx('Front', 'الأمام')} value={edit.front} onChange={(e) => setEdit({ ...edit, front: e.target.value })} className="min-h-16" /> : <span className="font-medium">{c.front}</span> },
    { key: 'back', header: tx('Back', 'الخلف'), value: (c) => c.back, cell: (c) => editing === c.id ? <Textarea aria-label={tx('Back', 'الخلف')} value={edit.back} onChange={(e) => setEdit({ ...edit, back: e.target.value })} className="min-h-16" /> : <span className="text-muted-foreground">{c.back}</span> },
    { key: 'due', header: tx('Next review', 'المراجعة القادمة'), value: (c) => c.due, cell: (c) => <span className={cn('whitespace-nowrap text-xs', isDue(c, now) ? 'font-medium text-[var(--warning)]' : 'text-muted-foreground')}>{isDue(c, now) ? tx('Due now', 'مستحقة الآن') : <Ago ts={c.due} locale={locale} />}</span> },
    { key: 'reps', header: tx('Streak', 'التتابع'), value: (c) => c.reps, align: 'end', cell: (c) => c.reps },
    { key: 'act', header: '', sortable: false, align: 'end', cell: (c) => editing === c.id ? (
      <span className="inline-flex gap-1"><Button size="icon-sm" aria-label={tx('Save card', 'حفظ البطاقة')} onClick={() => { study.updateCard(c.id, edit); setEditing(null); }}><Check /></Button><Button size="icon-sm" variant="ghost" aria-label={tx('Cancel', 'إلغاء')} onClick={() => setEditing(null)}><X /></Button></span>
    ) : (
      <span className="inline-flex gap-1"><Button size="icon-sm" variant="ghost" aria-label={tx('Edit card', 'تعديل البطاقة')} onClick={() => { setEditing(c.id); setEdit({ front: c.front, back: c.back }); }}><Pencil /></Button>
        <Button size="icon-sm" variant="ghost" aria-label={tx('Delete card', 'حذف البطاقة')} onClick={() => { const copy = c; study.removeCard(c.id); toast({ title: tx('Card deleted', 'حُذفت البطاقة'), tone: 'info', action: { label: tx('Undo', 'تراجع'), onClick: () => study.addCards(copy.deckId, [[copy.front, copy.back]]) } }); }}><Trash2 /></Button></span>
    ) },
  ];

  return (
    <Page>
      <Link href="/app/study/flashcards" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('All decks', 'كل المجموعات')}</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-3">{deck.subject} · {tx(count(cards.length, 'card'), `${cards.length} بطاقة`)}</p>
          {rename ? (
            <form onSubmit={(e) => { e.preventDefault(); study.renameDeck(deck.id, title); setRename(false); }} className="flex items-center gap-2">
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} aria-label={tx('Deck title', 'عنوان المجموعة')} className="h-12 text-lg" />
              <Button type="submit" size="icon" aria-label={tx('Save', 'حفظ')}><Check /></Button>
            </form>
          ) : (
            <h1 className="display flex items-center gap-3 text-[2.25rem] sm:text-[2.75rem]">{deck.title}<button type="button" onClick={() => { setTitle(deck.title); setRename(true); }} aria-label={tx('Rename deck', 'إعادة تسمية المجموعة')} className="grid size-9 place-items-center rounded-full bg-surface text-muted-foreground hover:text-foreground"><Pencil className="size-4" /></button></h1>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveButton id={`deck:${deck.id}`} kind="deck" title={deck.title} href={`/app/study/flashcards/${deck.id}`} iconOnly />
          <ShareButton title={deck.title} iconOnly />
          {cards.length >= 2 && <Button variant="secondary" onClick={() => setMode('quiz')}>{tx('Quiz', 'اختبار')}</Button>}
          <Button disabled={!cards.length} onClick={() => router.replace(`/app/study/flashcards/${deck.id}?mode=study${due ? '' : '&all=1'}`)}>{due ? tx(`Study ${due} due`, `ادرس ${due} مستحقة`) : tx('Review all', 'راجع الكل')}</Button>
        </div>
      </div>

      <section className="card mb-6 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="card-title">{tx('Add cards', 'أضف بطاقات')}</h2>
          <Segmented size="sm" ariaLabel={tx('How to add', 'طريقة الإضافة')} value={bulk ? 'bulk' : 'one'} onChange={(v) => setBulk(v === 'bulk')} options={[{ value: 'one', label: tx('One at a time', 'واحدة تلو الأخرى') }, { value: 'bulk', label: tx('Paste many', 'لصق عدة') }]} />
        </div>
        {bulk ? (
          <div className="flex flex-col gap-3">
            <Label htmlFor="bulk">{tx('One card per line: front :: back', 'بطاقة في كل سطر: أمام :: خلف')}</Label>
            <Textarea id="bulk" value={bulkText} onChange={(e) => setBulkText(e.target.value)} className="min-h-36 font-mono text-[0.8125rem]" placeholder={'Wavelength :: The distance between two peaks\nFrequency :: Waves per second (Hz)'} />
            <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{tx(`${count(cardsFromText(bulkText).length, 'card')} found`, `عُثر على ${cardsFromText(bulkText).length} بطاقة`)}</span><Button onClick={importBulk} disabled={!cardsFromText(bulkText).length}><Upload />{tx('Add cards', 'أضف البطاقات')}</Button></div>
          </div>
        ) : (
          <form onSubmit={add} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div><Label htmlFor="card-front">{tx('Front', 'الأمام')}</Label><Textarea id="card-front" required value={draft.value.front} onChange={(e) => draft.setValue({ ...draft.value, front: e.target.value })} className="min-h-20" placeholder={tx('Question or term', 'سؤال أو مصطلح')} /></div>
            <div><Label htmlFor="card-back">{tx('Back', 'الخلف')}</Label><Textarea id="card-back" required value={draft.value.back} onChange={(e) => draft.setValue({ ...draft.value, back: e.target.value })} className="min-h-20" placeholder={tx('Answer or meaning', 'الإجابة أو المعنى')}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e); }} /></div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[0.6875rem] text-muted-foreground" aria-live="polite">{draft.status === 'restored' ? tx('Draft restored', 'استُعيدت المسودة') : draft.value.front || draft.value.back ? tx('Draft saved', 'حُفظت المسودة') : ''}</span>
              <Button type="submit" disabled={!draft.value.front.trim() || !draft.value.back.trim()}><Plus />{tx('Add', 'أضف')}</Button>
            </div>
          </form>
        )}
      </section>

      {cards.length ? (
        <DataTable rows={cards} columns={columns} rowKey={(c) => c.id} initialSort={{ key: 'due', dir: 'asc' }} caption={tx('Cards in this deck', 'بطاقات هذه المجموعة')} filterPlaceholder={tx('Filter cards', 'تصفية البطاقات')} />
      ) : (
        <EmptyState compact title={tx('No cards yet', 'لا توجد بطاقات بعد')}>{tx('Add one above, or paste a list. Tip: in Notes, lines like “term :: meaning” become cards in one click.', 'أضف بطاقة أعلاه أو الصق قائمة. نصيحة: في الملاحظات، تتحول سطور «مصطلح :: معنى» إلى بطاقات بنقرة.')}</EmptyState>
      )}
      <div className="mt-8 flex justify-end">
        <Button variant="ghost" className="text-[var(--danger)]" onClick={() => { if (window.confirm(tx('Delete this deck and its cards?', 'حذف هذه المجموعة وبطاقاتها؟'))) { study.removeDeck(deck.id); router.push('/app/study/flashcards'); } }}><Trash2 />{tx('Delete deck', 'حذف المجموعة')}</Button>
      </div>
    </Page>
  );
}

export { SUBJECTS };
export function SubjectSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <Select {...props}>{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</Select>; }
