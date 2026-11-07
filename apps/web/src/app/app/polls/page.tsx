'use client';

import { Check, Lock, MessageSquareText } from 'lucide-react';
import { useState } from 'react';
import { SchoolSection } from '@/components/life/gate';
import { useLoad } from '@/components/life/use-load';
import { useApp } from '@/components/providers/app-provider';
import { Ago } from '@/components/shared/ago';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, Muted } from '@/components/ui/card';
import { answerPoll, getPolls, type Poll } from '@/lib/life-api';
import { cn } from '@/lib/utils';

const CONF_AR = ['أستطيع شرحه لغيري', 'فهمته', 'في الطريق', 'لم أفهم'];

export default function PollsPage() {
  const { tx } = useApp();
  const load = useLoad(getPolls);
  return (
    <SchoolSection title={tx('Questions from teachers', 'أسئلة المعلمين')} subtitle={tx('Quick polls, “how sure are you?” checks and exit tickets. Your written answers only go to your teacher.', 'استطلاعات سريعة وأسئلة «ما مدى فهمك؟» وبطاقات الخروج. إجاباتك المكتوبة تصل إلى معلمك فقط.')} load={load}>
      {(d) => !d.polls.length ? <Muted>{tx('No questions yet. When a teacher asks the class something, it shows up here.', 'لا أسئلة بعد. عندما يسأل المعلم الصف يظهر السؤال هنا.')}</Muted> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.polls.map((p) => <PollCard key={p.id} p={p} onChange={(np) => load.setData((x) => (x ? { polls: x.polls.map((q) => (q.id === np.id ? np : q)) } : x))} />)}
        </div>
      )}
    </SchoolSection>
  );
}

function PollCard({ p, onChange }: { p: Poll; onChange: (p: Poll) => void }) {
  const { tx, locale, client, toast } = useApp();
  const [choice, setChoice] = useState<number | null>(p.mine?.choice ?? null);
  const [text, setText] = useState(p.mine?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(!p.mine);
  const options = p.kind === 'confidence' && locale === 'ar' ? CONF_AR : p.options;
  const send = async () => {
    setBusy(true);
    try {
      const res = await answerPoll(client.devUser, p.id, { choice: p.kind === 'exit' ? null : choice, text: text.trim() });
      onChange({ ...p, ...res, className: p.className, mine: res.mine });
      setEditing(false);
    } catch (e) { toast({ tone: 'danger', title: (e as Error).message }); } finally { setBusy(false); }
  };
  const total = p.counts?.reduce((t, n) => t + n, 0) ?? 0;
  const showResults = !editing && p.counts && p.kind !== 'exit';
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge tone={p.open ? (p.mine ? 'outline' : 'navy') : 'neutral'}>{!p.open ? tx('Closed', 'مغلق') : p.mine ? tx('Answered', 'تمت الإجابة') : tx('Waiting for you', 'بانتظارك')}</Badge>
        <span>{p.className}</span><span>·</span><Ago ts={Date.parse(p.at)} locale={locale} />
        {p.anonymous && <span className="inline-flex items-center gap-1"><Lock className="size-3" />{tx('Anonymous', 'بدون اسم')}</span>}
      </div>
      <p dir="auto" className="text-lg font-medium leading-snug">{p.question}</p>
      {p.kind === 'exit' ? (
        editing && p.open ? (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-4">
            <textarea dir="auto" rows={3} maxLength={600} required value={text} onChange={(e) => setText(e.target.value)} placeholder={tx('Your answer…', 'إجابتك…')} className="w-full rounded-[18px] border border-border bg-transparent px-4 py-3 text-[0.9375rem] outline-none focus:border-[var(--brand-light)]" />
            <Button type="submit" size="sm" className="mt-2" disabled={busy || !text.trim()}>{tx('Send', 'أرسل')}</Button>
          </form>
        ) : p.mine ? <p dir="auto" className="mt-3 flex gap-2 rounded-[18px] bg-surface px-4 py-3 text-sm"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{p.mine.text}</p> : null
      ) : (
        <ul className="mt-4 grid gap-2">
          {options.map((o, i) => {
            const n = p.counts?.[i] ?? 0; const pct = total ? Math.round((n / total) * 100) : 0;
            const mine = p.mine?.choice === i;
            return (
              <li key={i}>
                <button type="button" disabled={!p.open || !editing} aria-pressed={choice === i} onClick={() => setChoice(i)}
                  className={cn('relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-[16px] border px-4 py-2.5 text-start text-sm transition-colors disabled:cursor-default', editing && choice === i ? 'border-[var(--deep)] bg-surface' : 'border-border', editing && p.open && 'hover:bg-surface')}>
                  {showResults && <span aria-hidden className="absolute inset-y-0 start-0 bg-[color-mix(in_oklab,var(--brand)_14%,transparent)] transition-[width] duration-500" style={{ width: `${pct}%` }} />}
                  <span className="relative flex-1" dir="auto">{o}</span>
                  {showResults && <span className="relative text-xs tabular-nums text-muted-foreground">{pct}%</span>}
                  {mine && !editing && <Check className="relative size-4 text-primary" aria-label={tx('Your answer', 'إجابتك')} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {p.kind !== 'exit' && editing && p.open && <Button size="sm" className="mt-3 self-start" disabled={busy || choice === null} onClick={() => void send()}>{tx('Send answer', 'أرسل الإجابة')}</Button>}
      {!editing && p.open && <button type="button" onClick={() => setEditing(true)} className="mt-3 self-start text-xs font-medium text-primary">{tx('Change my answer', 'غيّر إجابتي')}</button>}
      {showResults && <p className="mt-2 text-xs text-muted-foreground">{tx(`${total} answered`, `أجاب ${total}`)}</p>}
    </Card>
  );
}
