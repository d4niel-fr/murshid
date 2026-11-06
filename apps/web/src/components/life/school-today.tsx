'use client';

import Link from 'next/link';
import { Award, CalendarDays, ChevronRight, Vote } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { Card, CardHeader } from '@/components/ui/card';
import { getTodayAtSchool, MOODS } from '@/lib/life-api';
import { dayLabel } from './gate';
import { MoodFace } from './mood-face';
import { useLoad } from './use-load';

/** Home: today's check-in, the lesson now and next, questions waiting, points this week, the next school date. Hidden without a school. */
export function SchoolToday({ className }: { className?: string }) {
  const { tx, locale } = useApp();
  const { data: d, noSchool } = useLoad(getTodayAtSchool);
  if (noSchool || !d) return null;
  const lesson = d.current ?? d.next;
  return (
    <div className={className}>
      <Card>
        <CardHeader title={tx('Today at school', 'اليوم في المدرسة')} action={<Link href="/app/timetable" className="text-xs font-medium text-primary">{tx('Timetable', 'الجدول')}</Link>} />
        {!d.checkedIn ? (
          <div className="mb-4 rounded-[18px] bg-surface p-3">
            <p className="mb-2 text-sm font-medium">{d.prompt?.question ?? tx('How are you feeling today?', 'كيف تشعر اليوم؟')}</p>
            <div className="grid grid-cols-5 gap-1">
              {MOODS.map((m) => (
                <Link key={m.mood} href={`/app/feelings?mood=${m.mood}`} aria-label={locale === 'ar' ? m.ar : m.en} className="grid h-12 place-items-center rounded-[14px] transition-colors hover:bg-[var(--bg)] active:scale-95" style={{ color: m.tone }}>
                  <MoodFace mood={m.mood} className="size-8" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <Link href="/app/feelings" className="tap-row mb-3 flex items-center gap-3 text-sm">
            <span style={{ color: MOODS[(d.mood ?? 3) - 1]!.tone }}><MoodFace mood={d.mood ?? 3} filled className="size-8" /></span>
            <span className="flex-1">{tx('You checked in today', 'سجّلت شعورك اليوم')}</span><ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
          </Link>
        )}
        <ul className="grid gap-2.5 text-sm">
          {lesson && (
            <li className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">{d.current ? tx('Now', 'الآن') : tx('Next', 'التالي')}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{lesson.subjectName}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground" dir="ltr">{lesson.start}{lesson.room ? ` · ${lesson.room}` : ''}</span>
            </li>
          )}
          {d.polls > 0 && <li><Link href="/app/polls" className="flex items-center gap-3 font-medium text-primary"><Vote className="size-4" />{d.polls === 1 ? tx('1 question from a teacher', 'سؤال من معلم') : tx(`${d.polls} questions from teachers`, `${d.polls} أسئلة من المعلمين`)}</Link></li>}
          <li><Link href="/app/points" className="flex items-center gap-3"><Award className="size-4 text-muted-foreground" />{tx(`${d.pointsWeek > 0 ? '+' : ''}${d.pointsWeek} points this week`, `${d.pointsWeek > 0 ? '+' : ''}${d.pointsWeek} نقاط هذا الأسبوع`)}</Link></li>
          {d.event && <li><Link href="/app/events" className="flex items-center gap-3"><CalendarDays className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate" dir="auto">{d.event.title}</span><span className="shrink-0 text-xs text-muted-foreground">{dayLabel(d.event.date, locale, { day: 'numeric', month: 'short' })}</span></Link></li>}
        </ul>
      </Card>
    </div>
  );
}
