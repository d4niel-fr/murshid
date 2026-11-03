'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { fadeUp, stagger } from '@/lib/motion';
import { study, SUBJECTS, useStudy, type Confidence } from '@/lib/study';
import { cn } from '@/lib/utils';

export function TopicsView() {
  const { tx } = useApp();
  const s = useStudy();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newSubject, setNewSubject] = useState('Chemistry');
  const LEVELS: [Confidence, string, string][] = [
    [0, tx('Not started', 'لم أبدأ'), 'tint-danger'], [1, tx('Shaky', 'ضعيف'), 'tint-warning'], [2, tx('Getting there', 'أتقدّم'), 'tint-info'], [3, tx('Confident', 'متقن'), 'tint-success'],
  ];
  const subjects = Array.from(new Set(s.topics.map((t) => t.subject)));
  const shown = filter === 'all' ? subjects : subjects.filter((x) => x === filter);
  const weakest = [...s.topics].sort((a, b) => a.confidence - b.confidence).slice(0, 3);

  return (
    <Page>
      <PageHeader eyebrow={<Link href="/app/study" className="hover:text-foreground">{tx('Study tools', 'أدوات الدراسة')}</Link>} title={tx('Topic tracker', 'متتبع المواضيع')}
        subtitle={tx('Rate how well you know each topic. Before an exam, the shaky ones are where your revision time goes first.', 'قيّم مدى معرفتك بكل موضوع. قبل الامتحان، تبدأ المراجعة بالمواضيع الضعيفة.')}
        actions={weakest.length ? <Button variant="secondary" asChild><Link href={`/app/chat?q=${encodeURIComponent(`Make me a revision plan for ${weakest.map((t) => `${t.subject} ${t.name}`).join(', ')}`)}`}><MessageCircle />{tx('Plan my revision', 'خطط مراجعتي')}</Link></Button> : undefined} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select aria-label={tx('Subject', 'المادة')} value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 w-auto min-w-[180px] rounded-full"><option value="all">{tx('All subjects', 'كل المواد')}</option>{subjects.map((x) => <option key={x}>{x}</option>)}</Select>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!subjects.includes(newSubject)) study.addTopic(newSubject, tx('First topic', 'الموضوع الأول')); setFilter(newSubject); }}>
          <Select aria-label={tx('Add a subject', 'أضف مادة')} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} className="h-10 w-auto rounded-full">{SUBJECTS.filter((x) => !subjects.includes(x)).map((x) => <option key={x}>{x}</option>)}</Select>
          <Button type="submit" variant="secondary" size="md"><Plus />{tx('Add subject', 'أضف مادة')}</Button>
        </form>
        <div className="ms-auto flex flex-wrap gap-1.5" aria-hidden>{LEVELS.map(([, l, tone]) => <span key={l} className={cn('rounded-full px-2.5 py-1 text-[0.6875rem] font-medium', tone)}>{l}</span>)}</div>
      </div>
      {shown.length ? (
        <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-12 gap-4">
          {shown.map((subject) => {
            const items = s.topics.filter((t) => t.subject === subject);
            const pct = items.length ? Math.round((items.reduce((a, t) => a + t.confidence, 0) / (items.length * 3)) * 100) : 0;
            return (
              <motion.section key={subject} variants={fadeUp} className="card col-span-12 p-5 lg:col-span-6">
                <div className="mb-1 flex items-center justify-between"><h2 className="card-title">{subject}</h2><span className="text-sm tabular text-muted-foreground">{pct}%</span></div>
                <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--text)_8%,transparent)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={tx(`${subject} readiness`, `جاهزية ${subject}`)}><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} /></div>
                <ul className="flex flex-col">
                  {items.map((t) => (
                    <li key={t.id} className="group flex flex-wrap items-center gap-2 border-b border-border py-2.5 last:border-0">
                      {renaming === t.id ? (
                        <form className="min-w-0 flex-1" onSubmit={(e) => { e.preventDefault(); study.renameTopic(t.id, (e.currentTarget.elements.namedItem('n') as HTMLInputElement).value); setRenaming(null); }}>
                          <input name="n" autoFocus defaultValue={t.name} onBlur={(e) => { study.renameTopic(t.id, e.target.value); setRenaming(null); }} onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(null); }} aria-label={tx('Topic name', 'اسم الموضوع')} className="h-9 w-full rounded-[10px] bg-surface px-2 text-[0.9375rem] outline-none ring-1 ring-border focus:ring-[var(--accent)]" />
                        </form>
                      ) : <span className="min-w-0 flex-1 cursor-text text-[0.9375rem]" onDoubleClick={() => setRenaming(t.id)} title={tx('Double-click to rename', 'انقر مرتين لإعادة التسمية')}>{t.name}</span>}
                      <div role="radiogroup" aria-label={tx(`How well do you know ${t.name}?`, `ما مدى معرفتك بـ ${t.name}؟`)} className="flex gap-1">
                        {LEVELS.map(([c, l, tone]) => (
                          <button key={c} type="button" role="radio" aria-checked={t.confidence === c} title={l} onClick={() => study.setConfidence(t.id, c)}
                            className={cn('h-7 rounded-full px-2.5 text-[0.6875rem] font-medium transition-colors', t.confidence === c ? tone : 'bg-transparent text-muted-foreground hover:bg-surface-2')}>
                            {t.confidence === c ? l : <span className="sr-only">{l}</span>}<span aria-hidden className={cn(t.confidence === c && 'hidden')}>●</span>
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => study.removeTopic(t.id)} aria-label={tx(`Remove ${t.name}`, `إزالة ${t.name}`)} className="grid size-7 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface-2 focus-visible:opacity-100 group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); study.addTopic(subject, draft[subject] ?? ''); setDraft({ ...draft, [subject]: '' }); }}>
                  <Input aria-label={tx(`New ${subject} topic`, `موضوع ${subject} جديد`)} value={draft[subject] ?? ''} onChange={(e) => setDraft({ ...draft, [subject]: e.target.value })} placeholder={tx('Add a topic', 'أضف موضوعاً')} className="h-9 rounded-full text-sm" maxLength={60} />
                  <Button type="submit" size="sm" variant="secondary" disabled={!(draft[subject] ?? '').trim()}><Plus />{tx('Add', 'أضف')}</Button>
                </form>
              </motion.section>
            );
          })}
        </motion.div>
      ) : <EmptyState title={tx('No topics yet', 'لا توجد مواضيع بعد')}>{tx('Add a subject above, then list its topics from your syllabus.', 'أضف مادة أعلاه ثم أدرج مواضيعها من منهجك.')}</EmptyState>}
    </Page>
  );
}
