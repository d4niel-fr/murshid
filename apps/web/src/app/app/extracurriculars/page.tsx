'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Activity as ActivityIcon, Clock, Flame, MessageCircle, Plus, Trash2, TrendingUp, HeartPulse } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { useApp, useEndpoint } from '@/components/providers/app-provider';
import { ChartCard } from '@/components/charts/chart-card';
import { ACTIVITY_ICON, minutesSince } from '@/components/dashboard/widgets';
import { LogSessionDialog } from '@/components/shared/log-session';
import { Bento, Page, PageHeader } from '@/components/shared/page';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Segmented } from '@/components/ui/segmented';
import type { Extracurriculars } from '@/lib/types';
import { addDays, formatDate, startOfWeek } from '@/lib/dates';
import { activitySpec, buildChartSpec } from '@/lib/progress';
import type { ChartRange } from '@/lib/types';
import { cn } from '@/lib/utils';

function View() {
  const { world, tx, locale, user, update, toast, bandConfig, band } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  // Live GET /extracurriculars when available; local logs always come from the merged mock world.
  useEndpoint<Extracurriculars>(`ec:${band}`, (c) => c.getExtracurriculars(), world.extracurriculars);
  const acts = world.extracurriculars.activities;
  const [sel, setSel] = useState(params.get('a') ?? acts[0]?.id ?? '');
  const act = acts.find((a) => a.id === sel) ?? acts[0]!;
  const [range, setRange] = useState<ChartRange>(bandConfig.chartDefaults.defaultRange === '4w' ? '12w' : bandConfig.chartDefaults.defaultRange);
  const [view, setView] = useState<'time' | 'metric'>('time');
  const [logOpen, setLogOpen] = useState(false);
  const hasMetric = act.sessions.some((s) => s.metric);

  const spec = useMemo(() => activitySpec(world, act, range, view === 'metric' && hasMetric ? 'line' : 'bar', locale), [world, act, range, view, hasMetric, locale]);
  const overview = useMemo(() => buildChartSpec(world, { area: 'extracurriculars', range: '12w', type: 'stacked-bar', locale }), [world, locale]);

  const from28 = addDays(world.today, -27);
  const weekStart = startOfWeek(world.today);
  const thisWeek = act.sessions.filter((s) => s.date >= weekStart).reduce((m, s) => m + s.minutes, 0);
  const userIds = new Set((user.sessions[act.id] ?? []).map((s) => s.id));
  const recent = [...act.sessions].reverse().slice(0, 8);

  const remove = (id: string) => {
    update((u) => ({ ...u, sessions: { ...u.sessions, [act.id]: (u.sessions[act.id] ?? []).filter((s) => s.id !== id) } }));
    toast({ title: tx('Session removed', 'تم حذف الجلسة'), tone: 'info' });
  };

  return (
    <Page wide>
      <PageHeader
        eyebrow={tx('Athletics, gym, hackathons, clubs', 'رياضة، جيم، هاكاثونات، نوادٍ')}
        title={tx('Extracurriculars', 'الأنشطة اللاصفية')}
        subtitle={tx('Log sessions as you go. Hours, personal bests and trends update instantly.', 'سجّل جلساتك أولاً بأول. تتحدث الساعات والأرقام فوراً.')}
        actions={<>
          <Button variant="outline" onClick={() => router.push('/app/health')}><HeartPulse />{tx('From my watch', 'من ساعتي')}</Button>
          <Button variant="outline" onClick={() => router.push(`/app/chat?q=${encodeURIComponent(`How's my ${act.area} progress?`)}`)}><MessageCircle />{tx('Ask about this', 'اسأل عن هذا')}</Button>
          <LogSessionDialog activityId={act.id} open={logOpen} onOpenChange={setLogOpen} trigger={<Button><Plus />{tx('Log a session', 'تسجيل جلسة')}</Button>} />
        </>}
      />
      <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {acts.map((a) => {
          const Icon = ACTIVITY_ICON[a.area] ?? ActivityIcon;
          const on = a.id === act.id;
          return (
            <motion.button key={a.id} whileTap={{ scale: 0.97 }} onClick={() => { setSel(a.id); setView('time'); }}
              className={cn('flex shrink-0 items-center gap-3 rounded-full py-2 ps-2 pe-5 text-start transition-colors', on ? 'bg-[var(--deep)] text-white' : 'bg-surface hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_6%)]')}>
              <span className={cn('inline-flex size-9 items-center justify-center rounded-full', on ? 'bg-white text-[var(--deep)]' : 'bg-surface-2')}><Icon className="size-4" /></span>
              <span>
                <span className="block text-sm font-medium">{a.name}</span>
                <span className={cn('block text-xs tabular', on ? 'text-white/65' : 'text-muted-foreground')}>{Math.round(minutesSince(a, from28) / 6) / 10}h {tx('in 4 weeks', 'في ٤ أسابيع')}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <Bento key={act.id}>
        <Card className="col-span-12 md:col-span-4">
          <CardHeader title={tx('This week', 'هذا الأسبوع')} icon={<Clock />} />
          <div className="flex items-baseline gap-1"><NumberTicker value={Math.round(thisWeek)} locale={locale} className="text-3xl font-semibold" /><span className="text-sm text-muted-foreground">/ {act.weeklyTargetMinutes} {tx('min', 'دقيقة')}</span></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2"><motion.div className="h-full origin-left rounded-full bg-[var(--chart-2)] rtl:origin-right" initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, thisWeek / act.weeklyTargetMinutes) }} transition={{ type: 'spring', stiffness: 70, damping: 20 }} /></div>
        </Card>
        <Card className="col-span-6 md:col-span-4">
          <CardHeader title={tx('Total this year', 'المجموع هذا العام')} icon={<Flame />} />
          <div className="flex items-baseline gap-1"><NumberTicker value={act.totalHours} decimals={1} locale={locale} className="text-3xl font-semibold" /><span className="text-sm text-muted-foreground">h · {act.sessions.length} {tx('sessions', 'جلسة')}</span></div>
        </Card>
        <Card className="col-span-6 md:col-span-4">
          <CardHeader title={tx('Latest result', 'آخر نتيجة')} icon={<TrendingUp />} />
          {(() => {
            const m = [...act.sessions].reverse().find((s) => s.metric)?.metric;
            return m ? <div className="flex items-baseline gap-1"><span className="text-3xl font-semibold tabular">{m.value}</span><span className="text-sm text-muted-foreground">{m.unit}{m.name.toLowerCase() !== m.unit.toLowerCase() ? ` · ${m.name}` : ''}</span></div>
              : <p className="text-sm text-muted-foreground">{tx('No measured result yet. Add one when you log a session.', 'لا توجد نتيجة بعد. أضف واحدة عند تسجيل جلسة.')}</p>;
          })()}
        </Card>

        <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="col-span-12 xl:col-span-8">
          <ChartCard
            spec={spec}
            height={300}
            range={range}
            onRange={setRange}
            actions={hasMetric ? <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'time', label: tx('Time', 'الوقت') }, { value: 'metric', label: tx('Results', 'النتائج') }]} /> : undefined}
          />
        </motion.div>

        <Card className="col-span-12 xl:col-span-4">
          <CardHeader title={tx('Recent sessions', 'الجلسات الأخيرة')} action={<Button size="sm" variant="secondary" onClick={() => setLogOpen(true)}><Plus />{tx('Log', 'تسجيل')}</Button>} />
          <ul className="-mx-2 flex flex-col">
            {recent.map((s) => (
              <li key={s.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatDate(s.date, locale)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{s.note ?? (s.metric ? `${s.metric.name}: ${s.metric.value} ${s.metric.unit}` : act.name)}</span>
                <span className="text-sm tabular font-medium">{s.minutes}m</span>
                {userIds.has(s.id) && (
                  <button onClick={() => remove(s.id)} aria-label={tx('Delete session', 'حذف الجلسة')} className="inline-flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-[var(--danger)]"><Trash2 className="size-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="col-span-12">
          <ChartCard spec={overview} height={240} footerLink={{ href: '/app/insights?area=extracurriculars', label: tx('Open in Insights', 'افتح في الرؤى') }} />
        </motion.div>
      </Bento>
    </Page>
  );
}

export default function ExtracurricularsPage() {
  return <Suspense fallback={null}><View /></Suspense>;
}
