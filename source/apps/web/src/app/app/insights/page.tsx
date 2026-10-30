'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChartColumn, ChartLine, ChartPie, ChartArea, MessageCircle, Layers, CircleDot, Download } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useApp, useEndpoint } from '@/components/providers/app-provider';
import { ChartCard, RangeToggle } from '@/components/charts/chart-card';
import { Page, PageHeader } from '@/components/shared/page';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { buildChartSpec } from '@/lib/progress';
import type { ChartRange, ChartSpec, ChartType } from '@/lib/types';

const TYPES: { value: ChartType; icon: typeof ChartLine; en: string; ar: string }[] = [
  { value: 'line', icon: ChartLine, en: 'Line', ar: 'خطي' },
  { value: 'area', icon: ChartArea, en: 'Area', ar: 'مساحي' },
  { value: 'bar', icon: ChartColumn, en: 'Bar', ar: 'أعمدة' },
  { value: 'stacked-bar', icon: Layers, en: 'Stacked', ar: 'مكدس' },
  { value: 'pie', icon: ChartPie, en: 'Donut', ar: 'دائري' },
  { value: 'radial', icon: CircleDot, en: 'Radial', ar: 'شعاعي' },
];

function Studio() {
  const { world, locale, tx, bandConfig, band } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const subs = world.academics.subjects;
  const acts = world.extracurriculars.activities;
  const [area, setArea] = useState(params.get('area') ?? 'academics');
  const [range, setRange] = useState<ChartRange>((params.get('range') as ChartRange) || bandConfig.chartDefaults.defaultRange);
  const [type, setType] = useState<ChartType | 'auto'>((params.get('type') as ChartType) || 'auto');
  const [cmpA, setCmpA] = useState(params.get('compare')?.split(',')[0] ?? subs[0]?.id ?? '');
  const [cmpB, setCmpB] = useState(params.get('compare')?.split(',')[1] ?? subs[1]?.id ?? '');

  useEffect(() => { if (!subs.some((s) => s.id === cmpA)) { setCmpA(subs[0]?.id ?? ''); setCmpB(subs[1]?.id ?? ''); } }, [band, subs, cmpA]);

  const query = useMemo(() => ({ area: area === 'compare' ? 'academics' : area, range, type: type === 'auto' ? undefined : type, compare: area === 'compare' ? [cmpA, cmpB] : undefined, locale }), [area, range, type, cmpA, cmpB, locale]);
  const local = useMemo(() => buildChartSpec(world, query), [world, query]);
  // GET /progress when the API is up (single-area queries only); bundled builder otherwise.
  const { data: spec } = useEndpoint<ChartSpec>(`progress:${band}:${query.area}:${range}:${query.type ?? ''}:${area}`, (c) => (area === 'compare' ? Promise.resolve({ data: local, source: 'mock' as const }) : c.getProgress(query.area, range, query.type)), local);

  const ask = () => {
    const label = area === 'compare' ? `${subs.find((s) => s.id === cmpA)?.name} and ${subs.find((s) => s.id === cmpB)?.name}` : spec.title;
    router.push(`/app/chat?q=${encodeURIComponent(area === 'compare' ? `Compare my ${label}` : `Tell me about ${label.toLowerCase()} over the ${range}`)}`);
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${spec.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Page>
      <PageHeader
        eyebrow={tx('Charts studio', 'استوديو الرسوم')}
        title={tx('Insights', 'الرؤى')}
        subtitle={tx('Pick an area, a time range and a chart type. Every chart is built from your own logged data.', 'اختر مجالاً ونطاقاً زمنياً ونوع رسم. كل رسم مبني من بياناتك.')}
        actions={<>
          <Button variant="outline" onClick={download}><Download />{tx('Export spec', 'تصدير')}</Button>
          <Button onClick={ask}><MessageCircle />{tx('Ask Murshid about this', 'اسأل مرشد عن هذا')}</Button>
        </>}
      />
      <div className="card mb-4 grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label htmlFor="area">{tx('Area', 'المجال')}</Label>
            <Select id="area" value={area} onChange={(e) => setArea(e.target.value)}>
              <optgroup label={tx('Overview', 'نظرة عامة')}>
                <option value="academics">{tx('All subjects', 'كل المواد')}</option>
                <option value="compare">{tx('Compare two subjects', 'مقارنة مادتين')}</option>
                <option value="extracurriculars">{tx('All activities', 'كل الأنشطة')}</option>
                <option value="balance">{tx('Time balance', 'توازن الوقت')}</option>
                <option value="goals">{tx('Goals', 'الأهداف')}</option>
              </optgroup>
              <optgroup label={tx('Activities', 'الأنشطة')}>
                {acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </optgroup>
              <optgroup label={tx('Subjects', 'المواد')}>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            </Select>
          </div>
          {area === 'compare' && (
            <>
              <div>
                <Label htmlFor="ca">{tx('Subject A', 'المادة أ')}</Label>
                <Select id="ca" value={cmpA} onChange={(e) => setCmpA(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </div>
              <div>
                <Label htmlFor="cb">{tx('Subject B', 'المادة ب')}</Label>
                <Select id="cb" value={cmpB} onChange={(e) => setCmpB(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{tx('Range', 'النطاق')}</span>
          <RangeToggle value={range} onChange={setRange} />
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-medium">{tx('Chart type', 'نوع الرسم')}</span>
          <Segmented
            value={type}
            onChange={setType}
            ariaLabel="Chart type"
            className="w-fit flex-wrap"
            options={[{ value: 'auto' as const, label: tx('Auto', 'تلقائي') }, ...TYPES.map((tp) => ({ value: tp.value, label: <span className="inline-flex items-center gap-1.5"><tp.icon className="size-3.5" />{tx(tp.en, tp.ar)}</span> }))]}
          />
        </div>
      </div>
      <ChartCard key={`${spec.id}`} spec={spec} height={340} />
    </Page>
  );
}

export default function InsightsPage() {
  return <Suspense fallback={null}><Studio /></Suspense>;
}
