'use client';

import { Printer } from 'lucide-react';
import { useState } from 'react';
import { SchoolSection } from '@/components/life/gate';
import { useLoad } from '@/components/life/use-load';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Card, Muted } from '@/components/ui/card';
import { getReports } from '@/lib/life-api';
import { cn } from '@/lib/utils';

const EFFORT_AR = ['', 'يحتاج إلى بذل جهد أكبر', 'جهد مقبول', 'جهد جيد', 'جهد ممتاز'];

export default function ReportsPage() {
  const { tx, locale } = useApp();
  const load = useLoad(getReports);
  const [term, setTerm] = useState<string | null>(null);
  return (
    <SchoolSection title={tx('Reports', 'التقارير')} subtitle={tx('Your teachers’ end-of-term comments. Print or save as PDF to keep a copy.', 'تعليقات معلميك في نهاية الفصل. اطبعها أو احفظها PDF.')}
      actions={load.data?.terms.length ? <Button variant="secondary" onClick={() => window.print()}><Printer className="size-4" />{tx('Print or save PDF', 'طباعة أو حفظ PDF')}</Button> : undefined} load={load}>
      {(d) => {
        if (!d.terms.length) return <Muted>{tx('No reports yet. They appear here when your teachers publish them at the end of term.', 'لا تقارير بعد. تظهر هنا عندما ينشرها معلموك في نهاية الفصل.')}</Muted>;
        const active = d.terms.find((t) => t.term === term) ?? d.terms.at(-1)!;
        return (
          <>
            {d.terms.length > 1 && (
              <div role="tablist" className="no-print mb-4 flex gap-2">
                {d.terms.map((t) => <button key={t.term} role="tab" aria-selected={t.term === active.term} onClick={() => setTerm(t.term)} className={cn('h-10 rounded-full px-4 text-sm font-medium', t.term === active.term ? 'bg-[var(--deep)] text-white' : 'bg-surface')}>{t.term.replace('T', tx('Term ', 'الفصل '))}</button>)}
              </div>
            )}
            <Card className="print:shadow-none">
              <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
                <div>
                  <p className="eyebrow mb-2">{d.student.school}</p>
                  <h2 className="text-2xl font-medium">{d.student.name}</h2>
                  <p className="text-sm text-muted-foreground">{[d.student.grade && tx(`Grade ${d.student.grade}`, `الصف ${d.student.grade}`), d.student.section].filter(Boolean).join(' · ')}</p>
                </div>
                <p className="text-lg font-medium">{active.term.replace('T', tx('Term ', 'الفصل '))}</p>
              </header>
              <ul className="grid gap-6">
                {active.subjects.map((s) => (
                  <li key={s.classId} className="break-inside-avoid">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-base font-medium">{s.subjectName}</h3>
                      <p className="text-xs text-muted-foreground"><bdi>{s.teacher}</bdi></p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-surface px-3 py-1">{tx('Effort', 'الجهد')}: <b className="font-medium">{locale === 'ar' ? EFFORT_AR[s.effort] : s.effortLabel}</b></span>
                      {s.average !== null && <span className="rounded-full bg-surface px-3 py-1">{tx('Average', 'المعدل')}: <b className="font-medium tabular-nums">{s.average}%</b></span>}
                      {s.attendance !== null && <span className="rounded-full bg-surface px-3 py-1">{tx('Attendance', 'الحضور')}: <b className="font-medium tabular-nums">{s.attendance}%</b></span>}
                    </div>
                    <p dir="auto" className="mt-3 text-[0.9375rem] leading-relaxed">{s.comment}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        );
      }}
    </SchoolSection>
  );
}
