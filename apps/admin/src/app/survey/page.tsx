'use client';

import { PageHeader } from '@/components/shell';
import { Badge, Card, Empty, ErrorBox, Stat, Tabs } from '@/components/ui';
import { useData } from '@/lib/use-data';
import { useEffect, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const WEB_ENV = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MURSHID_WEB : undefined;

function Bars({ q }: { q: any }) {
  const max = Math.max(1, ...q.counts.map((c: any) => c.n));
  return (
    <div className="space-y-1.5">
      {q.counts.map((c: any) => (
        <div key={c.label} className="grid grid-cols-[minmax(120px,40%)_1fr_44px] items-center gap-2 text-xs">
          <span className="truncate" title={c.label}>{q.kind === 'scale' ? `${c.label} ${c.label === '1' ? '(low)' : c.label === '5' ? '(high)' : ''}` : c.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${(c.n / max) * 100}%`, minWidth: c.n ? 4 : 0 }} /></span>
          <span className="text-right tabular-nums text-[var(--text-muted)]">{c.n}{q.answered ? ` · ${Math.round((c.n / q.answered) * 100)}%` : ''}</span>
        </div>
      ))}
    </div>
  );
}

export default function SurveyResults() {
  const r = useData<any>('/admin/survey');
  const [tab, setTab] = useState<'student' | 'teacher'>('student');
  // the student site shares this domain (it is at /), so the share link uses this page's origin
  const [WEB, setWeb] = useState(WEB_ENV ?? '');
  useEffect(() => { if (!WEB_ENV) setWeb(window.location.origin); }, []);
  const d = r.data;
  return (
    <>
      <PageHeader title="Survey results" sub={<span>Anonymous validation survey. Share <a className="underline" href={`${WEB}/survey`} target="_blank" rel="noreferrer">{WEB.replace(/^https?:\/\//, '')}/survey</a> with students and teachers. Real responses only: nothing here is simulated.</span>} />
      <ErrorBox error={r.error} />
      {d && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Responses" value={d.total} sub={d.store === 'supabase' ? 'Stored in Supabase' : 'In memory (resets on restart)'} />
            <Stat label="Students" value={d.byVersion.student} sub="Target: 20+" />
            <Stat label="Teachers / counsellors" value={d.byVersion.teacher} sub="Target: 3+ teachers, 1 counsellor" />
            <Stat label="Collected" value={d.first ? new Date(d.first).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'} sub={d.last ? `to ${new Date(d.last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'No responses yet'} />
          </div>
          <div className="mb-4"><Tabs tabs={[{ id: 'student', label: 'Student version', count: d.byVersion.student }, { id: 'teacher', label: 'Teacher version', count: d.byVersion.teacher }]} active={tab} onChange={(id) => setTab(id as 'student' | 'teacher')} /></div>
          {d.byVersion[tab] === 0 ? <Empty>No {tab} responses yet.</Empty> : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {d.versions[tab].map((q: any, i: number) => (
                <Card key={q.id} title={<span>{i + 1}. {q.text}</span>} action={<span className="flex gap-1.5">{q.mean !== undefined && <Badge tone="accent">avg {q.mean}/5</Badge>}<Badge>{q.answered} answered</Badge></span>}>
                  {q.kind === 'text'
                    ? (q.texts?.length ? <ul className="list-disc space-y-1 pl-4 text-sm">{q.texts.map((t: string, k: number) => <li key={k}>{t}</li>)}</ul> : <p className="text-sm text-[var(--text-muted)]">No comments yet.</p>)
                    : <Bars q={q} />}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
      {!d && !r.error && <Empty>Loading…</Empty>}
    </>
  );
}
