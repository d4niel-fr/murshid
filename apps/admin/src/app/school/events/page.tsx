'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

const KINDS = [['holiday', 'Holiday'], ['exam', 'Exams'], ['trip', 'Trip'], ['event', 'Event'], ['meeting', 'Meeting'], ['sport', 'Sport']] as const;
const field = 'h-10 w-full rounded-full border border-[var(--border)] bg-transparent px-4 text-sm';

/** School dates: holidays, exams, trips and meetings. Students and parents see the ones for their grade. */
export default function EventsPage() {
  const list = useData<any>('/school/events', 'staff');
  const [f, setF] = useState({ title: '', date: '', end: '', kind: 'event', grades: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    setBusy(true); setErr(null);
    try {
      const grades = f.grades.split(/[,\s]+/).map(Number).filter((n) => n >= 1 && n <= 13);
      await api('/school/events', { method: 'POST', body: { title: f.title, date: f.date, end: f.end || undefined, kind: f.kind, grades, note: f.note }, as: 'staff' });
      setF({ title: '', date: '', end: '', kind: f.kind, grades: '', note: '' }); await list.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const del = async (id: string) => { if (!window.confirm('Remove this date?')) return; try { await api(`/school/events/${id}`, { method: 'DELETE', as: 'staff' }); await list.reload(); } catch (e) { setErr((e as Error).message); } };
  return (
    <>
      <PageHeader title="School dates" sub="Holidays, exams, trips and meetings. Students can add any of them to their phone's calendar." />
      <ErrorBox error={err ?? list.error} />
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5" title="Add a date">
          <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="grid gap-2 sm:grid-cols-2">
            <input aria-label="Title" required minLength={2} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Grade 10 trip to Al Ain" className={`${field} sm:col-span-2`} />
            <label className="text-xs text-[var(--text-muted)]">Starts<input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={`${field} mt-1 text-[var(--text)]`} /></label>
            <label className="text-xs text-[var(--text-muted)]">Ends (optional)<input type="date" min={f.date} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} className={`${field} mt-1 text-[var(--text)]`} /></label>
            <select aria-label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={field}>{KINDS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
            <input aria-label="Grades" value={f.grades} onChange={(e) => setF({ ...f, grades: e.target.value })} placeholder="Grades, e.g. 10, 11 (blank = all)" className={field} />
            <input aria-label="Note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={300} placeholder="Note for families (optional)" className={`${field} sm:col-span-2`} />
            <Button type="submit" disabled={busy} className="sm:col-span-2 sm:justify-self-start"><Plus />Add date</Button>
          </form>
        </Card>
        <Card className="lg:col-span-7" title="This school year" pad={false}>
          {!list.data ? <SkeletonRows rows={6} /> : (
            <ul className="divide-y divide-[var(--border)]">
              {list.data.events.map((e: any) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{e.date}{e.end !== e.date && <><br />→ {e.end}</>}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{e.title}</span>{(e.note || e.grades.length > 0) && <span className="block text-xs text-[var(--text-muted)]">{e.grades.length ? `Grades ${e.grades.join(', ')}` : ''}{e.grades.length && e.note ? ' · ' : ''}{e.note}</span>}</span>
                  <Badge>{KINDS.find(([id]) => id === e.kind)?.[1]}</Badge>
                  {e.editable ? <button aria-label={`Remove ${e.title}`} onClick={() => void del(e.id)} className="grid size-9 place-items-center rounded-full text-[var(--text-muted)] hover:text-[var(--danger)]"><Trash2 className="size-4" /></button> : <span className="w-9" />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
