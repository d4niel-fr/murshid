'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';

/** The school area's sections, as one scrollable row of pills (work, timetable, questions, attendance, points, dates, reports). */
export function SchoolTabs({ className }: { className?: string }) {
  const { tx } = useApp();
  const path = usePathname() ?? '';
  const tabs = [
    { href: '/app/school', label: tx('Work', 'الواجبات') },
    { href: '/app/timetable', label: tx('Timetable', 'الجدول') },
    { href: '/app/polls', label: tx('Questions', 'الأسئلة') },
    { href: '/app/attendance', label: tx('Attendance', 'الحضور') },
    { href: '/app/points', label: tx('Points', 'النقاط') },
    { href: '/app/events', label: tx('School dates', 'مواعيد المدرسة') },
    { href: '/app/reports', label: tx('Reports', 'التقارير') },
  ];
  return (
    <nav aria-label={tx('School sections', 'أقسام المدرسة')} className={cn('tabs-scroll -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0 no-print', className)}>
      {tabs.map((t) => {
        const on = path === t.href || (t.href === '/app/school' && path.startsWith('/app/school/'));
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
            className={cn('inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors', on ? 'bg-[var(--deep)] text-white' : 'bg-surface text-muted-foreground hover:text-foreground')}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
