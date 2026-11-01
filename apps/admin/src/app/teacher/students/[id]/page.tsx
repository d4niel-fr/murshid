'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, Info, Lightbulb, Plus, Sparkles, TriangleAlert } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { PostAssignmentForm, type PostPreset } from '@/components/assignments';
import { GradeLine, StudyBars } from '@/components/charts';
import { PageHeader } from '@/components/shell';
import { STATUS_TONE } from '@/components/teacher';
import { Badge, Bar, Button, Card, cn, Empty, ErrorBox, Modal, SkeletonRows } from '@/components/ui';
import { getSession } from '@/lib/api';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

const SUB_LABEL: Record<string, [string, 'success' | 'warning' | 'danger' | 'info' | 'neutral']> = {
  on_time: ['On time', 'success'], late: ['Late', 'warning'], missing: ['Missing', 'danger'], submitted: ['Handed in', 'success'], pending: ['Open', 'info'], not_set: ['Not set', 'neutral'],
};
const KIND_ICON = { catch_up: TriangleAlert, practice: Lightbulb, stretch: Sparkles, check_in: CheckCircle2 } as const;

function StudentPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!getSession()) router.replace('/login'); else setReady(true); }, [router]);
  const list = useData<any>(ready ? '/teacher/students' : null, 'staff');
  const me = useData<any>(ready ? '/teacher/me' : null, 'staff');
  const mine = list.data?.students?.find((s: any) => s.id === id);
  const cls = params.get('class') ?? mine?.classes?.[0]?.id ?? null;
  const d = useData<any>(ready && cls ? `/teacher/classes/${cls}/students/${id}` : null, 'staff');
  const [assign, setAssign] = useState<PostPreset | null>(null);
  const [posted, setPosted] = useState<any>(null);

  const pick = (c: string) => router.replace(`/teacher/students/${id}?class=${c}`, { scroll: false });
  if (!ready) return <Empty>Loading…</Empty>;
  if (d.error) return <><BackLink cls={cls} /><ErrorBox error={d.error} /></>;
  if (!d.data) return <><BackLink cls={cls} /><Card pad={false}><SkeletonRows rows={6} /></Card></>;
  const s = d.data; const st = s.stats;
  const first = s.student.name.split(' ')[0];
  const today: string = me.data?.today ?? s.weeks[s.weeks.length - 1].weekStart;
  const trend = st.studyTrendPct;

  return (
    <>
      <BackLink cls={cls} />
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-x-3 gap-y-2">{s.student.name}<Badge tone={STATUS_TONE[s.status]} className="text-[12.5px]">{s.statusLabel}</Badge></span>}
        sub={`${s.student.section} · Grade ${s.student.grade} · ${s.class.name}`}
        action={<Button onClick={() => setAssign({ studentIds: [id] })}><Plus className="size-4" />Personalised assignment</Button>} />

      {(mine?.classes?.length ?? 0) > 1 && (
        <div role="tablist" aria-label="Classes" className="tabs-scroll -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {mine.classes.map((c: any) => (
            <button key={c.id} role="tab" aria-selected={c.id === cls} onClick={() => pick(c.id)} className={cn('h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors', c.id === cls ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]')}>{c.name}</button>
          ))}
        </div>
      )}

      {posted && (
        <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--success)_35%,var(--border))] bg-[color-mix(in_oklab,var(--success)_8%,var(--surface))] p-3.5 text-sm" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
          <span>&ldquo;{posted.assignment.title}&rdquo; set for {posted.students === 1 ? first : `${posted.students} students`}, due {posted.assignment.dueLabel}. It is in {posted.students === 1 ? 'their' : 'each student’s'} Murshid plan, with a work session on the lightest day.</span>
        </div>
      )}

      <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Handed in" value={`${st.completion}%`} sub={st.overdue ? `${st.overdue} overdue` : `${st.pending} open`} tone={st.completion < 70 ? 'danger' : undefined} />
        <StatCard label="Average mark" value={st.avgGrade === null ? '—' : `${st.avgGrade}%`} sub="this class" tone={st.avgGrade !== null && st.avgGrade < 60 ? 'danger' : undefined} />
        <StatCard label="On time" value={st.onTimeRate === null ? '—' : `${st.onTimeRate}%`} sub="of work due so far" />
        <StatCard label="Study last week" value={st.studyHoursLastWeek === null ? '—' : `${st.studyHoursLastWeek} h`} sub={trend === null ? 'estimated' : `${trend >= 0 ? '+' : ''}${trend}% on the week before`} tone={trend !== null && trend <= -20 ? 'warning' : undefined} />
      </dl>

      {s.flags.length > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-[var(--radius-sm)] bg-[var(--surface)] px-4 py-3 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" /><span><span className="font-medium">Why {s.statusLabel.toLowerCase()}:</span> {s.flags.join(' · ')}</span></p>
      )}

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <Card title="Study time per week" action={<span className="text-[11px] text-[var(--text-muted)]">estimated · last 8 weeks</span>}><StudyBars weeks={s.weeks} /></Card>
        <Card title="Marks over time" action={<span className="text-[11px] text-[var(--text-muted)]">{s.class.subjectName} · marked work</span>}><GradeLine points={s.gradeTrend} /></Card>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <Card title={`Personalised work for ${first}`} action={<Button size="sm" variant="outline" onClick={() => setAssign({ studentIds: [id] })}>Write your own</Button>}>
          <ul className="flex flex-col gap-3">
            {s.suggestions.map((g: any) => {
              const Icon = KIND_ICON[g.kind as keyof typeof KIND_ICON] ?? Lightbulb;
              return (
                <li key={g.title} className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] p-4 sm:flex-row sm:items-start">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--accent)]"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{g.title}</span>
                    <span className="mt-0.5 block text-sm text-[var(--text-muted)]">{g.instructions}</span>
                    <span className="mt-1.5 block text-xs text-[var(--text-muted)]">{g.why} · {g.minutes} min</span>
                  </span>
                  <Button size="sm" onClick={() => setAssign({ title: g.title, instructions: g.instructions, minutes: g.minutes, dueDate: g.dueDate, studentIds: [id] })}>Assign to {first}</Button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Every subject" pad={false}>
          <ul className="divide-y divide-[var(--border)]">
            {s.subjects.map((x: any) => (
              <li key={x.classId} className={cn('flex items-center gap-3 px-6 py-3', x.mine && 'bg-[color-mix(in_oklab,var(--brand-light)_6%,transparent)]')}>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.subject}{x.mine && <span className="ms-2 text-xs font-normal text-[var(--text-muted)]">your class</span>}</span><span className="block truncate text-xs text-[var(--text-muted)]">{x.teacher}</span></span>
                <span className="hidden w-28 items-center gap-2 sm:flex"><Bar value={x.completion} tone={x.completion < 70 ? 'warning' : 'accent'} /><span className="w-9 text-xs tabular-nums">{x.completion}%</span></span>
                <span className="w-12 text-end text-sm tabular-nums">{x.avgGrade === null ? '—' : `${x.avgGrade}%`}</span>
                {x.overdue > 0 && <Badge tone="danger">{x.overdue}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Recent work in this class" pad={false}>
          <ul className="divide-y divide-[var(--border)]">
            {s.items.map((it: any) => {
              const [label, tone] = SUB_LABEL[it.status] ?? ['', 'neutral'];
              return (
                <li key={it.id} className="flex min-w-0 items-center gap-3 px-4 py-3 sm:px-6">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{it.title}{it.personalised && <Badge tone="accent" className="ms-2">Personalised</Badge>}</span><span className="block text-xs text-[var(--text-muted)]">Due {it.dueLabel}</span></span>
                  {it.grade !== null && <span className="text-sm tabular-nums">{it.grade}%</span>}
                  <Badge tone={tone}>{label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Coming up">
          {s.tests.length ? (
            <ul className="flex flex-col gap-2 text-sm">{s.tests.map((t: any) => <li key={t.title + t.date} className="flex items-center gap-2"><CalendarClock className="size-4 shrink-0 text-[var(--text-muted)]" /><span className="min-w-0 flex-1 truncate">{t.title}</span><span className="shrink-0 text-xs text-[var(--text-muted)]">{t.label}</span></li>)}</ul>
          ) : <p className="text-sm text-[var(--text-muted)]">No tests in the next two weeks.</p>}
          <ul className="mt-5 list-disc space-y-1 border-t border-[var(--border)] ps-5 pt-4 text-[11px] leading-relaxed text-[var(--text-muted)]">{s.method.map((m: string) => <li key={m}>{m}</li>)}</ul>
        </Card>
      </div>

      <Modal open={assign !== null} title={`Assignment for ${first}`} onClose={() => setAssign(null)} wide>
        {assign && <PostAssignmentForm classId={cls!} initial={{ setDate: today, dueDate: assign.dueDate ?? today }} minutes={assign.minutes ?? 30}
          students={[{ id, name: s.student.name, status: s.status, statusLabel: s.statusLabel }]} preset={assign}
          onDone={(r) => { setAssign(null); setPosted(r); void d.reload(); }} />}
      </Modal>
    </>
  );
}

function BackLink({ cls }: { cls: string | null }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
      <Link href="/teacher/students" className="inline-flex items-center gap-1 hover:text-[var(--text)]"><ArrowLeft className="size-4" />My students</Link>
      {cls && <Link href={`/teacher?class=${cls}`} className="hover:text-[var(--text)]">Class progress</Link>}
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'danger' | 'warning' }) {
  return (
    <div className="card p-4 sm:p-5">
      <dt className="eyebrow">{label}</dt>
      <dd className={cn('figure mt-3 text-[1.875rem] sm:text-[2.25rem]', tone === 'danger' && 'text-[var(--danger)]', tone === 'warning' && 'text-[var(--warning)]')}>{value}</dd>
      <dd className="mt-1 truncate text-xs text-[var(--text-muted)]">{sub}</dd>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Empty>Loading…</Empty>}><StudentPage /></Suspense>;
}
