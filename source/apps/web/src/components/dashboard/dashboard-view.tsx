'use client';

import { Flame } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp, useEndpoint } from '@/components/providers/app-provider';
import { Bento, Page } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { visibleWidgets, greetingKey, type WidgetId } from '@/lib/bands';
import { dubaiHour, formatDate } from '@/lib/dates';
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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 xl:mb-7">
        <div>
          <p className="eyebrow mb-1.5">{formatDate(world.today, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">{hello.includes(name) ? hello : `${hello}, ${name}`}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle !== 'dashboard.subtitle' ? subtitle : data.highlights[0]}</p>
        </div>
        {!widgets.includes('streaks') && (
          <Badge tone="brand" className="h-8 px-3 text-sm"><Flame className="size-4" />{data.streaks.current}</Badge>
        )}
      </header>
      {/* Desktop: two columns (8 + 4). iPad: one stacked column of full-width cards, side widgets pair up 6+6. */}
      <Bento className="items-start">
        <div className="col-span-12 grid min-w-0 grid-cols-12 gap-3.5 lg:col-span-7 xl:col-span-8 xl:gap-4">
          {main.map((w) => <Slot key={w} w={w}>{render(w)}</Slot>)}
        </div>
        <div className="col-span-12 grid min-w-0 grid-cols-12 gap-3.5 lg:col-span-5 xl:col-span-4 xl:gap-4">
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
