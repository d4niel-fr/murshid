'use client';

import { Clock, MapPin, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SchoolSection } from '@/components/life/gate';
import { useLoad } from '@/components/life/use-load';
import { useApp } from '@/components/providers/app-provider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getTimetable, type Lesson, type Timetable } from '@/lib/life-api';
import { cn } from '@/lib/utils';

const DAYS = [['Mon', 'الاثنين'], ['Tue', 'الثلاثاء'], ['Wed', 'الأربعاء'], ['Thu', 'الخميس'], ['Fri', 'الجمعة']] as const;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** Each subject keeps one colour across the week. */
const tint = (subject: string) => `color-mix(in oklab, var(--chart-${(subject.length + subject.charCodeAt(0)) % 6 + 1}) 16%, transparent)`;
const edge = (subject: string) => `var(--chart-${(subject.length + subject.charCodeAt(0)) % 6 + 1})`;

export default function TimetablePage() {
  const { tx } = useApp();
  const load = useLoad(getTimetable);
  // refresh now/next every minute
  const [, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);
  return (
    <SchoolSection wide title={tx('Timetable', 'الجدول الدراسي')} subtitle={tx('Your week of lessons. Online lessons have a Join button.', 'أسبوعك الدراسي. للدروس عبر الإنترنت زر انضمام.')} load={load}>
      {(d) => <Week d={d} />}
    </SchoolSection>
  );
}

function Week({ d }: { d: Timetable }) {
  const { tx, locale } = useApp();
  const today = d.today >= 1 && d.today <= 5 ? d.today : 1;
  const [day, setDay] = useState(today);
  const times = [...new Set(d.lessons.map((l) => `${l.start}-${l.end}`))].sort();
  const at = (dayN: number, slot: string) => d.lessons.filter((l) => l.day === dayN && `${l.start}-${l.end}` === slot);
  const dn = (i: number) => (locale === 'ar' ? DAYS[i - 1]![1] : DAYS[i - 1]![0]);
  if (!d.lessons.length) return <Card><p className="text-sm text-muted-foreground">{tx('Your school has not added the timetable yet.', 'لم تُضف مدرستك الجدول بعد.')}</p></Card>;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <NowCard title={tx('Now', 'الآن')} lesson={d.current} empty={tx('No lesson right now', 'لا يوجد درس الآن')} live />
        <NowCard title={d.next?.nextDay ? tx(`Next: ${dn(d.next.day)}`, `التالي: ${dn(d.next.day)}`) : tx('Next', 'التالي')} lesson={d.next} empty={tx('No more lessons today', 'لا دروس أخرى اليوم')} />
      </div>
      {d.clashes.length > 0 && <p className="rounded-[18px] tint-warning px-4 py-3 text-sm">{tx(`Two classes overlap: ${d.clashes[0]!.a} and ${d.clashes[0]!.b} (${dn(d.clashes[0]!.day)} ${d.clashes[0]!.at}). Tell your school office.`, `يتداخل صفّان: ${d.clashes[0]!.a} و${d.clashes[0]!.b}. أخبر إدارة المدرسة.`)}</p>}
      {d.generated && <p className="text-xs text-muted-foreground">{tx('Demo school: an example week built from your classes.', 'مدرسة تجريبية: أسبوع مثال مبني من صفوفك.')}</p>}

      {/* phones and portrait iPad: one day at a time */}
      <div className="lg:hidden">
        <div role="tablist" aria-label={tx('Day', 'اليوم')} className="mb-3 grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} role="tab" aria-selected={day === i} onClick={() => setDay(i)} className={cn('h-11 rounded-full text-sm font-medium', day === i ? 'bg-[var(--deep)] text-white' : 'bg-surface text-muted-foreground', i === d.today && day !== i && 'ring-1 ring-[var(--brand-light)]')}>{dn(i)}</button>
          ))}
        </div>
        <ul className="grid gap-2">
          {d.lessons.filter((l) => l.day === day).map((l) => <LessonRow key={`${l.classId}-${l.day}-${l.start}`} l={l} now={day === d.today && toMin(l.start) <= d.nowMinutes && d.nowMinutes < toMin(l.end)} />)}
          {!d.lessons.some((l) => l.day === day) && <li className="text-sm text-muted-foreground">{tx('No lessons.', 'لا دروس.')}</li>}
        </ul>
      </div>

      {/* desktop and landscape iPad: the whole week */}
      <Card className="hidden overflow-x-auto p-0 lg:block xl:p-0">
        <table className="w-full min-w-[720px] table-fixed border-separate border-spacing-1.5 p-3 text-sm">
          <thead><tr><th className="w-24" />{[1, 2, 3, 4, 5].map((i) => <th key={i} className={cn('pb-1 text-start text-xs font-medium', i === d.today ? 'text-foreground' : 'text-muted-foreground')}>{dn(i)}{i === d.today && <span className="ms-1.5 inline-block size-1.5 rounded-full bg-[var(--brand)] align-middle" />}</th>)}</tr></thead>
          <tbody>
            {times.map((slot) => (
              <tr key={slot}>
                <td className="align-top text-xs tabular-nums text-muted-foreground" dir="ltr">{slot.replace('-', '–')}</td>
                {[1, 2, 3, 4, 5].map((i) => (
                  <td key={i} className="align-top">
                    {at(i, slot).map((l) => {
                      const now = i === d.today && toMin(l.start) <= d.nowMinutes && d.nowMinutes < toMin(l.end);
                      return (
                        <div key={l.classId} className={cn('rounded-[14px] border-s-[3px] px-2.5 py-2', now && 'ring-2 ring-[var(--brand)]')} style={{ background: tint(l.subject), borderColor: edge(l.subject) }}>
                          <p className="truncate font-medium">{l.subjectName}</p>
                          <p className="truncate text-xs text-muted-foreground">{l.room || l.teacher}</p>
                          {l.link && <a href={l.link} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><Video className="size-3" />{tx('Join', 'انضم')}</a>}
                        </div>
                      );
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function NowCard({ title, lesson, empty, live }: { title: string; lesson: Lesson | null; empty: string; live?: boolean }) {
  const { tx } = useApp();
  return (
    <Card className={cn(live && lesson && 'bg-[var(--deep)] text-white')}>
      <p className={cn('eyebrow mb-3', live && lesson && 'text-white/70')}>{title}</p>
      {!lesson ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-medium">{lesson.subjectName}</p>
            <p className={cn('mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm', live ? 'text-white/75' : 'text-muted-foreground')}>
              <span className="inline-flex items-center gap-1" dir="ltr"><Clock className="size-3.5" />{lesson.start}–{lesson.end}</span>
              {lesson.room && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{lesson.room}</span>}
              <bdi>{lesson.teacher}</bdi>
            </p>
          </div>
          {lesson.link && <a href={lesson.link} target="_blank" rel="noopener noreferrer" className={cn('inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium', live ? 'bg-white text-[var(--deep)]' : 'bg-foreground text-background')}><Video className="size-4" />{tx('Join lesson', 'انضم للدرس')}</a>}
        </div>
      )}
    </Card>
  );
}

function LessonRow({ l, now }: { l: Lesson; now: boolean }) {
  const { tx } = useApp();
  return (
    <li className={cn('flex items-center gap-3 rounded-[18px] border-s-[3px] px-4 py-3', now && 'ring-2 ring-[var(--brand)]')} style={{ background: tint(l.subject), borderColor: edge(l.subject) }}>
      <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground" dir="ltr">{l.start}<br />{l.end}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{l.subjectName}{now && <Badge tone="navy" className="ms-2">{tx('Now', 'الآن')}</Badge>}</span><span className="block truncate text-xs text-muted-foreground">{[l.room, l.teacher].filter(Boolean).join(' · ')}</span></span>
      {l.link && <a href={l.link} target="_blank" rel="noopener noreferrer" aria-label={tx(`Join ${l.subjectName}`, `انضم إلى ${l.subjectName}`)} className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--bg)] text-primary"><Video className="size-4" /></a>}
    </li>
  );
}
