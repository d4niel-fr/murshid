'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { EyeOff, Eye, MessageCircleHeart, Send } from 'lucide-react';
import { useState } from 'react';
import { ClassPicker, Face, useClassPick } from '@/components/class-picker';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, cn, Empty, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

const MOOD = ['Awful', 'Not great', 'Okay', 'Good', 'Great'];
const TONE = ['var(--danger)', 'var(--warning)', '#9aa1ad', 'var(--brand)', 'var(--success)'];

/**
 * How the class feels (from students' daily check-ins): the mix each day, the words they use, and who to check in with.
 * Only check-ins a student shares are shown by name; private ones are counted, never shown.
 */
export default function WellbeingPage() {
  const k = useClassPick();
  const [days, setDays] = useState(14);
  const [hide, setHide] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const f = useData<any>(k.id ? `/teacher/classes/${k.id}/feelings?days=${days}` : null, 'staff');
  const d = f.data;
  const word = (id: string) => d?.emotions.find((e: any) => e.id === id)?.en ?? id;
  const ask = async () => {
    setBusy(true); setErr(null);
    try { await api(`/teacher/classes/${k.id}/feelings/prompt`, { method: 'POST', body: { question: q }, as: 'staff' }); setQ(''); await f.reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const total = d ? d.distribution.reduce((t: number, n: number) => t + n, 0) : 0;
  const flagged = d?.students.filter((s: any) => s.flag) ?? [];
  return (
    <>
      <PageHeader title="Wellbeing" sub={d ? `${k.current?.name ?? ''} · ${d.responses} check-ins in the last ${d.days} days` : 'How your students feel, from their daily check-ins'}
        action={<div className="flex gap-2">
          <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-full border border-[var(--border)] bg-transparent px-3 text-sm"><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select>
          <Button variant="outline" onClick={() => setHide(!hide)} aria-pressed={hide}>{hide ? <Eye /> : <EyeOff />}{hide ? 'Show names' : 'Hide names'}</Button>
        </div>} />
      <ClassPicker classes={k.classes} id={k.id} pick={k.pick} />
      <ErrorBox error={err ?? f.error ?? k.error} />
      {!d ? <Card pad={false}><SkeletonRows rows={6} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-12">
          {flagged.length > 0 && (
            <Card className="lg:col-span-12" title={<span className="flex items-center gap-2"><MessageCircleHeart className="size-4" />Check in with</span>}>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {flagged.map((s: any, i: number) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-3 py-2.5">
                    {s.last && <Face mood={s.last.mood} className="size-8 shrink-0" />}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{hide ? `Student ${i + 1}` : s.name}</span><span className="block text-xs text-[var(--text-muted)]">{s.flag === 'talk' ? 'Asked to talk' : 'Low on recent check-ins'}{s.last && ` · ${s.last.words.map(word).join(', ')}`}</span></span>
                    <Badge tone={s.flag === 'talk' ? 'danger' : 'warning'}>{s.flag === 'talk' ? 'Talk' : 'Low'}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="lg:col-span-7" title="How the class felt">
            {!total ? <Empty>No check-ins yet in this period.</Empty> : (
              <>
                <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label={d.distribution.map((n: number, i: number) => `${MOOD[i]} ${n}`).join(', ')}>
                  {d.distribution.map((n: number, i: number) => n > 0 && <span key={i} style={{ width: `${(n / total) * 100}%`, background: TONE[i] }} />)}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">{d.distribution.map((n: number, i: number) => <li key={i} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: TONE[i] }} />{MOOD[i]} {Math.round((n / total) * 100)}%</li>)}</ul>
                <div className="mt-5 flex h-32 gap-1" role="img" aria-label="Check-ins by day">
                  {d.byDay.map((x: any) => {
                    const n = x.counts.reduce((t: number, v: number) => t + v, 0);
                    const max = Math.max(...d.byDay.map((y: any) => y.counts.reduce((t: number, v: number) => t + v, 0)), 1);
                    return (
                      <div key={x.date} className="group relative flex flex-1 flex-col justify-end" title={`${x.date}: ${n} check-ins, average ${x.average}`}>
                        <div className="flex flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${(n / max) * 100}%` }}>
                          {x.counts.map((v: number, i: number) => v > 0 && <span key={i} style={{ flex: v, background: TONE[i] }} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 flex justify-between text-[11px] text-[var(--text-muted)]"><span>{d.from}</span><span>{d.to}</span></p>
              </>
            )}
          </Card>
          <Card className="lg:col-span-5" title="Ask a check-in question">
            <p className="text-sm text-[var(--text-muted)]">Shown above today&apos;s check-in for this class, e.g. “How ready do you feel for Thursday’s test?”</p>
            <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="mt-3 flex gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} required minLength={3} maxLength={160} placeholder="Your question" className="h-10 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-transparent px-4 text-sm" />
              <Button type="submit" disabled={busy || q.trim().length < 3}><Send />Ask</Button>
            </form>
            {d.prompts.length > 0 && <ul className="mt-4 divide-y divide-[var(--border)] text-sm">{d.prompts.slice(0, 4).map((p: any) => <li key={p.id} className="py-2"><span className="block">{p.question}</span><span className="text-xs text-[var(--text-muted)]">{p.date}</span></li>)}</ul>}
            {d.words.length > 0 && <>
              <p className="mb-2 mt-5 text-xs text-[var(--text-muted)]">Words students used</p>
              <div className="flex flex-wrap gap-1.5">{d.words.map((w: any) => <Badge key={w.id}>{word(w.id)} · {w.n}</Badge>)}</div>
            </>}
          </Card>
          <Card className="lg:col-span-12" title="Students" pad={false}>
            <ul className="divide-y divide-[var(--border)]">
              {d.students.map((s: any, i: number) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{hide ? `Student ${i + 1}` : s.name}</span><span className="block text-xs text-[var(--text-muted)]">{s.checkIns} check-ins{s.last ? ` · last ${s.last.date}: ${s.last.words.map(word).join(', ') || MOOD[s.last.mood - 1]}` : ' · nothing shared'}</span>{!hide && s.last?.note && <span className="mt-0.5 block text-xs italic">“{s.last.note}”</span>}</span>
                  <span className="flex items-end gap-0.5" aria-label={s.trend.length ? `Recent moods ${s.trend.join(', ')}` : 'No shared check-ins'}>{s.trend.map((m: number, j: number) => <span key={j} className="w-1.5 rounded-full" style={{ height: 4 + m * 4, background: TONE[m - 1] }} />)}</span>
                  {s.average !== null && <Face mood={s.average} className="size-7" />}
                  {s.flag && <Badge tone={s.flag === 'talk' ? 'danger' : 'warning'}>{s.flag === 'talk' ? 'Talk' : 'Low'}</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <p className={cn('mt-4 text-xs text-[var(--text-muted)]')}>Students choose whether to share each check-in. If a student tells you something that worries you, follow your school&apos;s safeguarding procedure.</p>
    </>
  );
}
