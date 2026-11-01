'use client';

import { Megaphone, Paperclip, Pin, PinOff, Send, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Files } from './files';
import { Badge, Button, Card, cn, EmptyState, ErrorBox, SkeletonRows } from './ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { uploadAs, ACCEPT_ATTACH, type FileRef } from '@/lib/classroom';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The class stream: announcements (one pinned), files and links, and the questions students ask under them. */
export function ClassStreamPanel({ classId }: { classId: string }) {
  const d = useData<any>(`/teacher/classes/${classId}/stream`, 'staff');
  const [text, setText] = useState('');
  const [pinned, setPinned] = useState(false);
  const [files, setFiles] = useState<FileRef[]>([]);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const attach = async (list: File[]) => { setErr(null); for (const f of list) { try { const r = await uploadAs(f); setFiles((x) => [...x, r]); } catch (e) { setErr((e as Error).message); } } };
  const post = async () => {
    if (!text.trim()) { setErr('Write the announcement first.'); return; }
    if (link.trim() && !/^https?:\/\/\S+\.\S+/.test(link.trim())) { setErr('Links start with https://'); return; }
    setBusy(true); setErr(null);
    try {
      await api(`/teacher/classes/${classId}/announcements`, { method: 'POST', as: 'staff', body: { text: text.trim(), pinned, fileIds: files.map((f) => f.id), links: link.trim() ? [{ url: link.trim(), label: '' }] : [] }, headers: { 'idempotency-key': newIdempotencyKey('ann') } });
      setText(''); setPinned(false); setFiles([]); setLink(''); await d.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const list: any[] = d.data?.announcements ?? [];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <Card title="Post to the class">
        <label className="field"><span>Announcement</span>
          <textarea aria-label="Announcement" className="input min-h-28" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="e.g. Quiz on chapter 4 on Thursday. Bring your notebooks." />
        </label>
        <Files files={files} compact className="mt-3" onRemove={(id) => setFiles((x) => x.filter((f) => f.id !== id))} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={input} type="file" multiple accept={ACCEPT_ATTACH} hidden onChange={(e) => { void attach([...(e.target.files ?? [])]); e.target.value = ''; }} />
          <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}><Paperclip />Attach</Button>
          <input aria-label="Link" type="url" inputMode="url" className="input h-9 min-w-[10rem] flex-1 text-sm" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (optional link)" />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="size-4 accent-[var(--deep)]" />Pin to the top</label>
        {err && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
        <div className="mt-4 flex justify-end"><Button onClick={() => void post()} disabled={busy}><Send />{busy ? 'Posting…' : 'Post'}</Button></div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Students see it on their School page and can ask questions underneath. New questions show in your Inbox.</p>
      </Card>
      <div className="min-w-0">
        <ErrorBox error={d.error} />
        {!d.data ? <Card pad={false}><SkeletonRows rows={4} /></Card> : !list.length ? (
          <Card><EmptyState icon={<Megaphone />} title="Nothing posted yet">Announcements, reminders, links and files for the whole class go here.</EmptyState></Card>
        ) : (
          <ul className="flex flex-col gap-3">{list.map((a) => <Announcement key={a.id} a={a} onChange={d.reload} />)}</ul>
        )}
      </div>
    </div>
  );
}

function Announcement({ a, onChange }: { a: any; onChange: () => Promise<void> | void }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await fn(); await onChange(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  let lastTeacher = -1; a.replies.forEach((r: any, i: number) => { if (r.from === 'teacher') lastTeacher = i; });
  const open = a.replies.slice(lastTeacher + 1).filter((r: any) => r.from === 'student').length;
  return (
    <li className={cn('card p-5', a.pinned && 'ring-1 ring-[color-mix(in_oklab,var(--deep)_35%,transparent)]')}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        {a.pinned && <Badge tone="accent"><Pin className="size-3" />Pinned</Badge>}
        {open > 0 && <Badge tone="warning">{open} unanswered</Badge>}
        <span>{a.authorName} · {when(a.at)}</span>
        <span className="ms-auto flex gap-1">
          <button type="button" disabled={busy} onClick={() => void act(() => api(`/teacher/announcements/${a.id}`, { method: 'PATCH', as: 'staff', body: { pinned: !a.pinned } }))} aria-label={a.pinned ? 'Unpin' : 'Pin to the top'} className="grid size-9 place-items-center rounded-full hover:bg-[var(--surface)]">{a.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}</button>
          <button type="button" disabled={busy} onClick={() => { if (window.confirm('Delete this announcement for everyone?')) void act(() => api(`/teacher/announcements/${a.id}`, { method: 'DELETE', as: 'staff' })); }} aria-label="Delete announcement" className="grid size-9 place-items-center rounded-full text-[var(--danger)] hover:bg-[var(--surface)]"><Trash2 className="size-4" /></button>
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{a.text}</p>
      <Files files={a.files} compact className="mt-3" />
      {a.links.map((l: any) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm text-[var(--accent)] hover:underline">{l.label}</a>)}
      {a.replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-s-2 border-[var(--border)] ps-3">
          {a.replies.map((r: any) => <li key={r.id} className="text-sm"><span className={cn('font-medium', r.from === 'teacher' && 'text-[var(--accent)]')}>{r.name}</span> <span className="[overflow-wrap:anywhere]">{r.text}</span></li>)}
        </ul>
      )}
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) void act(async () => { await api(`/teacher/announcements/${a.id}/replies`, { method: 'POST', as: 'staff', body: { text: reply.trim() } }); setReply(''); }); }}>
        <input aria-label="Reply" className="input h-10 flex-1 text-sm" value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} placeholder={open ? 'Answer the question…' : 'Reply…'} />
        <Button type="submit" size="sm" disabled={busy || !reply.trim()} aria-label="Send reply"><Send /></Button>
      </form>
      {err && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{err}</p>}
    </li>
  );
}
