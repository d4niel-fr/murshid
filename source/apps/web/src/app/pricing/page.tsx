'use client';

import { useEffect, useState } from 'react';
import { MicrosoftMark } from '@/components/shell/icons';
import { Eyebrow, Footer, MarketingShell, Panel, Pill } from '@/components/marketing/chrome';
import { Letters, Rise, spring } from '@/components/marketing/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { FALLBACK_PLANS, getPlans, type Plan } from '@/lib/school-api';

function PlanPlate({ p, index }: { p: Plan; index: number }) {
  const school = p.audience === 'schools';
  return (
    <Rise delay={index * 110} y={32} config={spring(180, 26)} className="h-full">
      <div className={`relative flex h-full flex-col rounded-[2rem] p-[2rem] ${school ? 'bg-[var(--deep)] text-white' : 'bg-[var(--surface)] text-[var(--text)]'}`}>
        <div className="flex items-center justify-between">
          <Eyebrow tone={school ? 'light' : 'dark'}>{school ? 'For schools · recommended' : 'For families'}</Eyebrow>
          <span className={`text-[0.75rem] font-medium tabular-nums ${school ? 'text-white/55' : 'text-[var(--text-muted)]'}`}>0{index + 1}</span>
        </div>
        <h2 className="mt-[1.5rem] text-[2rem] font-medium tracking-[-0.025em]">{p.name}</h2>
        <div className="mt-[1.5rem] flex items-baseline gap-[0.5rem]">
          <span className="text-[1rem] font-medium">AED</span>
          <span className="mk-figure text-[4.5rem]"><Letters text={String(p.priceAed)} delay={200 + index * 110} /></span>
          <span className={`text-[0.875rem] ${school ? 'text-white/65' : 'text-[var(--text-muted)]'}`}>{p.per === 'month' ? 'a month' : 'per student / year'}</span>
        </div>
        <p className={`mt-[0.5rem] text-[0.8125rem] ${school ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
          {p.per === 'month' ? `or AED ${p.yearlyAed} a year` : `List AED ${p.rangeAed?.[0]}–${p.rangeAed?.[1]} by size · pilots available`}
        </p>
        <p className="mt-[1.5rem] text-[1rem] leading-relaxed">{p.blurb}</p>
        <ul className={`mt-[1.5rem] flex flex-col border-t ${school ? 'border-white/15' : 'border-[var(--border)]'}`}>
          {p.features.map((f) => (
            <li key={f} className={`flex gap-[0.75rem] border-b py-[0.75rem] text-[0.9375rem] ${school ? 'border-white/15' : 'border-[var(--border)]'}`}>
              <span className={`mt-[0.5rem] size-1.5 shrink-0 rounded-full ${school ? 'bg-[var(--spark)]' : 'bg-[var(--brand)]'}`} />{f}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-[2rem]">
          {school
            ? <Pill variant="light" href="/survey">Tell us what your school needs</Pill>
            : <Pill variant="outline" href="/welcome">Get {p.name}</Pill>}
        </div>
      </div>
    </Rise>
  );
}

export default function PricingPage() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);
  return (
    <MarketingShell>
      <main>
        <PageHero eyebrow="Plans & pricing · UAE dirhams" lines={['Two ways', 'in']}
          intro="Schools license Murshid for every student, and families can buy it directly. A school only ever sees students under its own licence." />
        <section className="px-[1.5rem] py-[5rem] sm:px-[2.5rem]">
          <div className="grid grid-cols-1 items-stretch gap-[1.25rem] lg:grid-cols-[1.25fr_1fr_1fr]">
            {[...plans.schools, ...plans.families].map((p, i) => <PlanPlate key={p.id} p={p} index={i} />)}
          </div>
          <div className="mt-[1.25rem] grid gap-[1.25rem] md:grid-cols-2">
            <Rise delay={120}><Panel className="!p-[1.75rem]"><div className="flex items-start gap-[1rem]"><MicrosoftMark className="mt-1 size-5 shrink-0" /><p className="text-[1rem] leading-relaxed"><b className="font-medium">Works with Microsoft 365.</b> <span className="text-[var(--text-muted)]">Staff and students sign in with their school accounts; Teams classes and assignments come in automatically. Or teachers post work directly in the portal.</span></p></div></Panel></Rise>
            <Rise delay={200}><Panel className="!p-[1.75rem]"><p className="text-[1rem] leading-relaxed"><b className="font-medium">Proposed Grade 11 pilot.</b> <span className="text-[var(--text-muted)]">At a Dubai secondary school, subject to the school’s approval. Not a confirmed partnership. The school shown in the demo is fictional.</span></p></Panel></Rise>
          </div>
          <p className="mt-[2rem] text-[0.8125rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">Prices in UAE dirhams. Family and school accounts are separate. Demo: no payment is ever taken.</p>
        </section>
      </main>
      <Footer />
    </MarketingShell>
  );
}
