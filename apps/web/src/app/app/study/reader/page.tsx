'use client';

import Link from 'next/link';
import { BookOpenText, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { Reader } from '@/components/study/reader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PASSAGES } from '@/lib/passages';
import { useStudy } from '@/lib/study';

/** Immersive Reader: paste anything, or open a note or a passage, and read it your way. */
export default function ReaderPage() {
  const { tx, locale } = useApp();
  const s = useStudy();
  const [doc, setDoc] = useState<{ title: string; text: string } | null>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const note = q.get('note'); const passage = q.get('passage');
    if (note) { const n = s.notes.find((x) => x.id === note); if (n) setDoc({ title: n.title, text: n.body }); }
    else if (passage) { const p = PASSAGES.find((x) => x.id === passage); if (p) setDoc({ title: p.title, text: p.text }); }
    else { const t = sessionStorage.getItem('murshid:reader'); if (t) { try { setDoc(JSON.parse(t)); } catch { /* ignore */ } } }
  }, [s.notes]);
  const open = (d: { title: string; text: string }) => { setDoc(d); try { sessionStorage.setItem('murshid:reader', JSON.stringify(d)); } catch { /* full */ } window.scrollTo({ top: 0 }); };
  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Immersive Reader', 'القارئ الشامل')}
        subtitle={tx('Bigger, calmer text that reads itself aloud, word by word. Helpful for long reading, a new language, or dyslexia.', 'نص أكبر وأهدأ يُقرأ بصوت عالٍ كلمةً كلمة. مفيد للقراءة الطويلة أو لغة جديدة أو عسر القراءة.')} />
      {doc ? <Reader text={doc.text} title={doc.title} onClose={() => { setDoc(null); sessionStorage.removeItem('murshid:reader'); }} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={tx('Paste any text', 'الصق أي نص')} icon={<BookOpenText />} />
            <textarea dir="auto" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={tx('A chapter, an article, instructions from a teacher…', 'فصل أو مقال أو تعليمات من المعلم…')} className="w-full rounded-[18px] border border-border bg-transparent px-4 py-3 text-[0.9375rem] outline-none focus:border-[var(--brand-light)]" />
            <Button className="mt-3 self-start" disabled={!draft.trim()} onClick={() => open({ title: '', text: draft })}>{tx('Open in the reader', 'افتح في القارئ')}</Button>
          </Card>
          <Card>
            <CardHeader title={tx('Or open one of yours', 'أو افتح من ملاحظاتك')} icon={<FileText />} />
            <ul className="grid max-h-80 gap-1.5 overflow-y-auto">
              {[...s.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20).map((n) => (
                <li key={n.id}><button onClick={() => open({ title: n.title, text: n.body })} className="flex min-h-11 w-full items-center gap-2 rounded-[14px] px-3 text-start text-sm hover:bg-surface"><FileText className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{n.title || tx('Untitled note', 'ملاحظة بلا عنوان')}</span></button></li>
              ))}
              {!s.notes.length && <li className="text-sm text-muted-foreground">{tx('No notes yet.', 'لا ملاحظات بعد.')} <Link href="/app/study/notes" className="text-primary">{tx('Write one', 'اكتب واحدة')}</Link></li>}
            </ul>
            <p className="mb-2 mt-5 text-xs text-muted-foreground">{tx('Reading passages', 'نصوص للقراءة')}</p>
            <div className="flex flex-wrap gap-1.5">
              {PASSAGES.filter((p) => p.lang === locale || locale === 'en').map((p) => <button key={p.id} onClick={() => open({ title: p.title, text: p.text })} className="h-9 rounded-full bg-surface px-3 text-xs hover:bg-surface-2" dir="auto">{p.title}</button>)}
            </div>
          </Card>
        </div>
      )}
    </Page>
  );
}
