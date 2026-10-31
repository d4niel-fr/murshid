'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Activity as ActivityIcon, ArrowRight, ArrowUp, Award, BookOpen, CalendarClock, Code, Dumbbell, FileText, Flame, Footprints,
  Globe, Medal, Mic, Music, Plus, Send, Sparkles, Target, TrendingDown, TrendingUp, Trophy, Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { ChartView } from '@/components/charts/chart-view';
import { GitHubIcon, InstagramIcon, LinkedInIcon } from '@/components/shell/icons';
import { LogSessionDialog } from '@/components/shared/log-session';
import { OpportunityCard } from '@/components/shared/opportunity-card';
import { Sparkline } from '@/components/shared/sparkline';
import { TaskList } from '@/components/shared/task-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProgressRing } from '@/components/ui/progress-ring';
import { areaColor } from '@murshid/design';
import { demoStudents } from '@/lib/bands';
import { diffDays, formatDate, relativeDay, weekdayIndex } from '@/lib/dates';
import { pressable } from '@/lib/motion';
import { buildChartSpec, fmtScore } from '@/lib/progress';
import type { Activity, Dashboard, LinkKey, UpcomingItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const seeAll = (href: string, label: string) => (
  <Link href={href} className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 ps-3.5 pe-3 text-xs font-medium text-foreground transition-colors hover:bg-[var(--deep)] hover:text-white">
    {label}<ArrowRight className="nudge size-3.5" />
  </Link>
);

export const ACTIVITY_ICON: Record<string, typeof Dumbbell> = {
  gym: Dumbbell, athletics: Footprints, swimming: Footprints, football: Trophy, hackathon: Code, coding: Code, piano: Music, debate: Users, art: Sparkles, club: Users,
};

// ───────────────────────── Today ─────────────────────────
export function TodayWidget({ data }: { data: Dashboard }) {
  const { t, tx } = useApp();
  const done = data.today.filter((x) => x.done).length;
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.today')} action={<span className="text-xs tabular text-muted-foreground">{done}/{data.today.length} {tx('done', 'منجزة')}</span>} />
      <TaskList tasks={data.today} max={6} />
    </Card>
  );
}

// ───────────────────────── Streak ─────────────────────────
export function StreakWidget({ data }: { data: Dashboard }) {
  const { t, tx, world, locale } = useApp();
  const today = weekdayIndex(world.today);
  const days = locale === 'ar' ? ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const streak = data.streaks.current;
  return (
    <Card className="col-span-12">
      <CardHeader title={tx('Streak', 'السلسلة')} icon={<Flame />} action={<Badge tone="brand">{t('dash.best')} {data.streaks.best}</Badge>} />
      <div className="flex items-end gap-2">
        <NumberTicker value={streak} locale={locale} className="text-4xl font-semibold leading-none" />
        <span className="pb-1 text-sm text-muted-foreground">{t('dash.streak')}</span>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const filled = i <= today && today - i < streak;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15 + i * 0.04, type: 'spring', stiffness: 520, damping: 30 }}
                className={cn('size-7 rounded-full', filled ? 'bg-[var(--deep)]' : i === today ? 'border-2 border-primary' : 'bg-surface-2')}
              />
              <span className={cn('text-[0.6875rem]', i === today ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{d}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ───────────────────────── Progress rings ─────────────────────────
export function RingsWidget({ data }: { data: Dashboard }) {
  const { t, band, locale } = useApp();
  const router = useRouter();
  const size = band === 'g5-6' ? 96 : band === 'g11-12' ? 80 : 88;
  const rings: { key: keyof Dashboard['progress']; label: string; href: string }[] = [
    { key: 'academics', label: t('dash.academics'), href: '/app/insights?area=academics' },
    { key: 'extracurriculars', label: t('dash.extracurriculars'), href: '/app/insights?area=extracurriculars' },
    { key: 'goals', label: t('dash.goals'), href: '/app/goals' },
  ];
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.progress')} action={seeAll('/app/insights', t('dash.viewAll'))} />
      <div className="grid grid-cols-3 gap-2">
        {rings.map((r) => (
          <motion.button key={r.key} {...pressable} onClick={() => router.push(r.href)} className="rounded-lg py-1 hover:bg-surface-2" aria-label={`${r.label} ${data.progress[r.key]}%`}>
            <ProgressRing value={data.progress[r.key]} size={size} stroke={band === 'g5-6' ? 8 : 6} color={areaColor[r.key]} label={r.label} locale={locale} />
          </motion.button>
        ))}
      </div>
    </Card>
  );
}

// ───────────────────────── Upcoming ─────────────────────────
const TYPE_ICON: Record<UpcomingItem['type'], typeof BookOpen> = { test: BookOpen, exam: BookOpen, homework: FileText, event: CalendarClock, competition: Medal, deadline: Target, session: ActivityIcon };

export function UpcomingWidget({ data }: { data: Dashboard }) {
  const { t, locale, world, bt } = useApp();
  const items = data.upcoming.filter((u) => u.date >= world.today).slice(0, 5);
  return (
    <Card className="col-span-12">
      <CardHeader title={bt('upcoming.title') !== 'upcoming.title' ? bt('upcoming.title') : t('dash.upcoming')} action={seeAll('/app/planner', t('dash.viewAll'))} />
      <ol className="relative">
        {items.map((u, i) => {
          const d = diffDays(u.date, world.today);
          const Icon = TYPE_ICON[u.type] ?? CalendarClock;
          return (
            <li key={u.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < items.length - 1 && <span className="absolute start-[15px] top-8 bottom-0 w-0.5 bg-border" aria-hidden />}
              <span className={cn('relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-surface-2', d <= 2 && 'tint-warning border-[color-mix(in_oklab,var(--warning)_40%,transparent)]')}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-medium">{u.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(u.date, locale, { weekday: 'short', day: 'numeric', month: 'short' })} · <span className={d <= 2 ? 'font-medium text-[var(--warning)]' : ''}>{relativeDay(u.date, world.today, locale)}</span></p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ───────────────────────── Academics ─────────────────────────
export function AcademicsWidget() {
  const { t, world, tx } = useApp();
  const subs = world.academics.subjects.slice(0, 5);
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.academicsCard')} icon={<BookOpen />} action={seeAll('/app/academics', t('dash.viewAll'))} />
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular">{fmtScore(world.academics.average, world.academics.scale)}</span>
        <span className="text-sm text-muted-foreground">{t('dash.avg')} · {tx(world.academics.term, 'الفصل الأول')}</span>
      </div>
      <ul className="divide-y divide-border">
        {subs.map((s) => {
          const delta = Math.round((s.current - s.trend[0]!) * 10) / 10;
          return (
            <li key={s.id}>
              <Link href={`/app/academics?subject=${s.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                <Sparkline values={s.trend} color={delta >= 0 ? 'var(--chart-1)' : 'var(--danger)'} />
                <span className={cn('inline-flex w-12 items-center justify-end gap-0.5 text-xs tabular', delta >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
                  {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{delta > 0 ? '+' : ''}{delta}
                </span>
                <span className="w-12 text-end text-sm font-semibold tabular">{fmtScore(s.current, s.scale)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ───────────────────────── Extracurriculars ─────────────────────────
export function minutesSince(a: Activity, from: string) {
  return a.sessions.filter((s) => s.date >= from).reduce((m, s) => m + s.minutes, 0);
}

export function ExtracurricularsWidget() {
  const { t, world, tx } = useApp();
  const from = new Date(Date.parse(world.today) - 27 * 86400000).toISOString().slice(0, 10);
  const acts = world.extracurriculars.activities;
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.ec')} icon={<ActivityIcon />} action={
        <div className="flex items-center gap-1">
          <LogSessionDialog trigger={<Button size="sm" variant="secondary"><Plus />{tx('Log', 'تسجيل')}</Button>} />
          {seeAll('/app/extracurriculars', t('dash.viewAll'))}
        </div>
      } />
      <ul className="grid gap-3 sm:grid-cols-2">
        {acts.map((a) => {
          const Icon = ACTIVITY_ICON[a.area] ?? ActivityIcon;
          const mins = minutesSince(a, from);
          const pct = Math.round((mins / (a.weeklyTargetMinutes * 4)) * 100);
          return (
            <li key={a.id}>
              <Link href={`/app/extracurriculars?a=${a.id}`} className="flex flex-col gap-2.5 rounded-[var(--radius)] bg-surface-2 p-3.5 transition-colors hover:bg-[color-mix(in_oklab,var(--surface-2)_70%,var(--border))]">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--deep)] text-white"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold tabular">{Math.round(mins / 6) / 10}<span className="ms-0.5 text-xs font-normal text-muted-foreground">h</span></span>
                  <span className="text-xs text-muted-foreground">{tx('4 wks', '٤ أسابيع')} · {Math.min(pct, 999)}%</span>
                </div>
                <ProgressBar value={pct} color="var(--chart-2)" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ───────────────────────── Ask Murshid ─────────────────────────
export function suggestionChips(world: ReturnType<typeof useApp>['world'], tx: (en: string, ar: string) => string, persona?: string | null): string[] {
  // persona data lives in the API, not the bundled band world: offer the orchestrator's headline asks
  if (persona) return [
    tx('Plan my week around my exams and sports', 'خطط أسبوعي حول امتحاناتي ورياضتي'),
    tx('Find opportunities that fit me', 'ابحث عن فرص تناسبني'),
    tx('Generate my LinkedIn CV', 'أنشئ سيرتي الذاتية على لينكدإن'),
    tx('What should I do today?', 'ما هي مهامي اليوم؟'),
  ];
  const acts = world.extracurriculars.activities;
  const has = (area: string) => acts.some((a) => a.area === area);
  const subs = world.academics.subjects;
  const out: string[] = [];
  const first = acts.find((a) => a.area === 'gym') ?? acts[0];
  if (first) out.push(first.area === 'gym' ? tx("How's my gym progress?", 'كيف تقدمي في الجيم؟') : tx(`How's my ${first.area} going?`, `كيف تقدمي في ${first.name}؟`));
  if (has('hackathon')) out.push(tx('Show my hackathon progress', 'اعرض تقدمي في الهاكاثون'));
  else if (has('athletics')) out.push(tx('Show my running progress this term', 'اعرض تقدمي في الجري هذا الفصل'));
  const maths = subs.find((s) => /math/i.test(s.name));
  const phys = subs.find((s) => /physics/i.test(s.name)) ?? subs.find((s) => /science/i.test(s.name) && s !== maths);
  if (maths && phys) out.push(/physics/i.test(phys.name) ? tx('Compare my maths and physics', 'قارن الرياضيات والفيزياء') : tx('Compare my maths and science', 'قارن الرياضيات والعلوم'));
  out.push(tx('What should I do today?', 'ما هي مهامي اليوم؟'));
  out.push(tx('Where does my time go?', 'أين يذهب وقتي؟'));
  return out.slice(0, 4);
}

export function AskWidget() {
  const { t, tx, world, bt, prefs } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const chips = useMemo(() => suggestionChips(world, tx, prefs.persona), [world, tx, prefs.persona]);
  const go = (text: string) => router.push(`/app/chat?q=${encodeURIComponent(text)}`);
  const ph = bt('chat.placeholder');
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.ask')} icon={<Sparkles />} />
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q.trim()); else router.push('/app/chat'); }}>
        <motion.div layoutId="composer" className="flex items-center gap-2 rounded-full bg-surface-2 py-1.5 ps-5 pe-1.5 ring-1 ring-transparent transition-shadow focus-within:ring-[var(--brand-light)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-light)_18%,transparent)]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ph !== 'chat.placeholder' ? ph : t('dash.askPh')} className="h-9 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-muted-foreground" aria-label={t('dash.ask')} />
          <button type="submit" aria-label={q ? t('chat.send') : t('chat.mic')} className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--deep)] text-white transition-transform active:scale-95">
            {q ? <ArrowUp className="size-4" /> : <Mic className="size-4" />}
          </button>
        </motion.div>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <motion.button key={c} {...pressable} onClick={() => go(c)} className="rounded-full bg-surface-2 px-4 py-2 text-[0.8125rem] text-foreground transition-colors hover:bg-[var(--deep)] hover:text-white">{c}</motion.button>
        ))}
      </div>
    </Card>
  );
}

// ───────────────────────── CV / social ─────────────────────────
export function ProfileLinksWidget({ cv }: { cv?: boolean }) {
  const { t, tx, world } = useApp();
  const router = useRouter();
  const L = world.links;
  const items: { key: LinkKey | 'resume'; label: string; on: boolean; Icon: (p: { className?: string }) => React.ReactNode }[] = [
    { key: 'resume', label: tx('Resume', 'السيرة'), on: !!L.resumeUrl, Icon: FileText },
    { key: 'linkedin', label: 'LinkedIn', on: !!L.linkedin, Icon: LinkedInIcon },
    { key: 'github', label: 'GitHub', on: !!L.github, Icon: GitHubIcon },
    { key: 'instagram', label: 'Instagram', on: !!L.instagram, Icon: InstagramIcon },
    { key: 'portfolio', label: tx('Portfolio', 'الأعمال'), on: !!L.portfolio, Icon: Globe },
  ];
  const n = items.filter((i) => i.on).length;
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.links')} icon={<FileText />} action={seeAll('/app/profile', t('dash.viewAll'))} />
      <p className="text-sm"><span className="font-semibold tabular">{n} {tx('of', 'من')} {items.length}</span> <span className="text-muted-foreground">{tx('connected', 'مرتبطة')}</span></p>
      <ProgressBar value={(n / items.length) * 100} className="mt-2" />
      <div className="mt-4 flex flex-wrap gap-2">
        {items.map(({ key, label, on, Icon }) => (
          <button key={key} onClick={() => router.push(`/app/profile#${key}`)} className={cn('inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors', on ? 'border-border bg-surface text-foreground' : 'border-dashed border-border text-muted-foreground hover:text-foreground')}>
            <Icon className="size-4" />{label}{on && <span className="size-1.5 rounded-full bg-[var(--success)]" />}
          </button>
        ))}
      </div>
      <Button className="mt-4 self-start" onClick={() => router.push('/app/profile')}>{cv ? tx('Review CV & links', 'مراجعة السيرة والروابط') : tx('Finish profile', 'أكمل ملفك')}</Button>
    </Card>
  );
}

// ───────────────────────── Opportunities ─────────────────────────
export function OpportunitiesWidget() {
  const { t, world } = useApp();
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.opps')} icon={<Sparkles />} action={seeAll('/app/opportunities', t('dash.viewAll'))} />
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {world.opportunities.slice(0, 2).map((o) => <OpportunityCard key={o.id} o={o} compact />)}
      </div>
    </Card>
  );
}

// ───────────────────────── Applications ─────────────────────────
export function ApplicationsWidget() {
  const { t, world, tx, locale } = useApp();
  const STATUS = { saved: tx('Saved', 'محفوظ'), 'in-progress': tx('In progress', 'قيد التنفيذ'), submitted: tx('Submitted', 'مُرسل'), accepted: tx('Accepted', 'مقبول') };
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.apps')} icon={<Send />} action={seeAll('/app/opportunities?tab=applications', t('dash.viewAll'))} />
      <ul className="flex flex-col gap-3">
        {world.applications.slice(0, 3).map((a) => {
          const pct = Math.round((a.checklist.filter((c) => c.done).length / Math.max(1, a.checklist.length)) * 100);
          return (
            <li key={a.id}>
              <Link href="/app/opportunities?tab=applications" className="-mx-2 block rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{a.title}</span>
                  <Badge tone={a.status === 'submitted' || a.status === 'accepted' ? 'success' : a.status === 'in-progress' ? 'brand' : 'neutral'}>{STATUS[a.status]}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={pct} />
                  <span className="shrink-0 text-xs tabular text-muted-foreground">{formatDate(a.deadline, locale)}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// ───────────────────────── Goals ─────────────────────────
export function GoalsWidget() {
  const { t, world, bt } = useApp();
  const title = bt('goals.title');
  return (
    <Card className="col-span-12">
      <CardHeader title={title !== 'goals.title' ? title : t('dash.goalsCard')} icon={<Target />} action={seeAll('/app/goals', t('dash.viewAll'))} />
      <ul className="flex flex-col gap-3.5">
        {world.goals.slice(0, 3).map((g) => (
          <li key={g.id}>
            <Link href={`/app/goals#${g.id}`} className="-mx-2 block rounded-lg px-2 py-1 hover:bg-surface-2">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{g.title}</span>
                <span className="tabular font-semibold">{Math.round(g.progress * 100)}%</span>
              </div>
              <ProgressBar value={g.progress * 100} color="var(--chart-3)" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ───────────────────────── Badges ─────────────────────────
export function BadgesWidget() {
  const { t, band, tx } = useApp();
  const router = useRouter();
  const badges = demoStudents[band].badges;
  const pretty = (b: string) => b.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <Card className="col-span-12">
      <CardHeader title={t('dash.badges')} icon={<Award />} action={seeAll('/app/goals#badges', t('dash.viewAll'))} />
      {badges.length ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((b, i) => (
            <motion.button key={b} onClick={() => router.push('/app/goals#badges')} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.05, type: 'spring', stiffness: 400, damping: 22 }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-primary">
              <Award className="size-4" />{pretty(b)}
            </motion.button>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">{tx('Badges unlock as you hit milestones.', 'تُفتح الشارات عند تحقيق الإنجازات.')}</p>}
    </Card>
  );
}

// ───────────────────────── Weekly briefing ─────────────────────────
export function BriefingWidget() {
  const { world, locale, tx, dir } = useApp();
  const spec = useMemo(() => buildChartSpec(world, { area: 'extracurriculars', range: '4w', type: 'stacked-bar', locale }), [world, locale]);
  const top = world.dashboard.highlights[0];
  return (
    <Card className="col-span-12">
      <CardHeader title={tx('Weekly briefing', 'الملخص الأسبوعي')} icon={<CalendarClock />} action={seeAll('/app/insights?area=extracurriculars', tx('Open', 'فتح'))} />
      <p className="text-base font-semibold leading-snug">{top ?? spec.insight}</p>
      <p className="mt-1 text-xs text-muted-foreground">{spec.insight}</p>
      <div className="mt-3"><ChartView spec={spec} height={150} compact rtl={dir === 'rtl'} /></div>
    </Card>
  );
}
