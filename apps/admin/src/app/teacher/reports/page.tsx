'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Check, Eye, EyeOff, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClassPicker, useClassPick } from '@/components/class-picker';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, cn, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

/** Term reports: each student's numbers next to your comment, with suggested sentences built from their record. */
export default function ReportsPage() {
  const k = useClassPick();
  const [term, setTerm] = useState('');
  const rep = useData<any>(k.id ? `/teacher/classes/${k.id}/reports${term ? `?term=${term}` : ''}` : null, 'staff');
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const d = rep.data;
  useEffect(() => { if (d && !term) setTerm(d.term); }, [d, term]);
  const publish = async (published: boolean) => {
    setErr(null);
    try { await api(`/teacher/classes/${k.id}/reports/publish`, { method: 'POST', body: { term: d.term, published }, as: 'staff' }); await rep.reload(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <PageHeader title="Term reports" sub={d ? `${d.class.name} · ${d.done} of ${d.rows.length} comments written${d.published ? ' · published' : ''}` : 'Comments for every student'}
        action={d && <div className="flex flex-wrap gap-2">
          <select aria-label="Term" value={term} onChange={(e) => setTerm(e.target.value)} className="h-10 rounded-full border border-[var(--border)] bg-transparent px-3 text-sm"><option value="T1">Term 1</option><option value="T2">Term 2</option><option value="T3">Term 3</option></select>
          {d.published ? <Button variant="outline" onClick={() => void publish(false)}><EyeOff />Hide from students</Button> : <Button onClick={() => { if (window.confirm(`Publish ${d.done} reports? Students and parents will see them.`)) void publish(true); }} disabled={!d.done}><Eye />Publish to students</Button>}
        </div>} />
      <ClassPicker classes={k.classes} id={k.id} pick={k.pick} />
      <ErrorBox error={err ?? rep.error ?? k.error} />
      {!d ? <Card pad={false}><SkeletonRows rows={8} /></Card> : (
        <Card pad={false}>
          <ul className="divide-y divide-[var(--border)]">
            {d.rows.map((r: any) => <Row key={r.id} r={r} term={d.term} classId={d.class.id} effort={d.effort} open={open === r.id} onOpen={() => setOpen(open === r.id ? null : r.id)} onSaved={() => { void rep.reload(); }} />)}
          </ul>
        </Card>
      )}
    </>
  );
}

function Row({ r, term, classId, effort, open, onOpen, onSaved }: { r: any; term: string; classId: string; effort: string[]; open: boolean; onOpen: () => void; onSaved: () => void }) {
  const [comment, setComment] = useState(r.report?.comment ?? '');
  const [eff, setEff] = useState<number>(r.report?.effort ?? 3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    try { await api(`/teacher/classes/${classId}/reports/${r.id}`, { method: 'PUT', body: { term, comment, effort: eff }, as: 'staff' }); onSaved(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const stat = (label: string, v: string, bad?: boolean) => <span className={cn('rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs tabular-nums', bad && 'text-[var(--danger)]')}>{label} {v}</span>;
  return (
    <li className="px-4 py-3 sm:px-6">
      <button onClick={onOpen} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 text-start">
        <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{r.name}</span><span className="block truncate text-xs text-[var(--text-muted)]">{r.report?.comment || 'No comment yet'}</span></span>
        <span className="flex flex-wrap gap-1.5">{stat('Avg', r.average === null ? '–' : `${r.average}%`, r.average !== null && r.average < 50)}{stat('Att', r.attendance === null ? '–' : `${r.attendance}%`, r.attendance !== null && r.attendance < 90)}{stat('Pts', String(r.points))}{r.missing > 0 && stat('Missing', String(r.missing), true)}</span>
        {r.report ? <Badge tone="success"><Check className="size-3" />Done</Badge> : <Badge>To write</Badge>}
      </button>
      {open && (
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_18rem]">
          <div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={5} maxLength={1500} placeholder={`A comment for ${r.name.split(' ')[0]}…`} className="w-full rounded-2xl border border-[var(--border)] bg-transparent p-3 text-sm outline-none focus:border-[var(--brand-light)]" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select aria-label="Effort" value={eff} onChange={(e) => setEff(Number(e.target.value))} className="h-9 rounded-full border border-[var(--border)] bg-transparent px-3 text-sm">{[4, 3, 2, 1].map((n) => <option key={n} value={n}>{effort[n]}</option>)}</select>
              <Button size="sm" onClick={() => void save()} disabled={busy || !comment.trim()}>{busy ? 'Saving…' : 'Save'}</Button>
              <span className="text-xs text-[var(--text-muted)]">{comment.length}/1500</span>
            </div>
            {err && <p className="mt-2 text-sm text-[var(--danger)]">{err}</p>}
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Wand2 className="size-3.5" />Suggestions from their record (tap to add)</p>
            <ul className="grid gap-1.5">{r.suggestions.map((s: string, i: number) => <li key={i}><button onClick={() => setComment((c: string) => (c ? `${c.trim()} ${s}` : s))} className="w-full rounded-xl bg-[var(--surface)] px-3 py-2 text-start text-xs leading-relaxed hover:bg-[var(--surface-2)]">{s}</button></li>)}</ul>
          </div>
        </div>
      )}
    </li>
  );
}
