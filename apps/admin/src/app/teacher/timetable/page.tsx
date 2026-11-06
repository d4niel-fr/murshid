'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClassPicker, useClassPick } from '@/components/class-picker';
import { PageHeader } from '@/components/shell';
import { Button, Card, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
type L = { day: number; start: string; end: string; room: string; link: string | null };
const field = 'h-10 rounded-full border border-[var(--border)] bg-transparent px-3 text-sm';

/** When the class meets: students see it in their timetable with “now” and “next”, and a Join button for online lessons. */
export default function TimetablePage() {
  const k = useClassPick();
  const tt = useData<any>(k.id ? `/teacher/classes/${k.id}/timetable` : null, 'staff');
  const [rows, setRows] = useState<L[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (tt.data) setRows(tt.data.lessons); }, [tt.data]);
  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { await api(`/teacher/classes/${k.id}/timetable`, { method: 'PUT', body: { lessons: rows.map((r) => ({ ...r, link: r.link?.trim() || null })) }, as: 'staff' }); setMsg('Saved. Students see it now.'); await tt.reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const set = (i: number, patch: Partial<L>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <>
      <PageHeader title="Timetable" sub={k.current ? `${k.current.name}${tt.data && !tt.data.set ? ' · not set yet' : ''}` : 'When each class meets'} />
      <ClassPicker classes={k.classes} id={k.id} pick={k.pick} />
      <ErrorBox error={err ?? tt.error ?? k.error} />
      {!tt.data ? <Card pad={false}><SkeletonRows rows={4} /></Card> : (
        <Card title="Lessons each week" action={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setRows([...rows, { day: 1, start: '07:45', end: '08:30', room: '', link: null }])} disabled={rows.length >= 30}><Plus />Add lesson</Button><Button size="sm" onClick={() => void save()} disabled={busy}><Save />{busy ? 'Saving…' : 'Save'}</Button></div>}>
          {msg && <p className="mb-3 text-sm text-[var(--success)]" role="status">{msg}</p>}
          {!rows.length && <p className="text-sm text-[var(--text-muted)]">No lessons yet. Add each time the class meets in a normal week.</p>}
          <ul className="grid gap-2">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--surface)] p-2 sm:grid-cols-[6rem_6.5rem_6.5rem_7rem_1fr_auto]">
                <select aria-label="Day" value={r.day} onChange={(e) => set(i, { day: Number(e.target.value) })} className={field}>{DAYS.map((d, j) => <option key={d} value={j + 1}>{d}</option>)}</select>
                <input aria-label="Starts" type="time" value={r.start} onChange={(e) => set(i, { start: e.target.value })} className={field} />
                <input aria-label="Ends" type="time" value={r.end} onChange={(e) => set(i, { end: e.target.value })} className={field} />
                <input aria-label="Room" value={r.room} onChange={(e) => set(i, { room: e.target.value })} maxLength={24} placeholder="Room" className={field} />
                <input aria-label="Online lesson link" value={r.link ?? ''} onChange={(e) => set(i, { link: e.target.value })} placeholder="Teams or meeting link (optional)" className={`${field} col-span-2 sm:col-span-1`} />
                <button aria-label="Remove lesson" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="grid size-10 place-items-center justify-self-end rounded-full text-[var(--text-muted)] hover:text-[var(--danger)]"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
