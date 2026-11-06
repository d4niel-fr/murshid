'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from 'next/link';
import { Face } from '@/components/class-picker';
import { PageHeader } from '@/components/shell';
import { Badge, Card, cn, Empty, ErrorBox, SkeletonRows } from '@/components/ui';
import { useData } from '@/lib/use-data';

/** For school leaders and counsellors: wellbeing by grade, every student who asked to talk or has been low, and attendance by class. */
export default function SchoolWellbeingPage() {
  const w = useData<any>('/school/wellbeing?days=14', 'staff');
  const a = useData<any>('/school/attendance', 'staff');
  return (
    <>
      <PageHeader title="Wellbeing and attendance" sub="The whole school over the last two weeks. Students choose what they share; private check-ins are only counted." />
      <ErrorBox error={w.error ?? a.error} />
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7" title="Students to check in with">
          {!w.data ? <SkeletonRows rows={4} /> : !w.data.flagged.length ? <Empty>Nobody flagged right now.</Empty> : (
            <ul className="divide-y divide-[var(--border)]">
              {w.data.flagged.map((s: any) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Face mood={s.last.mood} className="size-8 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{s.name} <span className="font-normal text-[var(--text-muted)]">· {s.section}</span></span><span className="block text-xs text-[var(--text-muted)]">{s.flag === 'talk' ? `Asked to talk${s.talkTo ? ` to ${s.talkTo}` : ''}` : 'Low on recent check-ins'} · {s.last.date}</span></span>
                  <Badge tone={s.flag === 'talk' ? 'danger' : 'warning'}>{s.flag === 'talk' ? 'Talk' : 'Low'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-5" title="By grade">
          {!w.data ? <SkeletonRows rows={4} /> : (
            <ul className="grid gap-2">
              {w.data.grades.map((g: any) => (
                <li key={g.grade} className="flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-3 py-2.5 text-sm">
                  <span className="w-20 font-medium">{g.grade ? `Grade ${g.grade}` : 'Other'}</span>
                  {g.average !== null && <Face mood={g.average} className="size-6" />}
                  <span className="flex-1 text-xs text-[var(--text-muted)]">{g.checkIns} check-ins · {g.students} students</span>
                  {g.lowShare !== null && <span className={cn('text-xs tabular-nums', g.lowShare >= 25 ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]')}>{g.lowShare}% low</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="lg:col-span-12" title="Attendance this term" action={a.data && <span className="text-xs text-[var(--text-muted)]">{a.data.classes.filter((c: any) => !c.takenToday).length} registers not taken today</span>} pad={false}>
          {!a.data ? <SkeletonRows rows={6} /> : (
            <ul className="grid divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-y-0">
              {a.data.classes.map((c: any) => (
                <li key={c.id} className="flex items-center gap-3 border-[var(--border)] px-4 py-2.5 sm:border-b sm:px-6">
                  <span className="min-w-0 flex-1"><Link href={`/teacher/register?class=${c.id}`} className="block truncate text-sm font-medium hover:underline">{c.name}</Link><span className="block text-xs text-[var(--text-muted)]">{c.teacher}</span></span>
                  {!c.takenToday && <Badge>Not taken</Badge>}
                  <span className={cn('w-14 text-end text-sm tabular-nums', c.rate !== null && c.rate < 92 && 'text-[var(--danger)]')}>{c.rate === null ? '–' : `${c.rate}%`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
