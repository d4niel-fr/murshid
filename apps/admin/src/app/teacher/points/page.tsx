'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Undo2 } from 'lucide-react';
import { useState } from 'react';
import { ClassPicker, useClassPick } from '@/components/class-picker';
import { PageHeader } from '@/components/shell';
import { Button, Card, cn, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

/** Give points for effort, kindness and helping others (and a note when something needs work). Students are told. */
export default function PointsPage() {
  const k = useClassPick();
  const p = useData<any>(k.id ? `/teacher/classes/${k.id}/points` : null, 'staff');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('effort');
  const [pts, setPts] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const d = p.data;
  const r = d?.reasons.find((x: any) => x.id === reason);
  const give = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await api<any>(`/teacher/classes/${k.id}/points`, { method: 'POST', body: { studentIds: [...sel], reason, points: r?.positive ? pts : -1, note }, as: 'staff' });
      setMsg(`${r?.positive ? `+${pts}` : '−1'} ${r?.label.toLowerCase()} for ${res.awarded.length} student${res.awarded.length === 1 ? '' : 's'}.`);
      setSel(new Set()); setNote(''); await p.reload();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const undo = async (id: string) => { try { await api(`/teacher/points/${id}`, { method: 'DELETE', as: 'staff' }); await p.reload(); } catch (e) { setErr((e as Error).message); } };
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n); };
  return (
    <>
      <PageHeader title="Points" sub={d ? `${k.current?.name ?? ''} · class total ${d.classTotal} this term` : 'Recognise effort, kindness and helping others'} />
      <ClassPicker classes={k.classes} id={k.id} pick={k.pick} />
      <ErrorBox error={err ?? p.error ?? k.error} />
      {!d ? <Card pad={false}><SkeletonRows rows={6} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-8" title={`Pick students (${sel.size})`} action={<div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setSel(new Set(d.students.map((s: any) => s.id)))}>Whole class</Button>{sel.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>}</div>}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {d.students.map((s: any) => (
                <li key={s.id}>
                  <button onClick={() => toggle(s.id)} aria-pressed={sel.has(s.id)} className={cn('flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-start transition-colors', sel.has(s.id) ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-[var(--border)] hover:bg-[var(--surface)]')}>
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold', sel.has(s.id) ? 'bg-white/15' : 'bg-[var(--surface-2)]')}>{s.initials}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name.split(' ')[0]}</span><span className={cn('block text-xs tabular-nums', sel.has(s.id) ? 'text-white/70' : 'text-[var(--text-muted)]')}>{s.total} pts</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <div className="grid content-start gap-4 lg:col-span-4">
            <Card title="Give">
              <div className="flex flex-wrap gap-1.5">
                {d.reasons.map((x: any) => <button key={x.id} onClick={() => setReason(x.id)} aria-pressed={reason === x.id} className={cn('h-9 rounded-full px-3 text-xs font-medium', reason === x.id ? (x.positive ? 'bg-[var(--deep)] text-white' : 'bg-[var(--warning)] text-white') : 'bg-[var(--surface)]')}>{x.label}</button>)}
              </div>
              {r?.positive && <div className="mt-4 flex items-center gap-2 text-sm">Points {[1, 2, 3, 5].map((n) => <button key={n} onClick={() => setPts(n)} aria-pressed={pts === n} className={cn('size-9 rounded-full text-sm font-semibold', pts === n ? 'bg-[var(--deep)] text-white' : 'bg-[var(--surface)]')}>+{n}</button>)}</div>}
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note for the student (optional)" className="mt-4 h-10 w-full rounded-full border border-[var(--border)] bg-transparent px-4 text-sm" />
              <Button className="mt-4 w-full" disabled={!sel.size || busy} onClick={() => void give()}>{busy ? 'Saving…' : sel.size ? `${r?.positive ? `Give +${pts}` : 'Add note'} to ${sel.size}` : 'Pick students first'}</Button>
              {msg && <p className="mt-2 text-sm text-[var(--success)]" role="status">{msg}</p>}
            </Card>
            <Card title="Latest" pad={false}>
              <ul className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">
                {d.recent.map((x: any) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
                    <span className={cn('w-9 text-center font-semibold tabular-nums', x.points < 0 ? 'text-[var(--warning)]' : 'text-[var(--brand)]')}>{x.points > 0 ? `+${x.points}` : x.points}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate">{x.name}</span><span className="block text-xs text-[var(--text-muted)]">{d.reasons.find((y: any) => y.id === x.reason)?.label} · {x.at.slice(0, 10)}</span></span>
                    {!x.demo && <button onClick={() => void undo(x.id)} aria-label="Undo" className="grid size-8 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)]"><Undo2 className="size-4" /></button>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
