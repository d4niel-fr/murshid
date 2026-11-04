'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Cpu, FileText, FileUp, Layers, ListPlus, Loader2, NotebookText, Plus, Sparkles, Trash2, Video, Wand2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { Button } from '@/components/ui/button';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { ExtractError, extractText, IMPORT_ACCEPT } from '@/lib/extract';
import { Markdown } from '@/lib/markdown';
import { count, nAr } from '@/lib/plural';
import { study, SUBJECTS, useStudy } from '@/lib/study';
import { generate, type Generated } from '@/lib/study-ai';
import { cn } from '@/lib/utils';
import { SubjectOptions } from '@/components/shared/subject';

type Source = 'paste' | 'file' | 'note' | 'import' | 'video';
type Make = 'both' | 'cards' | 'notes';

/** A first guess at the subject from the words in the material (the student can change it). */
function guessSubject(text: string): string {
  const t = text.toLowerCase();
  // English words use word boundaries; Arabic ones match as stems, since \b only knows Latin letters
  const score: [string, RegExp, RegExp][] = [
    ['Physics', /\b(force|momentum|velocity|acceleration|newton|energy|wave|circuit|voltage|current|resistance|gravity|joule)\b/g, /(قوة|القوى|زخم|الزخم|سرعة|تسارع|نيوتن|طاقة|موجة|دائرة كهربائية|جهد|مقاومة|جاذبية|جول)/g],
    ['Mathematics', /\b(integral|derivative|equation|function|matrix|vector|probability|theorem|polynomial|trigonometr\w*|logarithm)\b/g, /(تكامل|مشتقة|معادلة|دالة|مصفوفة|متجه|احتمال|مبرهنة|نظرية|كثيرة حدود|لوغاريتم|مثلثات)/g],
    ['Economics', /\b(market|demand|supply|elasticity|inflation|gdp|monopoly|externalit\w*|price|economy)\b/g, /(سوق|الطلب|العرض|مرونة|تضخم|الناتج المحلي|احتكار|سعر|الأسعار|اقتصاد)/g],
    ['Chemistry', /\b(mole|reaction|atom|molecule|bond|acid|base|electron|ion|compound|periodic)\b/g, /(مول|تفاعل|ذرة|جزيء|رابطة|حمض|قاعدة|إلكترون|أيون|مركب|الجدول الدوري)/g],
    ['Biology', /\b(cell|enzyme|dna|protein|organism|photosynthesis|respiration|gene|tissue|evolution)\b/g, /(خلية|الخلايا|إنزيم|بروتين|كائن حي|البناء الضوئي|التمثيل الضوئي|تنفس|جين|نسيج|تطور)/g],
    ['English', /\b(poem|poet|metaphor|simile|novel|stanza|imagery|narrator|theme|character)\b/g, /$^/g],
    ['Arabic', /$^/g, /(قصيدة|الشاعر|استعارة|تشبيه|كناية|بلاغة|النحو|إعراب|المبتدأ|الخبر|الفاعل|بحر شعري)/g],
    ['Business Studies', /\b(marketing|cash flow|profit|revenue|stakeholder|business|entrepreneur|break-even)\b/g, /(تسويق|التدفق النقدي|ربح|أرباح|إيرادات|أصحاب المصلحة|ريادة|نقطة التعادل)/g],
  ];
  let best = 'Other'; let top = 2;
  for (const [s, en, ar] of score) { const n = (t.match(en) ?? []).length + (text.match(ar) ?? []).length; if (n > top) { top = n; best = s; } }
  return best;
}

export function CreateView() {
  const { tx, client, toast } = useApp();
  const s = useStudy();
  const router = useRouter();
  const params = useSearchParams();
  const [source, setSource] = useState<Source>((params.get('from') as Source) || 'paste');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [make, setMake] = useState<Make>('both');
  const [howMany, setHowMany] = useState(20);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Other');
  // once the student picks a subject (or it comes from a note), the guess from the text stops changing it
  const subjectSet = useRef(false);
  const pickSubject = (v: string) => { subjectSet.current = true; setSubject(v); };
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Generated | null>(null);
  const [cards, setCards] = useState<{ front: string; back: string; kind?: string }[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // /app/study/create?note=<id> starts from a note
  useEffect(() => {
    const id = params.get('note');
    const n = id ? s.notes.find((x) => x.id === id) : null;
    if (n) { setSource('note'); setText(n.body); setTitle(n.title); pickSubject(n.subject); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (text.length > 80 && !subjectSet.current) setSubject(guessSubject(text)); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const readFile = async (f: File) => {
    setError(null); setReading(true); setFileName(f.name);
    try {
      const t = await extractText(f);
      setText(t);
      if (!title) { const t = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 80); setTitle(t.charAt(0).toUpperCase() + t.slice(1)); }
    } catch (e) {
      setError(e instanceof ExtractError ? e.message : tx('That file could not be read.', 'تعذّرت قراءة الملف.'));
      setText('');
    } finally { setReading(false); }
  };

  const enough = text.trim().length >= 20;
  const run = async () => {
    if (!enough) { setError(tx('Add a few sentences of material first.', 'أضف بضع جمل من المادة أولاً.')); return; }
    setBusy(true); setError(null);
    try {
      const r = await generate(client.devUser, text, make, { title: title || undefined, max: howMany });
      setResult(r); setCards(r.cards.map((c) => ({ front: c.front, back: c.back, kind: c.kind })));
      setNoteTitle(r.notes?.title || title || tx('Notes', 'ملاحظات'));
      if (!r.cards.length && make !== 'notes') setError(tx('No cards came out of this. Try more text, or lines like “term – meaning”.', 'لم تُستخرج بطاقات. جرّب نصاً أطول أو سطوراً مثل «مصطلح – معنى».'));
    } finally { setBusy(false); }
  };

  const save = (thenLearn = false) => {
    const deckTitle = title.trim() || noteTitle || tx('New deck', 'مجموعة جديدة');
    const from = fileName ?? (source === 'note' ? tx('From a note', 'من ملاحظة') : source === 'import' ? tx('Imported', 'مستوردة') : source === 'video' ? tx('From a lecture transcript', 'من نص محاضرة') : tx('From pasted text', 'من نص ملصق'));
    let deckId: string | null = null; let noteId: string | null = null;
    const keep = cards.filter((c) => c.front.trim() && c.back.trim());
    if (make !== 'notes' && keep.length) deckId = study.createDeck(deckTitle, subject, keep, from);
    if (make !== 'cards' && result?.notes) {
      noteId = study.addNote(subject);
      study.saveNote(noteId, { title: noteTitle.trim() || deckTitle, body: result.notes.body, tags: ['made with Murshid'] });
    }
    study.addXp(10);
    toast({ title: tx('Saved to Study', 'حُفظ في الدراسة'), description: [deckId && tx(count(keep.length, 'card'), nAr(keep.length, 'card')), noteId && tx('notes', 'ملاحظات')].filter(Boolean).join(' · '), tone: 'success' });
    if (deckId) router.push(`/app/study/flashcards/${deckId}${thenLearn ? '?mode=learn' : ''}`);
    else if (noteId) router.push(`/app/study/notes/${noteId}`);
  };

  const sources: { value: Source; label: string; icon: typeof FileUp }[] = [
    { value: 'paste', label: tx('Paste text', 'الصق نصاً'), icon: FileText },
    { value: 'file', label: tx('Upload a file', 'ارفع ملفاً'), icon: FileUp },
    { value: 'note', label: tx('From a note', 'من ملاحظة'), icon: NotebookText },
    { value: 'import', label: tx('Quizlet / Anki', 'Quizlet / Anki'), icon: ListPlus },
    { value: 'video', label: tx('Lecture or video', 'محاضرة أو فيديو'), icon: Video },
  ];

  if (result) {
    return (
      <Page>
        <button type="button" onClick={() => setResult(null)} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('Back to the material', 'العودة إلى المادة')}</button>
        <PageHeader eyebrow={tx('Check and save', 'راجع واحفظ')} title={tx('Here is what Murshid made', 'هذا ما صنعه مرشد')}
          subtitle={<span className="inline-flex flex-wrap items-center gap-2"><EngineBadge engine={result.engine} model={result.model} />{tx('Edit anything before you save. Nothing is saved yet.', 'عدّل ما تريد قبل الحفظ. لم يُحفظ شيء بعد.')}</span>}
          actions={<>
            <Button variant="secondary" onClick={() => save(false)} disabled={make !== 'notes' && !cards.some((c) => c.front.trim() && c.back.trim())}>{tx('Save', 'حفظ')}</Button>
            {make !== 'notes' && <Button onClick={() => save(true)} disabled={!cards.some((c) => c.front.trim() && c.back.trim())}><Sparkles />{tx('Save and start learning', 'احفظ وابدأ التعلم')}</Button>}
          </>} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {make !== 'notes' && (
            <section className={cn('card p-5', make === 'both' ? 'lg:col-span-7' : 'lg:col-span-12')}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="card-title">{tx(`Flashcards (${cards.length})`, `البطاقات (${cards.length})`)}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Input aria-label={tx('Deck title', 'عنوان المجموعة')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('Deck title', 'عنوان المجموعة')} className="h-9 w-48" />
                  <Select aria-label={tx('Subject', 'المادة')} value={subject} onChange={(e) => pickSubject(e.target.value)} className="h-9 w-40"><SubjectOptions list={SUBJECTS} /></Select>
                </div>
              </div>
              <ol className="flex flex-col gap-2">
                {cards.map((c, i) => (
                  <li key={i} className="group grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-2xl bg-surface p-2.5 sm:grid-cols-[auto_1fr_1.4fr_auto]">
                    <span className="grid size-7 place-items-center rounded-full bg-[var(--bg)] text-xs tabular text-muted-foreground">{i + 1}</span>
                    <Textarea dir="auto" aria-label={tx(`Card ${i + 1} front`, `أمام البطاقة ${i + 1}`)} rows={2} value={c.front} onChange={(e) => setCards((x) => x.map((y, j) => (j === i ? { ...y, front: e.target.value } : y)))} className="min-h-0 bg-[var(--bg)] text-sm font-medium" />
                    <Textarea dir="auto" aria-label={tx(`Card ${i + 1} back`, `خلف البطاقة ${i + 1}`)} rows={2} value={c.back} onChange={(e) => setCards((x) => x.map((y, j) => (j === i ? { ...y, back: e.target.value } : y)))} className="col-span-2 min-h-0 bg-[var(--bg)] text-sm sm:col-span-1" />
                    <button type="button" onClick={() => setCards((x) => x.filter((_, j) => j !== i))} aria-label={tx(`Remove card ${i + 1}`, `احذف البطاقة ${i + 1}`)} className="col-start-3 row-start-1 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-[var(--bg)] hover:text-[var(--danger)] sm:col-start-4"><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ol>
              <Button variant="ghost" className="mt-3" onClick={() => setCards((x) => [...x, { front: '', back: '' }])}><Plus />{tx('Add a card', 'أضف بطاقة')}</Button>
            </section>
          )}
          {make !== 'cards' && result.notes && (
            <section className={cn('card p-5', make === 'both' ? 'lg:col-span-5' : 'lg:col-span-12')}>
              <h2 className="card-title mb-3">{tx('Notes', 'الملاحظات')}</h2>
              <Input aria-label={tx('Note title', 'عنوان الملاحظة')} value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className="mb-4 font-medium" />
              <div className="max-h-[60vh] overflow-y-auto rounded-2xl bg-surface p-4 text-sm"><Markdown source={result.notes.body} /></div>
            </section>
          )}
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <Link href="/app/study" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('Study', 'الدراسة')}</Link>
      <PageHeader eyebrow={tx('Create with Murshid', 'أنشئ مع مرشد')} title={tx('Turn your material into study tools', 'حوّل موادك إلى أدوات دراسة')}
        subtitle={tx('Slides, a PDF, class notes, a lecture transcript or a deck from Quizlet or Anki: Murshid makes flashcards and clean notes from it.', 'شرائح أو PDF أو ملاحظات الصف أو نص محاضرة أو مجموعة من Quizlet أو Anki: يصنع مرشد منها بطاقات وملاحظات مرتبة.')} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="card p-5 lg:col-span-8">
          <div role="tablist" aria-label={tx('Where the material comes from', 'مصدر المادة')} className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {sources.map(({ value, label, icon: Icon }) => (
              <button key={value} role="tab" aria-selected={source === value} type="button" onClick={() => { setSource(value); setError(null); }}
                className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors', source === value ? 'bg-[var(--deep)] text-white' : 'bg-surface text-muted-foreground hover:text-foreground')}><Icon className="size-4" />{label}</button>
            ))}
          </div>

          {source === 'file' && (
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void readFile(f); }}
              className={cn('mb-4 flex flex-col items-center gap-3 rounded-[24px] border-2 border-dashed px-6 py-10 text-center transition-colors', dragOver ? 'border-[var(--brand)] bg-[color-mix(in_oklab,var(--brand)_6%,transparent)]' : 'border-border')}>
              <FileUp className="size-8 text-muted-foreground" />
              <p className="text-sm">{reading ? tx(`Reading ${fileName}…`, `جارٍ قراءة ${fileName}…`) : fileName && text ? tx(`${fileName}: ${text.length.toLocaleString()} characters read`, `${fileName}: قُرئ ${text.length} حرفاً`) : tx('Drop a PDF, PowerPoint, Word, text or CSV file here', 'أفلت ملف PDF أو PowerPoint أو Word أو نص أو CSV هنا')}</p>
              <input ref={fileInput} type="file" accept={IMPORT_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} />
              <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={reading}>{reading ? <Loader2 className="animate-spin" /> : <FileUp />}{tx('Choose a file', 'اختر ملفاً')}</Button>
              <p className="text-xs text-muted-foreground">{tx('Read on this device. Up to 25 MB, 120 pages.', 'يُقرأ على هذا الجهاز. حتى 25 ميغابايت و120 صفحة.')}</p>
            </div>
          )}
          {source === 'note' && (
            <div className="mb-4">
              <Label htmlFor="cr-note">{tx('Pick a note', 'اختر ملاحظة')}</Label>
              <Select id="cr-note" defaultValue="" onChange={(e) => { const n = s.notes.find((x) => x.id === e.target.value); if (n) { setText(n.body); setTitle(n.title); pickSubject(n.subject); } }}>
                <option value="" disabled>{tx('Choose…', 'اختر…')}</option>
                {s.notes.map((n) => <option key={n.id} value={n.id}>{n.title || tx('Untitled note', 'ملاحظة بلا عنوان')}</option>)}
              </Select>
            </div>
          )}
          {source === 'import' && <p className="mb-3 rounded-2xl bg-surface px-4 py-3 text-sm text-muted-foreground">{tx('Quizlet: open the set › ⋯ › Export › Copy text. Anki: File › Export › Notes in Plain Text. Paste below (one card per line, term and meaning separated by a tab, “ - ” or “::”), or upload the .csv / .txt file.', 'Quizlet: افتح المجموعة › ⋯ › Export › Copy text. Anki: File › Export › Notes in Plain Text. الصق هنا (بطاقة في كل سطر، المصطلح والمعنى بينهما Tab أو « - » أو «::») أو ارفع الملف.')}</p>}
          {source === 'video' && <p className="mb-3 rounded-2xl bg-surface px-4 py-3 text-sm text-muted-foreground">{tx('On YouTube: open the video › ⋯ (under it) › Show transcript, select all of it and paste it below. For a lesson in class, record it as a note with “Dictate” and come back here.', 'على YouTube: افتح الفيديو › ⋯ › عرض النص، حدد كل النص والصقه هنا. لدرس في الصف، سجّله كملاحظة بزر «إملاء» ثم عد إلى هنا.')}</p>}

          <Label htmlFor="cr-text">{source === 'file' ? tx('What was read (you can edit it)', 'ما تمت قراءته (يمكنك تعديله)') : tx('Material', 'المادة')}</Label>
          <Textarea id="cr-text" dir="auto" value={text} onChange={(e) => setText(e.target.value)} rows={source === 'file' ? 8 : 12} maxLength={60_000} className="font-[inherit] text-sm"
            placeholder={source === 'import' ? 'Enjambment\tA sentence running past the end of a line\nCaesura\tA pause in the middle of a line' : tx('Paste class notes, a textbook page or slide text. Definitions (“X is …”), formulas and bullet lists work best.', 'الصق ملاحظات الصف أو صفحة من الكتاب أو نص الشرائح. التعريفات («س هو …») والمعادلات والقوائم تعطي أفضل نتيجة.')} />
          <p className="mt-1 text-end text-xs tabular text-muted-foreground">{text.length.toLocaleString()} / 60,000</p>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </section>

        <aside className="card flex flex-col gap-4 p-5 lg:col-span-4">
          <h2 className="card-title">{tx('What to make', 'ماذا تصنع')}</h2>
          <Segmented stretch ariaLabel={tx('What to make', 'ماذا تصنع')} value={make} onChange={setMake} options={[{ value: 'both', label: tx('Both', 'الاثنان') }, { value: 'cards', label: tx('Cards', 'بطاقات') }, { value: 'notes', label: tx('Notes', 'ملاحظات') }]} />
          <div><Label htmlFor="cr-title">{tx('Title', 'العنوان')}</Label><Input id="cr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('e.g. Market failure', 'مثل: إخفاق السوق')} maxLength={80} /></div>
          <div><Label htmlFor="cr-subj">{tx('Subject', 'المادة')}</Label><Select id="cr-subj" value={subject} onChange={(e) => pickSubject(e.target.value)}><SubjectOptions list={SUBJECTS} /></Select></div>
          {make !== 'notes' && (
            <div>
              <p className="mb-1.5 text-sm font-medium">{tx('How many cards (at most)', 'عدد البطاقات (حد أقصى)')}</p>
              <Segmented stretch size="sm" ariaLabel={tx('How many cards', 'عدد البطاقات')} value={String(howMany)} onChange={(v) => setHowMany(Number(v))} options={['10', '20', '30', '50'].map((n) => ({ value: n, label: n }))} />
            </div>
          )}
          <Button size="lg" onClick={() => void run()} disabled={busy || reading || !enough}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />}{busy ? tx('Making…', 'جارٍ الصنع…') : tx('Make it', 'اصنع')}</Button>
          <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
            <li className="flex gap-2"><Layers className="size-4 shrink-0" />{tx('Definitions, formulas, lists and fill-in-the-blank cards, from your material only.', 'تعريفات ومعادلات وقوائم وبطاقات ملء الفراغ، من مادتك فقط.')}</li>
            <li className="flex gap-2"><Cpu className="size-4 shrink-0" />{tx('With AI models when they are on; otherwise Murshid’s own rules, even offline.', 'بنماذج الذكاء الاصطناعي عند تشغيلها؛ وإلا بقواعد مرشد، حتى دون اتصال.')}</li>
          </ul>
        </aside>
      </div>
    </Page>
  );
}

export function EngineBadge({ engine, model }: { engine: Generated['engine']; model?: string | null }) {
  const { tx } = useApp();
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', engine === 'model' ? 'tint-info' : 'bg-surface-2 text-foreground')} title={model ?? undefined}>
      <Cpu className="size-3.5" />{engine === 'model' ? tx('Made with AI models', 'بنماذج الذكاء الاصطناعي') : engine === 'rules' ? tx('Made by Murshid’s rules', 'بقواعد مرشد') : tx('Made on this device', 'صُنع على هذا الجهاز')}
    </span>
  );
}
