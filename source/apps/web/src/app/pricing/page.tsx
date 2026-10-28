'use client';

import Link from 'next/link';
import { Building2, Check, Home } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MicrosoftMark, MurshidMark } from '@/components/shell/icons';
import { FALLBACK_PLANS, getPlans, type Plan } from '@/lib/school-api';
import { cn } from '@/lib/utils';

function PlanCard({ p }: { p: Plan }) {
  const school = p.audience === 'schools';
  return (
    <div className={cn('card relative flex flex-col p-7', school && 'ring-2 ring-primary')}>
      {school && <span className="absolute -top-3 start-6 rounded-full bg-primary px-3 py-1 text-2xs font-semibold text-primary-foreground">Recommended for schools</span>}
      <div className="flex items-center gap-2 text-sm font-semibold">{school ? <Building2 className="size-4 text-primary" /> : <Home className="size-4 text-primary" />}{p.name}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-4xl font-semibold tracking-tight">AED {p.priceAed}</span>
        <span className="text-sm text-muted-foreground">{p.per === 'month' ? 'a month' : 'per student, per year'}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{p.per === 'month' ? `or AED ${p.yearlyAed} a year` : `List price AED ${p.rangeAed?.[0]}\u2013${p.rangeAed?.[1]} depending on size; pilots available`}</div>
      <p className="mt-4 text-sm">{p.blurb}</p>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /><span>{f}</span></li>)}
      </ul>
      <div className="mt-auto pt-6">
        {school
          ? <Link href="/survey" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-primary text-sm font-medium text-primary-foreground">Tell us what your school needs</Link>
          : <Link href="/welcome" className="inline-flex h-10 w-full items-center justify-center rounded-sm border border-border bg-surface text-sm font-medium hover:bg-surface-2">Get {p.name}</Link>}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  useEffect(() => { getPlans().then(setPlans).catch(() => {}); }, []);
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5"><MurshidMark className="size-9" /><span className="text-base font-semibold">Murshid</span></Link>
        <Link href="/welcome" className="text-sm font-medium text-primary">Get started</Link>
      </header>
      <main className="mx-auto max-w-[1180px] px-6 pb-16 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Two ways to get Murshid</h1>
        <p className="mt-2 max-w-[66ch] text-muted-foreground">Murshid helps students get their work done and stay on top of it. Schools license it for every student; families can buy it directly.</p>
        <div className="mt-10 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1.25fr_1fr_1fr]">
          {plans.schools.map((p) => <PlanCard key={p.id} p={p} />)}
          {plans.families.map((p) => <PlanCard key={p.id} p={p} />)}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="card flex items-start gap-3 p-5 text-sm"><MicrosoftMark className="mt-0.5 size-5 shrink-0" /><span><span className="font-medium">Works with Microsoft 365.</span> <span className="text-muted-foreground">Staff and students sign in with their school accounts; Teams classes and assignments come in automatically. Or teachers post work directly in the portal.</span></span></div>
          <div className="card flex items-start gap-3 p-5 text-sm"><Building2 className="mt-0.5 size-5 shrink-0 text-primary" /><span><span className="font-medium">Proposed Grade 11 pilot.</span> <span className="text-muted-foreground">At Our Own High School Al Warqa&rsquo;a, Dubai (GEMS Education), subject to the school&rsquo;s approval.</span></span></div>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Prices in UAE dirhams. Family and school accounts are separate: a school only ever sees students under its own licence.</p>
      </main>
    </div>
  );
}
