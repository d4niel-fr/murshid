'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Plus, Search } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { SaveButton } from '@/components/shared/actions';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { ago } from '@/lib/ago';
import { fadeUp, stagger } from '@/lib/motion';
import { isDue, study, SUBJECTS, useStudy } from '@/lib/study';

export function NewDeckDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { tx, toast } = useApp();
  const router = useRouter();
  const [title, setTitle] = useState(''); const [subject, setSubject] = useState('Physics'); const [busy, setBusy] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); if (busy || !title.trim()) return; setBusy(true);
    const id = study.addDeck(title, subject);
    toast({ title: tx('Deck created', 'أُنشئت المجموعة'), description: tx('Add your first cards.', 'أضف بطاقاتك الأولى.') });
    onOpenChange(false); setTitle(''); setBusy(false);
    router.push(`/app/study/flashcards/${id}`);
  };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent title={tx('New deck', 'مجموعة جديدة')} description={tx('A deck is a set of cards on one topic.', 'المجموعة بطاقات عن موضوع واحد.')}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div><Label htmlFor="deck-title">{tx('Title', 'العنوان')}</Label><Input id="deck-title" autoFocus required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('e.g. Waves and sound', 'مثل: الموجات والصوت')} /></div>
          <div><Label htmlFor="deck-subject">{tx('Subject', 'المادة')}</Label><Select id="deck-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</Select></div>
          <Button type="submit" disabled={busy || !title.trim()} className="self-end"><Plus />{tx('Create deck', 'إنشاء المجموعة')}</Button>
        </form>
      </DialogContent>
    </D.Root>
  );
}

type Sort = 'due' | 'name' | 'recent';

export function DecksView() {
  const { tx, locale } = useApp();
  const s = useStudy();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(''); const [subject, setSubject] = useState('all'); const [sort, setSort] = useState<Sort>('due');
  const now = Date.now();
  const rows = useMemo(() => {
    const list = s.decks.map((d) => {
      const cards = s.cards.filter((c) => c.deckId === d.id);
      return { d, total: cards.length, due: cards.filter((c) => isDue(c, now)).length, known: cards.filter((c) => c.reps >= 2).length };
    }).filter((r) => (subject === 'all' || r.d.subject === subject) && (!q.trim() || `${r.d.title} ${r.d.subject}`.toLowerCase().includes(q.trim().toLowerCase())));
    return list.sort((a, b) => (sort === 'name' ? a.d.title.localeCompare(b.d.title) : sort === 'recent' ? b.d.updatedAt - a.d.updatedAt : b.due - a.due || b.d.updatedAt - a.d.updatedAt));
  }, [s, q, subject, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const subjects = Array.from(new Set(s.decks.map((d) => d.subject)));

  return (
    <Page>
      <PageHeader eyebrow={<Link href="/app/study" className="hover:text-foreground">{tx('Study tools', 'أدوات الدراسة')}</Link>} title={tx('Flashcards', 'البطاقات التعليمية')}
        subtitle={tx('Rate each card after you answer. Hard ones come back soon; easy ones wait longer, so you spend time where it counts.', 'قيّم كل بطاقة بعد الإجابة. تعود الصعبة قريباً وتنتظر السهلة أطول، فتقضي وقتك حيث يهم.')}
        actions={<><SaveButton title={tx('Flashcards', 'البطاقات التعليمية')} /><Button onClick={() => setOpen(true)}><Plus />{tx('New deck', 'مجموعة جديدة')}</Button></>} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full bg-surface px-4">
          <Search className="size-4 text-muted-foreground" /><span className="sr-only">{tx('Search decks', 'ابحث في المجموعات')}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Search decks', 'ابحث في المجموعات')} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </label>
        <Select aria-label={tx('Subject', 'المادة')} value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 w-auto min-w-[160px] rounded-full"><option value="all">{tx('All subjects', 'كل المواد')}</option>{subjects.map((x) => <option key={x}>{x}</option>)}</Select>
        <Segmented ariaLabel={tx('Sort decks', 'ترتيب المجموعات')} value={sort} onChange={setSort} options={[{ value: 'due', label: tx('Most due', 'الأكثر استحقاقاً') }, { value: 'recent', label: tx('Recent', 'الأحدث') }, { value: 'name', label: tx('A–Z', 'أ–ي') }]} />
      </div>

      {rows.length ? (
        <motion.ul initial="hidden" animate="show" variants={stagger} className="grid grid-cols-12 gap-4">
          {rows.map(({ d, total, due, known }) => (
            <motion.li key={d.id} variants={fadeUp} className="col-span-12 sm:col-span-6 xl:col-span-4">
              <div className="lift card flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/app/study/flashcards/${d.id}`} className="min-w-0"><h2 className="card-title truncate hover:underline">{d.title}</h2></Link>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[0.7188rem] font-medium">{d.subject}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tx(`${total} cards`, `${total} بطاقة`)} · {tx('edited', 'عُدّلت')} {ago(d.updatedAt, locale)}</p>
                <div className="mt-4" aria-label={tx(`${known} of ${total} known`, `${known} من ${total} معروفة`)}>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{tx('Known', 'معروفة')}</span><span className="tabular">{total ? Math.round((known / total) * 100) : 0}%</span></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text)_8%,transparent)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${total ? (known / total) * 100 : 0}%` }} /></div>
                </div>
                <div className="mt-5 flex items-center gap-2">
                  <Button size="sm" asChild disabled={!total}><Link href={`/app/study/flashcards/${d.id}?mode=study`}>{due ? tx(`Study ${due} due`, `ادرس ${due} مستحقة`) : tx('Review', 'راجع')}</Link></Button>
                  {total >= 2 && <Button size="sm" variant="secondary" asChild><Link href={`/app/study/flashcards/${d.id}?mode=quiz`}>{tx('Quiz', 'اختبار')}</Link></Button>}
                  <Button size="sm" variant="ghost" asChild className="ms-auto"><Link href={`/app/study/flashcards/${d.id}`}>{tx('Edit', 'تعديل')}</Link></Button>
                </div>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      ) : (
        <EmptyState title={s.decks.length ? tx('No decks match', 'لا توجد مجموعات مطابقة') : tx('No decks yet', 'لا توجد مجموعات بعد')}
          action={<Button onClick={() => setOpen(true)}><Plus />{tx('New deck', 'مجموعة جديدة')}</Button>}>
          {s.decks.length ? tx('Try another search or subject.', 'جرّب بحثاً أو مادة أخرى.') : tx('Make a deck for a topic, then add cards: a question or term on the front, the answer on the back.', 'أنشئ مجموعة لموضوع، ثم أضف بطاقات: سؤال أو مصطلح في الأمام والإجابة في الخلف.')}
        </EmptyState>
      )}
      <NewDeckDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}
