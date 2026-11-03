'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { CalendarClock, GitCompareArrows, MessageCircle, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { Suspense, useMemo, useState } from 'react';
import { useApp, useEndpoint } from '@/components/providers/app-provider';
import { ChartCard } from '@/components/charts/chart-card';
import { Bento, Page, PageHeader } from '@/components/shared/page';
import { Sparkline } from '@/components/shared/sparkline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { formatDate, relativeDay } from '@/lib/dates';
import { buildChartSpec, fmtScore } from '@/lib/progress';
import type { Academics, ChartRange } from '@/lib/types';
import { cn } from '@/lib/utils';

function View() {
  const { world, tx, locale, bandConfig, band } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { data: academics } = useEndpoint<Academics>(`academics:${band}`, (c) => c.getAcademics(), world.academics);
  const subs = academics.subjects;
  const [sel, setSel] = useState<string[]>(() => {
    const s = params.get('subject');
    return s ? [s] : [];
  });
  const [range, setRange] = useState<ChartRange>(bandConfig.chartDefaults.defaultRange);
  const keep = Math.max(0, Math.min(3, bandConfig.chartDefaults.maxSeries) - 1);
  const toggle = (id: string) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...(keep ? cur.slice(Math.max(0, cur.length - keep)) : []), id]));
  // chart and cards must describe the same subjects: chart from the academics the cards show (live API when connected)
  const chartWorld = useMemo(() => ({ ...world, academics }), [world, academics]);
  const spec = useMemo(() => {
    if (sel.length >= 2) return buildChartSpec(chartWorld, { area: 'academics', compare: sel, range, locale });
    if (sel.length === 1) return buildChartSpec(chartWorld, { area: sel[0]!, range, locale });
    return buildChartSpec(chartWorld, { area: 'academics', range, locale });
  }, [chartWorld, sel, range, locale]);
  const onTrack = subs.filter((s) => s.current >= s.target).length;

  return (
    <Page wide>
      <PageHeader
        eyebrow={tx(academics.term, 'الفصل الأول')}
        title={tx('Academics', 'الدراسة')}
        subtitle={tx(`Average ${fmtScore(academics.average, academics.scale)} · ${onTrack} of ${subs.length} subjects at or above target. Select subjects to chart or compare them.`, `المعدل ${fmtScore(academics.average, academics.scale)} · ${onTrack} من ${subs.length} مواد عند الهدف أو أعلى. اختر مواد لرسمها أو مقارنتها.`)}
        actions={<>
          {sel.length === 2 && <Button variant="outline" onClick={() => router.push(`/app/insights?area=compare&compare=${sel.join(',')}&range=${range}`)}><GitCompareArrows />{tx('Open comparison', 'افتح المقارنة')}</Button>}
          <Button onClick={() => router.push(`/app/chat?q=${encodeURIComponent(sel.length ? `How am I doing in ${subs.filter((s) => sel.includes(s.id)).map((s) => s.name).join(' and ')}?` : 'How are my grades this term?')}`)}><MessageCircle />{tx('Ask Murshid', 'اسأل مرشد')}</Button>
        </>}
      />
      <Bento>
        <motion.div variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }} className="col-span-12">
          <ChartCard spec={spec} height={300} range={range} onRange={setRange} allowedRanges={bandConfig.chartDefaults.allowedRanges}
            actions={sel.length ? <Button size="sm" variant="ghost" onClick={() => setSel([])}>{tx('All subjects', 'كل المواد')}</Button> : undefined} />
        </motion.div>
        {subs.map((s) => {
          // the sparkline ends at the current score, so its direction always matches the change badge
          const line = s.trend.length && s.trend[s.trend.length - 1] !== s.current ? [...s.trend, s.current] : s.trend;
          const delta = Math.round((s.current - (line[0] ?? s.current)) * 10) / 10;
          const on = sel.includes(s.id);
          const pct = s.scale === 'ib7' ? (s.current / 7) * 100 : s.current;
          return (
            <Card key={s.id} interactive className={cn('col-span-12 cursor-pointer select-none md:col-span-6 xl:col-span-4', on && 'border-transparent ring-[1.5px] ring-[var(--accent)]')} onClick={() => toggle(s.id)} onDoubleClick={() => router.push(`/app/insights?area=${encodeURIComponent(s.id)}`)} title={tx('Click to compare · double-click for its chart', 'انقر للمقارنة · انقر مرتين للرسم البياني')} role="button" aria-pressed={on}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{tx('Target', 'الهدف')} {fmtScore(s.target, s.scale)}</p>
                </div>
                {(() => {
                  const near = s.target - s.current <= (s.scale === 'ib7' ? 1 : 3);
                  return (
                    <Badge tone={s.current >= s.target ? 'success' : near ? 'warning' : 'danger'}>
                      {s.current >= s.target ? tx('On target', 'عند الهدف') : near ? tx('Close to target', 'قريب من الهدف') : tx('Below target', 'دون الهدف')}
                    </Badge>
                  );
                })()}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <span className="text-3xl font-semibold tabular">{fmtScore(s.current, s.scale)}</span>
                  <span title={tx('Change since the start of the term', 'التغير منذ بداية الفصل')} className={cn('ms-2 inline-flex items-center gap-0.5 text-xs tabular', delta >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
                    {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{delta > 0 ? '+' : ''}{delta}<span className="sr-only">{tx(' since the start of the term', ' منذ بداية الفصل')}</span>
                  </span>
                </div>
                <Sparkline values={line} width={96} height={32} color={delta >= 0 ? 'var(--chart-1)' : 'var(--danger)'} />
              </div>
              <ProgressBar value={pct} className="mt-3" />
              {s.nextAssessment && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" />{tx('Next', 'التالي')}: {formatDate(s.nextAssessment.date, locale)} · {relativeDay(s.nextAssessment.date, world.today, locale)}
                </p>
              )}
              <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="secondary" onClick={() => router.push(`/app/chat?q=${encodeURIComponent(`How can I improve in ${s.name}?`)}`)}><Target />{tx('Plan to improve', 'خطة للتحسن')}</Button>
              </div>
            </Card>
          );
        })}
      </Bento>
    </Page>
  );
}

export default function AcademicsPage() {
  return <Suspense fallback={null}><View /></Suspense>;
}
