'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Lock, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ClassPicker, useClassPick } from '@/components/class-picker';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, cn, Empty, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

const KINDS = [
  { id: 'confidence', label: 'How sure are you?', hint: 'Four levels from “I could teach it” to “I’m lost”' },
  { id: 'choice', label: 'Multiple choice', hint: 'Up to six options' },
  { id: 'exit', label: 'Exit ticket', hint: 'A short written answer' },
] as const;

/** Ask the class in a few seconds: a confidence check, a poll or an exit ticket; results update live. */
export default function PollsPage() {
  const k = useClassPick();
  const list = useData<any>(k.id ? `/teacher/classes/${k.id}/polls` : null, 'staff');
  const [kind, setKind] = useState<'confidence' | 'choice' | 'exit'>('confidence');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // live results while a poll is open
  useEffect(() => {
    if (!list.data?.polls.some((p: any) => p.open)) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') void list.reload(); }, 5000);
    return () => clearInterval(t);
  }, [list]);
  const create = async () => {
    setBusy(true); setErr(null);
    try { await api(`/teacher/classes/${k.id}/polls`, { method: 'POST', body: { kind, question, options: kind === 'choice' ? options.filter((o) => o.trim()) : [], anonymous }, as: 'staff' }); setQuestion(''); setOptions(['', '']); await list.reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const close = async (id: string) => { try { await api(`/teacher/polls/${id}/close`, { method: 'POST', as: 'staff' }); await list.reload(); } catch (e) { setErr((e as Error).message); } };
  return (
    <>
      <PageHeader title="Polls and exit tickets" sub={k.current ? `${k.current.name} · answers appear here as students send them` : 'Check understanding in seconds'} />
      <ClassPicker classes={k.classes} id={k.id} pick={k.pick} />
      <ErrorBox error={err ?? list.error ?? k.error} />
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5" title="Ask the class">
          <div className="grid gap-2">
            {KINDS.map((x) => <button key={x.id} onClick={() => setKind(x.id)} aria-pressed={kind === x.id} className={cn('rounded-2xl border px-4 py-2.5 text-start', kind === x.id ? 'border-[var(--deep)] bg-[var(--surface)]' : 'border-[var(--border)]')}><span className="block text-sm font-medium">{x.label}</span><span className="block text-xs text-[var(--text-muted)]">{x.hint}</span></button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void create(); }} className="mt-4 grid gap-2">
            <input value={question} onChange={(e) => setQuestion(e.target.value)} required minLength={3} maxLength={200} placeholder={kind === 'confidence' ? 'e.g. Simultaneous equations' : kind === 'exit' ? 'e.g. One thing you learned today' : 'Your question'} className="h-10 rounded-full border border-[var(--border)] bg-transparent px-4 text-sm" />
            {kind === 'choice' && options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} maxLength={80} placeholder={`Option ${i + 1}`} className="h-10 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-transparent px-4 text-sm" />
                {options.length > 2 && <button type="button" aria-label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-full hover:bg-[var(--surface)]"><X className="size-4" /></button>}
              </div>
            ))}
            {kind === 'choice' && options.length < 6 && <Button type="button" size="sm" variant="ghost" className="justify-self-start" onClick={() => setOptions([...options, ''])}><Plus />Add option</Button>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="size-4 accent-[var(--deep)]" />Anonymous (you see answers, not names)</label>
            <Button type="submit" disabled={busy || question.trim().length < 3 || (kind === 'choice' && options.filter((o) => o.trim()).length < 2)}>{busy ? 'Sending…' : 'Send to the class'}</Button>
          </form>
        </Card>
        <div className="grid content-start gap-4 lg:col-span-7">
          {!list.data ? <Card pad={false}><SkeletonRows rows={4} /></Card> : !list.data.polls.length ? <Empty>No polls yet for this class.</Empty> : list.data.polls.map((p: any) => {
            const total = p.counts.reduce((t: number, n: number) => t + n, 0);
            return (
              <Card key={p.id} title={<span className="flex flex-wrap items-center gap-2">{p.question}{p.anonymous && <Lock className="size-3.5 text-[var(--text-muted)]" />}</span>}
                action={<div className="flex items-center gap-2"><Badge tone={p.open ? 'success' : 'neutral'}>{p.open ? 'Open' : 'Closed'}</Badge><span className="text-xs text-[var(--text-muted)]">{p.responses}/{list.data.students}</span>{p.open && <Button size="sm" variant="outline" onClick={() => void close(p.id)}>Close</Button>}</div>}>
                {p.kind !== 'exit' ? (
                  <ul className="grid gap-2">
                    {p.options.map((o: string, i: number) => {
                      const pct = total ? Math.round((p.counts[i] / total) * 100) : 0;
                      return <li key={i} className="relative overflow-hidden rounded-xl bg-[var(--surface)] px-3 py-2 text-sm"><span aria-hidden className="absolute inset-y-0 left-0 bg-[color-mix(in_oklab,var(--brand)_18%,transparent)]" style={{ width: `${pct}%` }} /><span className="relative flex justify-between gap-3"><span>{o}</span><span className="tabular-nums text-[var(--text-muted)]">{p.counts[i]} · {pct}%</span></span></li>;
                    })}
                  </ul>
                ) : !p.texts.length ? <p className="text-sm text-[var(--text-muted)]">No answers yet.</p> : (
                  <ul className="grid gap-2 sm:grid-cols-2">{p.texts.map((t: any, i: number) => <li key={i} className="rounded-xl bg-[var(--surface)] px-3 py-2 text-sm">{t.text}{t.name && <span className="mt-1 block text-xs text-[var(--text-muted)]">{t.name}</span>}</li>)}</ul>
                )}
                {p.waiting?.length > 0 && p.open && <p className="mt-3 text-xs text-[var(--text-muted)]">Still to answer: {p.waiting.slice(0, 8).join(', ')}{p.waiting.length > 8 ? ` and ${p.waiting.length - 8} more` : ''}</p>}
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
