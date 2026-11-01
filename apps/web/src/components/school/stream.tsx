'use client';

import Link from 'next/link';
import { BellRing, Megaphone, MessageSquare, Pin, Send, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Ago } from '@/components/shared/ago';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { newIdempotencyKey } from '@/lib/http';
import { dismissReminder, replyToAnnouncement, type Announcement, type Reminder } from '@/lib/school-api';
import { cn } from '@/lib/utils';
import { Files } from './files';

/** Reminders a teacher sent: a gentle banner with the assignment and a way to dismiss it. */
export function Reminders({ items, onDismiss }: { items: Reminder[]; onDismiss: (id: string) => void }) {
  const { client, tx } = useApp();
  if (!items.length) return null;
  return (
    <ul className="mb-4 flex flex-col gap-2" aria-label={tx('Reminders from teachers', 'تذكيرات من المعلمين')}>
      {items.slice(0, 3).map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-2xl tint-warning px-4 py-3">
          <BellRing className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="font-medium">{r.teacherName}</strong> {tx('reminded you about', 'ذكّرك بـ')} <Link className="font-medium underline underline-offset-2" href={`/app/school/assignments/${encodeURIComponent(r.itemId)}`}>{r.title}</Link>{r.note ? `: “${r.note}”` : ''}
          </p>
          <button type="button" aria-label={tx('Dismiss reminder', 'إخفاء التذكير')} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-black/5"
            onClick={() => { onDismiss(r.id); void dismissReminder(client.devUser, r.id).catch(() => {}); }}><X className="size-4" /></button>
        </li>
      ))}
    </ul>
  );
}

/** Class announcements (pinned first) with questions underneath. */
export function ClassStream({ items, onReply }: { items: Announcement[]; onReply: (id: string, r: Announcement['replies'][number]) => void }) {
  const { tx } = useApp();
  return (
    <Card className="col-span-12 lg:col-span-7">
      <CardHeader title={tx('Class stream', 'ساحة الصف')} icon={<Megaphone />} />
      {!items.length && <Muted>{tx('Announcements from your teachers show here: what to bring, quiz dates, links. You can ask questions under each one.', 'تظهر هنا إعلانات معلميك: ما يجب إحضاره ومواعيد الاختبارات والروابط. يمكنك طرح الأسئلة تحت كل إعلان.')}</Muted>}
      <ul className="flex flex-col gap-3">
        {items.slice(0, 6).map((a) => <Post key={a.id} a={a} onReply={(r) => onReply(a.id, r)} />)}
      </ul>
    </Card>
  );
}

function Post({ a, onReply }: { a: Announcement; onReply: (r: Announcement['replies'][number]) => void }) {
  const { client, tx, locale } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try { onReply(await replyToAnnouncement(client.devUser, a.id, text.trim(), newIdempotencyKey())); setText(''); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <li className={cn('rounded-2xl border p-4', a.pinned ? 'border-[color-mix(in_oklab,var(--deep)_30%,transparent)] bg-[color-mix(in_oklab,var(--deep)_4%,transparent)]' : 'border-border')}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {a.pinned && <span className="inline-flex items-center gap-1 font-medium text-foreground"><Pin className="size-3" />{tx('Pinned', 'مثبّت')}</span>}
        <span className="font-medium text-foreground">{a.authorName}</span>
        {a.subject && <span>· {a.subject}</span>}
        <span>· <Ago ts={Date.parse(a.at)} locale={locale} /></span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{a.text}</p>
      {(a.files.length > 0 || a.links.length > 0) && (
        <div className="mt-3 flex flex-col gap-2">
          <Files files={a.files} compact />
          {a.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-primary underline-offset-2 hover:underline">{l.label}</a>)}
        </div>
      )}
      {a.replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-s-2 border-border ps-3">
          {a.replies.map((r) => <li key={r.id} className="text-sm"><span className={cn('font-medium', r.from === 'teacher' && 'text-primary')}>{r.name}</span> <span className="[overflow-wrap:anywhere]">{r.text}</span></li>)}
        </ul>
      )}
      {open ? (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label className="sr-only" htmlFor={`q-${a.id}`}>{tx('Your question', 'سؤالك')}</label>
          <Input id={`q-${a.id}`} autoFocus value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder={tx('Ask the class or your teacher…', 'اسأل صفك أو معلمك…')} className="h-10 flex-1" />
          <Button type="submit" size="icon" aria-label={tx('Send', 'إرسال')} disabled={busy || !text.trim()}><Send className="rtl:-scale-x-100" /></Button>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><MessageSquare className="size-4" />{tx('Ask a question', 'اطرح سؤالاً')}</button>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
    </li>
  );
}
