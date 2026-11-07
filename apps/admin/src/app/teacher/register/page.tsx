'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CheckCheck, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ClassPicker, useClassPick } from '@/components/class-picker';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, cn, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

type Mark = 'present' | 'late' | 'absent' | 'excused';
const MARKS: { id: Mark; label: string; short: string; on: string }[] = [
  { id: 'present', label: 'Present', short: 'P', on: 'bg-[var(--success)] text-white' },
  { id: 'late', label: 'Late', short: 'L', on: 'bg-[var(--warning)] text-white' },
  { id: 'absent', label: 'Absent', short: 'A', on: 'bg-[var(--danger)] text-white' },
  { id: 'excused', label: 'Excused', short: 'E', on: 'bg-[var(--info)] text-white' },
];

/** Take the register: everyone present by default, tap to change, save. Approved leave shows as excused. */
export default function RegisterPage() {
  const k = useClassPick();
  const [date, setDate] = useState('');
  const reg = useData<any>(k.id ? `/teacher/classes/${k.id}/attendance${date ? `?date=${date}` : ''}` : null, 'staff');
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!reg.data) return;
    setMarks(Object.fromEntries(reg.data.students.map((s: any) => [s.id, s.mark ?? 'present'])));
    if (!date) setDate(reg.data.date);
  }, [reg.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => MARKS.map((m) => Object.values(marks).filter((x) => x === m.id).length), [marks]);
  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { const r = await api<any>(`/teacher/classes/${k.id}/attendance`, { method: 'PUT', body: { date: reg.data.date, marks }, as: 'staff' }); setMsg(`Saved ${r.saved} students.`); await reg.reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const d = reg.data;
  return (
    <>
      <PageHeader title="Register" sub={d ? `${d.class.name} · ${d.taken ? 'taken' : 'not taken yet'}${d.classRate !== null ? ` · ${d.classRate}% attendance this term` : ''}` : 'Attendance for each lesson'}
        action={<input type="date" aria-label="Date" value={date} max={d?.today} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-full border border-[var(--border)] bg-transparent px-4 text-sm" />} />
      <ClassPicker classes={k.classes} id={k.id} pick={k.pick} />
      <ErrorBox error={err ?? reg.error ?? k.error} />
      {!d ? <Card pad={false}><SkeletonRows rows={8} /></Card> : (
        <Card title={<span className="flex flex-wrap items-center gap-2">{MARKS.map((m, i) => <Badge key={m.id} tone={i === 0 ? 'success' : i === 1 ? 'warning' : i === 2 ? 'danger' : 'info'}>{counts[i]} {m.label.toLowerCase()}</Badge>)}</span>}
          action={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setMarks(Object.fromEntries(d.students.map((s: any) => [s.id, s.leave ? 'excused' : 'present'])))}><CheckCheck />All present</Button><Button size="sm" onClick={() => void save()} disabled={busy}><Save />{busy ? 'Saving…' : 'Save register'}</Button></div>}>
          {msg && <p className="mb-3 text-sm text-[var(--success)]" role="status">{msg}</p>}
          <ul className="divide-y divide-[var(--border)]">
            {d.students.map((s: any) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-medium">{s.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{s.section}{s.rate !== null && ` · ${s.rate}% this term`}{s.absences ? ` · ${s.absences} absent` : ''}{s.leave && <span className="text-[var(--info)]"> · leave: {s.leave.reason}</span>}</span>
                </span>
                <div role="radiogroup" aria-label={`Mark for ${s.name}`} className="flex gap-1">
                  {MARKS.map((m) => (
                    <button key={m.id} role="radio" aria-checked={marks[s.id] === m.id} aria-label={m.label} title={m.label} onClick={() => setMarks({ ...marks, [s.id]: m.id })}
                      className={cn('grid size-10 place-items-center rounded-full text-sm font-semibold transition-colors', marks[s.id] === m.id ? m.on : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]')}>{m.short}</button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
