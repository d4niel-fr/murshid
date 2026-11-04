'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Bold, BookOpenCheck, CheckSquare, Download, Heading2, Italic, Layers, Link2, List, ListCollapse, Mic, MicOff, Pin, PinOff, Plus, Quote, Search, Table2, Trash2, Wand2 } from 'lucide-react';
import { generateCards, summarise } from '@murshid/study';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { CopyButton, PrintButton, SaveButton, ShareButton } from '@/components/shared/actions';
import { ReadingTime, Toc } from '@/components/shared/page-aids';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { rank } from '@/lib/fuzzy';
import { headings, Markdown } from '@/lib/markdown';
import { fadeUp, stagger } from '@/lib/motion';
import { cardsFromText, readingMinutes, study, studyStore, SUBJECTS, useStudy, type Note } from '@/lib/study';
import { cn } from '@/lib/utils';
import { Ago } from '@/components/shared/ago';
import { nAr } from '@/lib/plural';
import { Subject, SubjectOptions } from '@/components/shared/subject';

const excerpt = (md: string) => md.replace(/[#*>`|_-]/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 140);

type Sort = 'updated' | 'created' | 'title';

export function NotesView() {
  const { tx, locale, toast } = useApp();
  const router = useRouter();
  const s = useStudy();
  const [q, setQ] = useState(''); const [subject, setSubject] = useState('all'); const [sort, setSort] = useState<Sort>('updated');
  const list = useMemo(() => {
    let out = s.notes.filter((n) => subject === 'all' || n.subject === subject);
    if (q.trim()) out = rank(q, out, (n) => `${n.title} ${n.subject} ${n.tags.join(' ')} ${n.body}`).map((r) => r.item);
    else out = [...out].sort((a, b) => (sort === 'title' ? (a.title || '~').localeCompare(b.title || '~') : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
    return [...out.filter((n) => n.pinned), ...out.filter((n) => !n.pinned)];
  }, [s.notes, q, subject, sort]);
  const subjects = Array.from(new Set(s.notes.map((n) => n.subject)));
  const create = () => router.push(`/app/study/notes/${study.addNote(subject === 'all' ? 'Other' : subject)}`);
  const remove = (n: Note) => { study.removeNote(n.id); toast({ title: tx('Note deleted', 'حُذفت الملاحظة'), tone: 'info', action: { label: tx('Undo', 'تراجع'), onClick: () => study.restoreNote(n) } }); };

  return (
    <Page>
      <PageHeader eyebrow={<Link href="/app/study" className="hover:text-foreground">{tx('Study tools', 'أدوات الدراسة')}</Link>} title={tx('Notes', 'الملاحظات')}
        subtitle={tx('Write with headings, lists, checklists and tables. Notes save as you type, on this device.', 'اكتب بعناوين وقوائم ومهام وجداول. تُحفظ الملاحظات أثناء الكتابة على هذا الجهاز.')}
        actions={<><SaveButton title={tx('Notes', 'الملاحظات')} /><Button onClick={create}><Plus />{tx('New note', 'ملاحظة جديدة')}</Button></>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full bg-surface px-4">
          <Search className="size-4 text-muted-foreground" /><span className="sr-only">{tx('Search notes', 'ابحث في الملاحظات')}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Search titles, tags and text', 'ابحث في العناوين والوسوم والنص')} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
        <Select aria-label={tx('Subject', 'المادة')} value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 w-auto min-w-[160px] rounded-full"><option value="all">{tx('All subjects', 'كل المواد')}</option><SubjectOptions list={subjects} /></Select>
        {!q.trim() && <Segmented ariaLabel={tx('Sort notes', 'ترتيب الملاحظات')} value={sort} onChange={setSort} options={[{ value: 'updated', label: tx('Last edited', 'آخر تعديل') }, { value: 'created', label: tx('Newest', 'الأحدث') }, { value: 'title', label: tx('A–Z', 'أ–ي') }]} />}
      </div>
      {list.length ? (
        <motion.ul initial="hidden" animate="show" variants={stagger} className="grid grid-cols-12 gap-4">
          {list.map((n) => (
            <motion.li key={n.id} variants={fadeUp} className="col-span-12 md:col-span-6 xl:col-span-4">
              <div className="lift card group relative flex h-full flex-col p-5">
                <Link href={`/app/study/notes/${n.id}`} className="absolute inset-0 rounded-[inherit]" aria-label={n.title || tx('Untitled note', 'ملاحظة بلا عنوان')} />
                <div className="flex items-start gap-2">
                  <h2 className="card-title line-clamp-2 flex-1">{n.title || <span className="text-muted-foreground">{tx('Untitled note', 'ملاحظة بلا عنوان')}</span>}</h2>
                  {n.pinned && <Pin className="size-4 shrink-0 text-primary" aria-label={tx('Pinned', 'مثبتة')} />}
                </div>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{excerpt(n.body) || tx('Empty note', 'ملاحظة فارغة')}</p>
                <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-surface-2 px-2.5 py-1 font-medium text-foreground"><Subject name={n.subject} /></span>
                  {n.tags.slice(0, 2).map((t) => <span key={t}>#{t}</span>)}
                  <span className="ms-auto"><Ago ts={n.updatedAt} locale={locale} /></span>
                  <button type="button" onClick={() => study.saveNote(n.id, { pinned: !n.pinned })} aria-label={n.pinned ? tx('Unpin', 'إلغاء التثبيت') : tx('Pin', 'تثبيت')} className="relative z-10 grid size-8 place-items-center rounded-full opacity-70 hover:bg-[var(--bg)] hover:opacity-100">{n.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}</button>
                  <button type="button" onClick={() => remove(n)} aria-label={tx('Delete note', 'حذف الملاحظة')} className="relative z-10 grid size-8 place-items-center rounded-full opacity-70 hover:bg-[var(--bg)] hover:opacity-100"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      ) : (
        <EmptyState title={s.notes.length ? tx('No notes match', 'لا توجد ملاحظات مطابقة') : tx('No notes yet', 'لا توجد ملاحظات بعد')} action={<Button onClick={create}><Plus />{tx('New note', 'ملاحظة جديدة')}</Button>}>
          {s.notes.length ? tx('Try different words, or clear the subject filter.', 'جرّب كلمات مختلفة أو أزل تصفية المادة.') : tx('Summaries, essay plans, formula sheets: anything you want to keep.', 'ملخصات وخطط مقالات وأوراق قوانين: أي شيء تريد الاحتفاظ به.')}
        </EmptyState>
      )}
    </Page>
  );
}

/* ---------------------------------------------------------------- editor */
type View = 'write' | 'preview' | 'split';

export function NoteEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tx, toast, locale } = useApp();
  const s = useStudy();
  const note = s.notes.find((n) => n.id === id);
  const [title, setTitle] = useState(note?.title ?? ''); const [body, setBody] = useState(note?.body ?? '');
  const [tags, setTags] = useState((note?.tags ?? []).join(', '));
  const [status, setStatus] = useState<'saved' | 'saving'>('saved');
  const [view, setView] = useState<View>('write');
  const ta = useRef<HTMLTextAreaElement>(null);
  // leaving a note that was never written in removes it, so "New note" doesn't leave empty notes behind
  const latest = useRef({ title, body });
  latest.current = { title, body };
  useEffect(() => () => {
    // after the route changes (a development remount stays on this note, so nothing is removed)
    setTimeout(() => {
      if (window.location.pathname.endsWith(`/${id}`)) return;
      const cur = studyStore.get().notes.find((n) => n.id === id);
      if (cur && !latest.current.title.trim() && !latest.current.body.trim() && !cur.title.trim() && !cur.body.trim()) study.removeNote(id);
    }, 0);
  }, [id]);
  // the note can arrive after the first render (stored notes load from this device): take its text once per note
  const loaded = useRef<string | null>(note?.id ?? null);
  useEffect(() => { if (window.matchMedia('(min-width: 1280px)').matches) setView('split'); }, []);
  useEffect(() => { if (note && loaded.current !== note.id) { setTitle(note.title); setBody(note.body); setTags(note.tags.join(', ')); loaded.current = note.id; } }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // autosave: 400 ms after the last keystroke
  useEffect(() => {
    if (!note || loaded.current !== note.id) return;
    if (title === note.title && body === note.body && tags === note.tags.join(', ')) return;
    setStatus('saving');
    const t = setTimeout(() => { study.saveNote(note.id, { title, body, tags: tags.split(',').map((x) => x.trim().replace(/^#/, '')).filter(Boolean).slice(0, 8) }); setStatus('saved'); }, 400);
    return () => clearTimeout(t);
  }, [title, body, tags]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.title = `${title || tx('Untitled note', 'ملاحظة بلا عنوان')} · Murshid`; }, [title, tx]);

  // lecture dictation: the browser's speech recognition writes what it hears into the note
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const rec = useRef<{ stop: () => void } | null>(null);
  useEffect(() => () => rec.current?.stop(), []);
  const dictate = () => {
    if (listening) { rec.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) { toast({ title: tx('Dictation needs Chrome, Edge or Safari', 'الإملاء يحتاج Chrome أو Edge أو Safari'), tone: 'info' }); return; }
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = locale === 'ar' ? 'ar-AE' : 'en-GB';
    r.onresult = (e: any) => {
      let fin = ''; let mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t; else mid += t; }
      if (fin) setBody((b) => `${b}${b && !/\s$/.test(b) ? ' ' : ''}${fin.trim().replace(/^./, (c: string) => c.toUpperCase())}${/[.?!]$/.test(fin.trim()) ? '' : '.'}`);
      setInterim(mid);
    };
    r.onend = () => { setListening(false); setInterim(''); rec.current = null; };
    r.onerror = (e: any) => { if (e.error === 'not-allowed') toast({ title: tx('Allow the microphone to dictate', 'اسمح بالميكروفون للإملاء'), tone: 'danger' }); };
    r.start(); rec.current = r; setListening(true);
    if (!body.includes('## Lecture')) setBody((b) => `${b}${b.trim() ? '\n\n' : ''}## Lecture ${new Date().toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB')}\n\n`);
  };
  const addSummary = () => {
    const sum = summarise(body.replace(/^## Summary[\s\S]*?(?=\n## |$)/m, ''), 4);
    if (!sum.length) { toast({ title: tx('Write a little more first', 'اكتب أكثر قليلاً أولاً'), tone: 'info' }); return; }
    const block = `## Summary\n\n${sum.map((x) => `- ${x}`).join('\n')}\n\n`;
    setBody((b) => (/^## Summary/m.test(b) ? b.replace(/^## Summary[\s\S]*?(?=\n## |$)/m, block.trimEnd()) : block + b));
    toast({ title: tx('Summary added at the top', 'أُضيف ملخص في الأعلى'), tone: 'success' });
  };
  const quizMe = () => {
    const made = generateCards(`${title}\n${body}`, { max: 20 });
    if (made.length < 2) { toast({ title: tx('Not enough in this note to quiz you yet', 'لا يكفي محتوى الملاحظة لاختبارك بعد'), tone: 'info' }); return; }
    const deckId = study.createDeck(tx(`Quiz: ${title || 'my note'}`, `اختبار: ${title || 'ملاحظتي'}`), note!.subject, made, tx('From a note', 'من ملاحظة'));
    router.push(`/app/study/flashcards/${deckId}?mode=test`);
  };

  const toc = useMemo(() => headings(body), [body]);
  const pairs = useMemo(() => cardsFromText(body), [body]);
  if (!note) return <Page><EmptyState title={tx('This note isn’t here', 'هذه الملاحظة غير موجودة')} action={<Button asChild><Link href="/app/study/notes">{tx('All notes', 'كل الملاحظات')}</Link></Button>}>{tx('It may have been deleted on this device.', 'ربما حُذفت على هذا الجهاز.')}</EmptyState></Page>;

  // toolbar: wrap the selection, or insert at the cursor
  const apply = (before: string, after = '', line = false) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    let next: string; let caret: number;
    if (line) { const ls = value.lastIndexOf('\n', a - 1) + 1; next = value.slice(0, ls) + before + value.slice(ls); caret = b + before.length; }
    else { next = value.slice(0, a) + before + value.slice(a, b) + after + value.slice(b); caret = b + before.length + (a === b ? 0 : after.length); }
    setBody(next); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };
  const tools: [string, React.ComponentType<{ className?: string }>, () => void][] = [
    [tx('Heading', 'عنوان'), Heading2, () => apply('## ', '', true)], [tx('Bold', 'عريض'), Bold, () => apply('**', '**')], [tx('Italic', 'مائل'), Italic, () => apply('*', '*')],
    [tx('List', 'قائمة'), List, () => apply('- ', '', true)], [tx('Checklist', 'قائمة مهام'), CheckSquare, () => apply('- [ ] ', '', true)], [tx('Quote', 'اقتباس'), Quote, () => apply('> ', '', true)],
    [tx('Table', 'جدول'), Table2, () => apply('\n| Column | Column |\n|---|---|\n| | |\n')], [tx('Link', 'رابط'), Link2, () => apply('[', '](https://)')],
    [tx('Flashcard line', 'سطر بطاقة'), Layers, () => apply('\nTerm :: Meaning\n')],
  ];
  const toggleTask = (lineNo: number) => {
    const lines = body.split('\n'); const l = lines[lineNo] ?? '';
    lines[lineNo] = /\[ \]/.test(l) ? l.replace('[ ]', '[x]') : l.replace(/\[(x|X)\]/, '[ ]'); setBody(lines.join('\n'));
  };
  const makeCards = () => {
    const deckId = study.addDeck(title || tx('Cards from my note', 'بطاقات من ملاحظتي'), note.subject);
    const n = study.addCards(deckId, pairs);
    toast({ title: tx(`${n} flashcards made`, `أُنشئت ${nAr(n, 'card')}`), action: { label: tx('Open deck', 'افتح المجموعة'), onClick: () => router.push(`/app/study/flashcards/${deckId}`) } });
  };
  const exportMd = () => {
    const blob = new Blob([`# ${title}\n\n${body}\n`], { type: 'text/markdown' }); const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${(title || 'note').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.md`; a.click(); URL.revokeObjectURL(a.href);
  };
  const del = () => { const n = study.removeNote(note.id); router.push('/app/study/notes'); if (n) toast({ title: tx('Note deleted', 'حُذفت الملاحظة'), tone: 'info', action: { label: tx('Undo', 'تراجع'), onClick: () => { study.restoreNote(n); router.push(`/app/study/notes/${n.id}`); } } }); };

  return (
    <Page wide>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href="/app/study/notes" className="me-auto inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('All notes', 'كل الملاحظات')}</Link>
        <span className="text-xs text-muted-foreground" aria-live="polite">{status === 'saving' ? tx('Saving…', 'جارٍ الحفظ…') : <>{tx('Saved', 'محفوظة')} · <Ago ts={note.updatedAt} locale={locale} /></>}</span>
        <button type="button" onClick={() => study.saveNote(note.id, { pinned: !note.pinned })} aria-pressed={Boolean(note.pinned)} aria-label={note.pinned ? tx('Unpin', 'إلغاء التثبيت') : tx('Pin', 'تثبيت')} className="grid size-9 place-items-center rounded-full bg-surface">{note.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}</button>
        <SaveButton id={`note:${note.id}`} kind="note" title={title || tx('Untitled note', 'ملاحظة بلا عنوان')} href={`/app/study/notes/${note.id}`} iconOnly />
        <CopyButton text={() => `# ${title}\n\n${body}`} label={tx('Copy note', 'نسخ الملاحظة')} iconOnly />
        <ShareButton title={title} iconOnly />
        <PrintButton iconOnly />
        <button type="button" onClick={exportMd} aria-label={tx('Download as Markdown', 'تنزيل بصيغة Markdown')} className="grid size-9 place-items-center rounded-full bg-surface"><Download className="size-4" /></button>
        <button type="button" onClick={del} aria-label={tx('Delete note', 'حذف الملاحظة')} className="grid size-9 place-items-center rounded-full bg-surface text-[var(--danger)]"><Trash2 className="size-4" /></button>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_15rem]">
        <div className="min-w-0">
          <label className="sr-only" htmlFor="note-title">{tx('Title', 'العنوان')}</label>
          <input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('Untitled note', 'ملاحظة بلا عنوان')} className="display w-full bg-transparent text-[2rem] outline-none placeholder:text-muted-foreground sm:text-[2.5rem]" />
          <h1 className="print-only display text-[2rem]">{title}</h1>
          <div className="no-print mt-3 flex flex-wrap items-center gap-3">
            <Select aria-label={tx('Subject', 'المادة')} value={note.subject} onChange={(e) => study.saveNote(note.id, { subject: e.target.value })} className="h-9 w-auto rounded-full text-[0.8125rem]"><SubjectOptions list={SUBJECTS} /></Select>
            <Input aria-label={tx('Tags, separated by commas', 'الوسوم مفصولة بفواصل')} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={tx('tags, comma separated', 'وسوم مفصولة بفواصل')} className="h-9 w-56 rounded-full text-[0.8125rem]" />
            <ReadingTime minutes={readingMinutes(body)} />
            <Segmented size="sm" className="ms-auto" ariaLabel={tx('View', 'العرض')} value={view} onChange={setView} options={[{ value: 'write', label: tx('Write', 'كتابة') }, { value: 'split', label: tx('Split', 'مقسوم') }, { value: 'preview', label: tx('Preview', 'معاينة') }]} />
          </div>
          <div className={cn('mt-4 grid gap-4', view === 'split' && 'lg:grid-cols-2')}>
            {view !== 'preview' && (
              <div className="no-print card overflow-hidden p-0">
                <div role="toolbar" aria-label={tx('Formatting', 'التنسيق')} className="flex flex-wrap gap-0.5 border-b border-border p-1.5">
                  {tools.map(([label, Icon, run]) => <button key={label} type="button" onClick={run} title={label} aria-label={label} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-[var(--bg)] hover:text-foreground"><Icon className="size-4" /></button>)}
                </div>
                {listening && <p className="flex items-center gap-2 border-b border-border bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-4 py-2 text-xs" aria-live="polite"><span className="size-2 animate-pulse rounded-full bg-[var(--danger)]" />{tx('Listening… speak and Murshid writes it down.', 'أستمع… تحدث ويكتب مرشد.')} <span className="truncate text-muted-foreground">{interim}</span></p>}
                <Textarea ref={ta} dir="auto" value={body} onChange={(e) => setBody(e.target.value)} aria-label={tx('Note text', 'نص الملاحظة')} spellCheck
                  placeholder={tx('Start writing… Use ## for headings, - for lists, - [ ] for a checklist, and “term :: meaning” for flashcards.', 'ابدأ الكتابة… استخدم ## للعناوين و- للقوائم و- [ ] للمهام و«مصطلح :: معنى» للبطاقات.')}
                  className="min-h-[56vh] rounded-none border-0 bg-transparent px-5 py-4 font-mono text-[0.875rem] leading-relaxed focus:ring-0" />
              </div>
            )}
            {view !== 'write' && (
              <article className="card min-h-[30vh] min-w-0 p-6 [overflow-wrap:anywhere]" aria-label={tx('Preview', 'معاينة')}>
                {body.trim() ? <Markdown source={body} onToggleTask={toggleTask} /> : <p className="text-sm text-muted-foreground">{tx('Nothing to preview yet.', 'لا شيء للمعاينة بعد.')}</p>}
              </article>
            )}
          </div>
        </div>
        <aside className="no-print flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
          {toc.length > 0 && view !== 'write' && <Toc items={toc} />}
          <div className="rounded-[var(--radius)] bg-surface p-4">
            <p className="text-sm font-medium">{tx('Flashcards in this note', 'بطاقات في هذه الملاحظة')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pairs.length ? tx(`${pairs.length} lines written as “term :: meaning”.`, `${pairs.length} سطر بصيغة «مصطلح :: معنى».`) : tx('Write lines like “Momentum :: p = mv” and turn them into a deck.', 'اكتب سطوراً مثل «الزخم :: p = mv» وحوّلها إلى مجموعة.')}</p>
            <Button size="sm" variant="secondary" className="mt-3 w-full" disabled={!pairs.length} onClick={makeCards}><Layers />{tx('Make flashcards', 'أنشئ بطاقات')}</Button>
          </div>
          <div className="flex flex-col gap-2 rounded-[var(--radius)] bg-surface p-4">
            <p className="text-sm font-medium">{tx('Study this note', 'ادرس هذه الملاحظة')}</p>
            <Button size="sm" asChild><Link href={`/app/study/create?note=${note.id}`}><Wand2 />{tx('Make cards with Murshid', 'أنشئ بطاقات مع مرشد')}</Link></Button>
            <Button size="sm" variant="secondary" onClick={quizMe}><BookOpenCheck />{tx('Quiz me on it', 'اختبرني فيها')}</Button>
            <Button size="sm" variant="secondary" onClick={addSummary}><ListCollapse />{tx('Add a summary', 'أضف ملخصاً')}</Button>
            <Button size="sm" variant={listening ? 'danger' : 'secondary'} onClick={dictate} aria-pressed={listening}>{listening ? <MicOff /> : <Mic />}{listening ? tx('Stop dictating', 'أوقف الإملاء') : tx('Dictate a lecture', 'أملِ محاضرة')}</Button>
            <p className="text-xs leading-relaxed text-muted-foreground">{tx('Dictation types what you or your teacher say, in this note.', 'يكتب الإملاء ما تقوله أنت أو معلمك في هذه الملاحظة.')}</p>
          </div>
        </aside>
      </div>
    </Page>
  );
}
