'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useApp, useEndpoint } from '@/components/providers/app-provider';
import { Bento, Page, RevealTitle } from '@/components/shared/page';
import { SchoolToday } from '@/components/life/school-today';
import { Arrow, Button } from '@/components/ui/button';
import { visibleWidgets, greetingKey, type WidgetId } from '@/lib/bands';
import { diffDays, dubaiHour, formatDate, relativeDay, weekdayIndex } from '@/lib/dates';
import { applyTaskState } from '@/lib/merge';
import type { Dashboard } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  AcademicsWidget, ApplicationsWidget, AskWidget, BadgesWidget, BriefingWidget, ExtracurricularsWidget, GoalsWidget,
  OpportunitiesWidget, ProfileLinksWidget, RingsWidget, StreakWidget, TodayWidget, UpcomingWidget,
} from './widgets';

/** Column placement: 'main' widgets fill the wide column, 'side' widgets the narrow one (desktop ≥1280). */
const PLACE: Record<WidgetId, 'main' | 'side' | 'full' | 'none'> = {
  greeting: 'none', today: 'main', 'progress-rings': 'side', upcoming: 'side', streaks: 'side', goals: 'side',
  academics: 'main', extracurriculars: 'main', opportunities: 'side', applications: 'side', cv: 'side', 'social-links': 'side',
  'ai-chat-entry': 'main', badges: 'side', 'weekly-briefing': 'main',
};

const PERSONA_WIDGETS = new Set<WidgetId>(['today', 'ai-chat-entry', 'upcoming', 'progress-rings', 'streaks']);

export function DashboardView() {
  const { world, locale, bt, band, user, prefs } = useApp();
  // Live API when available (auto mode), bundled mock otherwise; local ticks/added tasks always layered on top.
  const { data: raw } = useEndpoint<Dashboard>(`dashboard:${band}`, (c) => c.getDashboard(), world.dashboard);
  const data: Dashboard = raw === world.dashboard ? raw : { ...raw, today: applyTaskState(raw.today, user) };
  // A persona (e.g. the flagship student) lives in the API: show only the widgets fed by GET /dashboard,
  // not band widgets that would fall back to another student's bundled data.
  const widgets = prefs.persona ? visibleWidgets(band).filter((w) => PERSONA_WIDGETS.has(w)) : visibleWidgets(band);
  const s = data.student;
  const name = locale === 'ar' ? s.nameAr.split(' ')[0] : s.firstName;
  const hello = bt(greetingKey(dubaiHour()), { name });
  const subtitle = bt('dashboard.subtitle');

  const render = (w: WidgetId): ReactNode => {
    switch (w) {
      case 'today': return <TodayWidget key={w} data={data} />;
      case 'streaks': return <StreakWidget key={w} data={data} />;
      case 'progress-rings': return <RingsWidget key={w} data={data} />;
      case 'upcoming': return <UpcomingWidget key={w} data={data} />;
      case 'academics': return <AcademicsWidget key={w} />;
      case 'extracurriculars': return <ExtracurricularsWidget key={w} />;
      case 'ai-chat-entry': return <AskWidget key={w} />;
      case 'cv': return <ProfileLinksWidget key={w} cv />;
      case 'social-links': return widgets.includes('cv') ? null : <ProfileLinksWidget key={w} />;
      case 'opportunities': return <OpportunitiesWidget key={w} />;
      case 'applications': return <ApplicationsWidget key={w} />;
      case 'goals': return <GoalsWidget key={w} />;
      case 'badges': return <BadgesWidget key={w} />;
      case 'weekly-briefing': return <BriefingWidget key={w} />;
      default: return null;
    }
  };

  // Ask Murshid always sits right under Today so the AI entry is above the fold.
  const ordered = [...widgets].sort((a, b) => (a === 'ai-chat-entry' ? (b === 'today' ? 1 : -1) : b === 'ai-chat-entry' ? (a === 'today' ? -1 : 1) : 0));
  const main = ordered.filter((w) => PLACE[w] === 'main');
  const side = ordered.filter((w) => PLACE[w] === 'side');

  return (
    <Page wide>
      <DashHero data={data} hello={hello.includes(name) ? hello : `${hello}, ${name}`} subtitle={subtitle !== 'dashboard.subtitle' ? subtitle : data.highlights[0] ?? ''} />
      {/* Desktop: two columns (8 + 4). iPad: one stacked column of full-width cards, side widgets pair up 6+6. */}
      <Bento className="items-start">
        <div className="col-span-12 grid min-w-0 grid-cols-12 gap-4 lg:col-span-7 xl:col-span-8">
          {main.map((w, i) => (
            <Fragment key={w}>
              <Slot w={w}>{render(w)}</Slot>
              {/* phones and iPad portrait: school today sits near the top, not after every other card */}
              {i === 0 && <SchoolToday className="col-span-12 grid min-w-0 lg:hidden" />}
            </Fragment>
          ))}
        </div>
        <div className="col-span-12 grid min-w-0 grid-cols-12 gap-4 lg:col-span-5 xl:col-span-4">
          <SchoolToday className="col-span-12 hidden min-w-0 lg:grid" />
          {side.map((w) => <Slot key={w} w={w} side>{render(w)}</Slot>)}
        </div>
      </Bento>
    </Page>
  );
}

function Slot({ children, side }: { w: WidgetId; side?: boolean; children: ReactNode }) {
  if (!children) return null;
  return <div className={cn('col-span-12 grid min-w-0', side && 'md:col-span-6 lg:col-span-12')}>{children}</div>;
}

/**
 * The navy hero card that opens Home: today's date, the greeting, and three glass readouts.
 * Behind it, the school week as faint columns, with today's column lit.
 */
function DashHero({ data, hello, subtitle }: { data: Dashboard; hello: string; subtitle: string }) {
  const { world, locale, tx } = useApp();
  const done = data.today.filter((x) => x.done).length;
  const total = data.today.length;
  const next = data.upcoming.find((u) => u.date >= world.today);
  const week = data.upcoming.filter((u) => u.date >= world.today && diffDays(u.date, world.today) <= 7);
  const tests = week.filter((u) => u.type === 'test' || u.type === 'exam').length;
  const today = weekdayIndex(world.today);
  const days = locale === 'ar' ? ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <section className="on-deep relative isolate mb-4 overflow-hidden rounded-[var(--radius-band)] px-6 pb-6 pt-6 sm:px-9 sm:pb-9 sm:pt-7">
      <div className="relative">
        {/* the week, drawn as columns behind the greeting */}
        <div aria-hidden className="pointer-events-none absolute -bottom-2 -top-7 end-[-2.25rem] -z-10 hidden w-[58%] grid-cols-7 sm:grid">
          {days.map((d, i) => (
            <div key={d} className={cn('relative border-s border-white/[0.08] px-3 pt-20 text-[0.625rem] font-medium uppercase tracking-[0.2em] text-white/25 rtl:tracking-normal', i === today && 'bg-white/[0.04] text-white/75')}>
              {i === today && <span className="absolute start-3 top-[3.9rem] size-1.5 rounded-full bg-[var(--spark)]" />}
              {d}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">{formatDate(world.today, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <div className="flex items-center gap-2">
            <Button asChild variant="glass" size="sm"><Link href="/app/planner"><CalendarDays />{tx('Planner', 'المخطط')}</Link></Button>
            <Button asChild variant="light" size="sm"><Link href="/app/chat">{tx('Ask Murshid', 'اسأل مرشد')}<Arrow /></Link></Button>
          </div>
        </div>
        <h1 className="display mt-12 max-w-[14ch] text-[2.5rem] leading-[0.98] sm:mt-16 sm:text-[3.75rem]"><RevealTitle text={hello} /></h1>
        <p className="mt-4 max-w-[48ch] pb-2 text-[0.9375rem] leading-relaxed text-white/70">{subtitle}</p>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-[52rem]">
        <Glass label={tx('Today', 'اليوم')}>
          <p className="figure text-[1.75rem]">{done}<span className="text-white/60">/{total}</span></p>
          <p className="mt-1 text-xs text-white/60">{tx('tasks done', 'مهام منجزة')}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[var(--spark)]" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
        </Glass>
        <Glass label={tx('Next up', 'التالي')}>
          <p className="truncate text-[0.9375rem] font-medium">{next?.title ?? tx('Nothing due', 'لا شيء مستحق')}</p>
          <p className="mt-1 text-xs text-white/60">{next ? `${formatDate(next.date, locale, { weekday: 'short', day: 'numeric', month: 'short' })} · ${relativeDay(next.date, world.today, locale)}` : ''}</p>
        </Glass>
        <Glass label={tx('Next 7 days', 'الأيام السبعة القادمة')}>
          <p className="figure text-[1.75rem]">{tests}<span className="ms-1.5 text-sm font-normal tracking-normal text-white/60">{tx(tests === 1 ? 'test' : 'tests', 'اختبارات')}</span></p>
          <p className="mt-1 text-xs text-white/60">{tx(`${week.length} things on the calendar`, `${week.length} مواعيد في التقويم`)}</p>
        </Glass>
      </div>
    </section>
  );
}

function Glass({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="glass min-w-0 p-4">
      <p className="mb-2.5 text-[0.625rem] font-medium uppercase tracking-[0.2em] text-white/55 rtl:tracking-normal">{label}</p>
      {children}
    </div>
  );
}
