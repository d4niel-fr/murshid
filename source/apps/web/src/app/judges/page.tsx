import Link from 'next/link';
import type { Metadata } from 'next';
import { MurshidMark } from '@/components/shell/icons';
import { DemoLogins } from './demo-logins';

export const metadata: Metadata = { title: 'For judges', description: 'Try Murshid in one click: student, teacher and school admin demo logins.' };

const TRY: [string, string][] = [
  ['Student (Ahamed Mehta)', 'Open Chat and ask "Plan my week around my mid-term and both sports". Expand "How Murshid worked this out" under the reply to see the goal, plan, tools and actions.'],
  ['Teacher (Ms. Sana Thomas)', 'Open "Best day for homework" to compare set/due days with the class on-time likelihood, then post an assignment and watch Murshid replan every student\u2019s week.'],
  ['School admin', 'School & licence, the audit log of every change, and the anonymous validation survey results. Protected by the admin passcode given in the submission notes.'],
];

export default function JudgesPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-5">
        <Link href="/judges" className="flex items-center gap-2.5"><MurshidMark className="size-9" /><span className="text-base font-semibold">Murshid</span></Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">How it works</Link>
          <Link href="/survey" className="text-muted-foreground hover:text-foreground">Survey</Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-[1080px] px-6 pb-20 pt-4">
        <p className="text-sm font-medium text-primary">Dubai Chamber Create AI Agents Championship &middot; Youth</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Try Murshid in one click</h1>
        <p className="mt-3 max-w-[72ch] text-muted-foreground">
          Murshid is an AI agent that keeps a UAE high-school student&rsquo;s week under control: it reads their timetable, tests, homework and sport,
          plans the week, takes action in their planner, and tells teachers who needs support and the best day to set homework.
          Everything here is a demo with fictional students and teachers; Microsoft 365 sign-in is simulated.
        </p>

        <DemoLogins />

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {TRY.map(([t, b]) => (
            <div key={t} className="card p-5">
              <div className="text-sm font-semibold">What to try: {t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{b}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <Link href="/how-it-works" className="card block p-5 hover:bg-surface-2">
            <div className="text-sm font-semibold">How Murshid works &rarr;</div>
            <p className="mt-2 text-sm text-muted-foreground">The plan-and-act loop, the tools it may use, the guardrails (consent, school data separation, human approval, audit log) and model routing.</p>
          </Link>
          <Link href="/survey" className="card block p-5 hover:bg-surface-2">
            <div className="text-sm font-semibold">Validation survey &rarr;</div>
            <p className="mt-2 text-sm text-muted-foreground">The anonymous two-minute survey for students and teachers we use to validate the problem. No names or personal data are collected.</p>
          </Link>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Demo build. All students and teachers are fictional (synthetic data). Proposed Grade 11 pilot at Our Own High School Al Warqa&rsquo;a, Dubai, subject to the
          school&rsquo;s approval; not a confirmed partnership. The demo runs on free AI models with a daily limit; when it is reached, Murshid answers from its rule
          engine and says so in the trace.
        </p>
      </main>
    </div>
  );
}
