'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Plus, Send } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { PageHeader, MicrosoftMark, useSession } from '@/components/shell';
import { Workings } from '@/components/workings';
import { AssignmentsList, Delegation, HomeworkTiming, ProgressTable, SummaryStats, WeeklyReports } from '@/components/teacher';
import { Button, Empty, ErrorBox, Modal, Tabs } from '@/components/ui';
import { api, getSession } from '@/lib/api';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

const TABS = [
  { id: 'progress', label: 'Class progress' },
  { id: 'delegate', label: 'Who needs what' },
  { id: 'timing', label: 'Best day for homework' },
  { id: 'weekly', label: 'Weekly reports' },
  { id: 'assignments', label: 'Assignments' },
];

function TeacherPortal() {
  const router = useRouter();
  const session = useSession();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('progress');
  const [classId, setClassId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [week, setWeek] = useState<'current' | 'last'>('current');
  const [posting, setPosting] = useState<null | { setDate: string; dueDate: string }>(null);
  const [posted, setPosted] = useState<any>(null);

  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return; }
    const p = new URLSearchParams(window.location.search);
    if (p.get('tab')) setTab(p.get('tab')!);
    setReady(true);
  }, [router]);
  const switchTab = (id: string) => { setTab(id); const u = new URL(window.location.href); u.searchParams.set('tab', id); window.history.replaceState(null, '', u); };

  const me = useData<any>(ready ? '/teacher/me' : null, 'staff');
  const cls = classId ?? me.data?.classes?.[0]?.id ?? null;
  const report = useData<any>(cls ? `/teacher/classes/${cls}/report` : null, 'staff');
  const rec = useData<any>(cls && tab === 'delegate' ? `/teacher/classes/${cls}/recommendations` : null, 'staff');
  const timing = useData<any>(cls ? `/teacher/classes/${cls}/homework-timing${minutes ? `?minutes=${minutes}` : ''}` : null, 'staff');
  const weekly = useData<any>(cls && tab === 'weekly' ? `/teacher/classes/${cls}/weekly-reports?week=${week}` : null, 'staff');
  const assignments = useData<any>(cls && tab === 'assignments' ? `/teacher/classes/${cls}/assignments` : null, 'staff');

  if (!ready || !session) return <Empty>Loading…</Empty>;
  const c = me.data?.classes?.find((x: any) => x.id === cls);
  const t = me.data?.teacher;
  const today: string = me.data?.today ?? '';
  const openPost = (setDate?: string, dueDate?: string) => setPosting({ setDate: setDate ?? today, dueDate: dueDate ?? timing.data?.best?.due ?? today });

  return (
    <>
      <PageHeader
        title={t ? <span>{t.name} <span className="font-normal text-[var(--text-muted)]">&middot; {c?.name ?? ''}</span></span> : 'My classes'}
        sub={me.data ? <span className="inline-flex flex-wrap items-center gap-x-2">{me.data.org.name} &middot; {c?.students ?? 0} students{me.data.org.microsoft?.connected && <> &middot; <span className="inline-flex items-center gap-1"><MicrosoftMark className="size-3" />Teams classes sync</span></>}</span> : null}
        action={<div className="flex items-center gap-2">
          {(me.data?.classes?.length ?? 0) > 1 && (
            <select aria-label="Class" className="input w-64" value={cls ?? ''} onChange={(e) => setClassId(e.target.value)}>
              {me.data.classes.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
          <Button onClick={() => openPost()} disabled={!cls}><Plus className="size-4" />Post assignment</Button>
        </div>} />
      <ErrorBox error={me.error ?? report.error} />
      {posted && (
        <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-[color-mix(in_oklab,var(--success)_35%,var(--border))] bg-[color-mix(in_oklab,var(--success)_8%,var(--surface))] p-3.5 text-sm" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" />
          <div className="min-w-0 flex-1">
            <div><span className="font-medium">&ldquo;{posted.assignment.title}&rdquo; sent to {posted.students} students</span>, due {posted.assignment.dueLabel}. It is already in their Murshid plan{posted.deliveredToApp.length ? ` (live now for ${posted.deliveredToApp.length} app user${posted.deliveredToApp.length > 1 ? 's' : ''})` : ''}.</div>
            {posted.automation && (
              <div className="mt-1 text-[var(--text-muted)]">
                Murshid replanned {posted.automation.replanned} students&rsquo; weeks and set {posted.automation.reminders} reminders.{' '}
                {posted.automation.overloaded.length
                  ? <span className="font-medium text-[var(--warning)]">At risk, extra support: {posted.automation.overloaded.length} of {posted.automation.students} &mdash; {posted.automation.overloaded.slice(0, 3).map((o: any) => `${o.name} (${o.reason})`).join('; ')}{posted.automation.overloaded.length > 3 ? '…' : ''}</span>
                  : 'Nobody is at risk from it.'}
              </div>
            )}
            {posted.automation?.featured && <Workings trace={posted.automation.featured.trace} who={posted.automation.featured.name} className="mt-2" />}
          </div>
        </div>
      )}
      {report.data && <SummaryStats s={report.data.summary} />}
      <div className="mb-4"><Tabs tabs={TABS} active={tab} onChange={switchTab} /></div>

      {tab === 'progress' && (report.data ? <ProgressTable report={report.data} subjectName={c?.subjectName ?? ''} /> : <Empty>Loading the class picture…</Empty>)}
      {tab === 'delegate' && (rec.data ? <Delegation rec={rec.data} /> : <Empty>Working out groups…</Empty>)}
      {tab === 'timing' && (timing.data ? <HomeworkTiming t={timing.data} minutes={minutes ?? timing.data.minutes} onMinutes={setMinutes} onUse={(s, d) => openPost(s, d)} /> : <Empty>Checking everyone&rsquo;s week…</Empty>)}
      {tab === 'weekly' && (weekly.data ? <WeeklyReports w={weekly.data} week={week} onWeek={setWeek} /> : <Empty>Loading reports…</Empty>)}
      {tab === 'assignments' && (assignments.data ? <AssignmentsList items={assignments.data.items} /> : <Empty>Loading…</Empty>)}

      <Modal open={posting !== null} title={`Post an assignment \u00b7 ${c?.name ?? ''}`} onClose={() => setPosting(null)} wide>
        {posting && <PostForm classId={cls!} initial={posting} minutes={timing.data?.minutes ?? c?.minutes ?? 45} best={timing.data?.best}
          onDone={(r) => { setPosting(null); setPosted(r); void report.reload(); void timing.reload(); void assignments.reload(); switchTab('assignments'); }} />}
      </Modal>
      <p className="mt-6 text-[11px] text-[var(--text-muted)]">Synthetic students. Every number is worked out from the class&rsquo;s seeded work, tests and activities with fixed rules (see &ldquo;How this is worked out&rdquo;). <Link href="/school" className="underline">School &amp; licence</Link></p>
    </>
  );
}

function PostForm({ classId, initial, minutes, best, onDone }: { classId: string; initial: { setDate: string; dueDate: string }; minutes: number; best?: any; onDone: (r: any) => void }) {
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [setDate, setSetDate] = useState(initial.setDate);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [mins, setMins] = useState(minutes);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true);
    try {
      onDone(await api(`/teacher/classes/${classId}/assignments`, { method: 'POST', as: 'staff', body: { title, instructions: instructions || null, setDate, dueDate, minutes: mins } }));
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };
  const isBest = best && best.set === setDate && best.due === dueDate;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <ErrorBox error={error} />
      <label className="field"><span className="text-sm font-medium">Title</span><input aria-label="Title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder='e.g. Poem analysis: "Keeping Quiet"' required minLength={3} /></label>
      <label className="field"><span className="text-sm font-medium">Instructions</span><textarea aria-label="Instructions" className="input" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What to do, how long, what to hand in" /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="field"><span className="text-sm font-medium">Set on</span><input aria-label="Set on" type="date" className="input" value={setDate} onChange={(e) => setSetDate(e.target.value)} /></label>
        <label className="field"><span className="text-sm font-medium">Due</span><input aria-label="Due" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <label className="field"><span className="text-sm font-medium">Minutes</span><input aria-label="Minutes" type="number" min={10} max={240} className="input" value={mins} onChange={(e) => setMins(Number(e.target.value))} /></label>
      </div>
      {best && <p className="text-xs text-[var(--text-muted)]">{isBest ? <span className="font-medium text-[var(--success)]">Recommended window: {best.likelihood}% likely on time.</span> : <>Recommended: set {best.setLabel}, due {best.dueLabel} ({best.likelihood}% likely on time).</>} It appears in each student&rsquo;s Murshid plan as soon as you post.</p>}
      <div className="flex justify-end gap-2"><Button type="submit" disabled={busy || title.trim().length < 3}><Send className="size-4" />Post to class</Button></div>
    </form>
  );
}

export default function Page() {
  return <Suspense fallback={<Empty>Loading…</Empty>}><TeacherPortal /></Suspense>;
}
