'use client';

import { Award, TrendingUp } from 'lucide-react';
import { Ago } from '@/components/shared/ago';
import { SchoolSection } from '@/components/life/gate';
import { useLoad } from '@/components/life/use-load';
import { useApp } from '@/components/providers/app-provider';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { NumberTicker } from '@/components/ui/number-ticker';
import { getPoints } from '@/lib/life-api';
import { cn } from '@/lib/utils';

const AR: Record<string, string> = {
  effort: 'جهد رائع', participation: 'المشاركة', helping: 'مساعدة الآخرين', teamwork: 'العمل الجماعي', kindness: 'اللطف', leadership: 'القيادة', creativity: 'الإبداع',
  improvement: 'تحسّن كبير', homework: 'واجب ممتاز', focus: 'تركيز', off_task: 'خارج المهمة', unprepared: 'غير مستعد', late: 'متأخر عن الصف',
};

export default function PointsPage() {
  const { tx, locale } = useApp();
  const load = useLoad(getPoints);
  const name = (id: string, en: string) => (locale === 'ar' ? AR[id] ?? en : en);
  return (
    <SchoolSection title={tx('Points', 'النقاط')} subtitle={tx('Points your teachers give for effort, kindness and helping others. Notes on what to work on show here too.', 'نقاط يمنحها معلموك للجهد واللطف ومساعدة الآخرين، مع ملاحظات لما يحتاج إلى تحسين.')} load={load}>
      {(d) => {
        const max = Math.max(1, ...d.byReason.map((r) => Math.abs(r.n)));
        return (
          <div className="grid grid-cols-12 gap-4">
            <Card className="col-span-12 bg-[var(--deep)] text-white sm:col-span-6 lg:col-span-4">
              <p className="eyebrow mb-3 text-white/70">{tx(`This term (${d.term.replace('T', 'Term ')})`, 'هذا الفصل')}</p>
              <p className="text-6xl font-medium tracking-[-0.04em]"><NumberTicker value={d.total} locale={locale} /></p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/75"><TrendingUp className="size-4" />{d.week >= 0 ? tx(`+${d.week} this week`, `+${d.week} هذا الأسبوع`) : tx(`${d.week} this week`, `${d.week} هذا الأسبوع`)}</p>
            </Card>
            <Card className="col-span-12 sm:col-span-6 lg:col-span-8">
              <CardHeader title={tx('What they were for', 'لماذا حصلت عليها')} icon={<Award />} />
              {!d.byReason.length ? <Muted>{tx('No points yet this term.', 'لا نقاط بعد هذا الفصل.')}</Muted> : (
                <ul className="grid gap-2.5">
                  {d.byReason.map((r) => (
                    <li key={r.id} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-sm">
                      <span className="truncate">{name(r.id, r.label)}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-surface"><span className={cn('block h-full rounded-full', r.n < 0 ? 'bg-[var(--warning)]' : 'bg-[var(--brand)]')} style={{ width: `${(Math.abs(r.n) / max) * 100}%` }} /></span>
                      <span className={cn('text-end tabular-nums', r.n < 0 && 'text-warning')}>{r.n > 0 ? `+${r.n}` : r.n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="col-span-12 lg:col-span-5">
              <CardHeader title={tx('By class', 'حسب الصف')} />
              <ul className="divide-y divide-border">
                {d.byClass.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="truncate">{c.subjectName}</span><span className="tabular-nums font-medium">{c.n}</span></li>)}
              </ul>
            </Card>
            <Card className="col-span-12 lg:col-span-7">
              <CardHeader title={tx('Latest', 'الأحدث')} />
              {!d.recent.length ? <Muted>{tx('Nothing yet.', 'لا شيء بعد.')}</Muted> : (
                <ul className="divide-y divide-border">
                  {d.recent.map((p) => (
                    <li key={p.id} className="flex items-start gap-3 py-3 text-sm">
                      <span className={cn('grid h-8 min-w-8 shrink-0 place-items-center rounded-full px-2 text-xs font-semibold tabular-nums', p.points > 0 ? 'bg-brand-soft text-primary' : 'tint-warning')}>{p.points > 0 ? `+${p.points}` : p.points}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{name(p.reason, p.label)}</span>
                        <span className="block text-xs text-muted-foreground"><bdi>{p.byName}</bdi> · {p.className} · <Ago ts={Date.parse(p.at)} locale={locale} /></span>
                        {p.note && <span dir="auto" className="mt-1 block">{p.note}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        );
      }}
    </SchoolSection>
  );
}
