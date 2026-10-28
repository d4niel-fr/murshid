import Link from 'next/link';
import type { Metadata } from 'next';
import { MurshidMark } from '@/components/shell/icons';

export const metadata: Metadata = { title: 'How Murshid works', description: 'The agent loop, tools, guardrails and model routing behind Murshid.' };

const LOOP: { n: string; title: string; body: string }[] = [
  { n: '1', title: 'Safety check first', body: 'Messages with crisis language (self-harm, abuse, danger) never reach a model. Murshid replies with a fixed, supportive message and UAE helplines (800-HOPE).' },
  { n: '2', title: 'Understand the goal and plan', body: 'Keyword rules decide which parts of the request need handling (studies, training, opportunities, CV, week plan, side project, wellbeing). If no rule matches and a model is available, a small routing model picks up to three. Quick lookups ("what\u2019s due today") go straight to the rule engine.' },
  { n: '3', title: 'Read the student\u2019s real data', body: 'Each part first calls its read tools (timetable, assignments, grades, training, goals, opportunities) so the plan is grounded in the student\u2019s own numbers and dates.' },
  { n: '4', title: 'Reason and use tools', body: 'The model gets that data plus a short list of tools it may call. It can make up to two rounds of tool calls (read more, or act) before it must answer. When a request has several parts, the first part leads and owns any changes; the others only advise, so nothing is created twice.' },
  { n: '5', title: 'Take action', body: 'Write tools change only the student\u2019s own planner and records: add a task, write a week plan into the calendar, save an opportunity with a prep task, add a project milestone, or build a LinkedIn-ready CV and PDF. Every change is audit-logged.' },
  { n: '6', title: 'Fall back safely', body: 'If every model fails or the daily model budget is used up, the same steps run on the rule-based engine from the same data, and a clear "write" request ("plan my week", "make my CV") is still carried out.' },
  { n: '7', title: 'Explain the result', body: 'The reply comes back with a trace: goal understood, steps planned, tools used, actions taken and result. Turn on "Show how Murshid worked it out" in Settings to see it under every reply.' },
];

const TOOLS: [string, string][] = [
  ['Timetable and calendar', 'Tests, deadlines and fixtures in the next days (read).'],
  ['Assignments', 'Teacher-posted work and Microsoft Teams-synced work (read).'],
  ['Grades, training, goals', 'Subject trends, assessments, training load, personal bests (read).'],
  ['Opportunity search', 'Competitions, programmes, internships matched to the student (read), save with a prep task (write).'],
  ['Calendar and planner', 'Write a 7-day week plan, add tasks and reminders (write).'],
  ['CV builder', 'LinkedIn headline, About and experience, exported as a PDF (write).'],
  ['Cards', 'Progress charts, task lists and opportunity cards shown in the chat (UI).'],
];

const AUTOMATION = [
  'A teacher posts work in the school portal (or it syncs from Microsoft Teams).',
  'For every student in the class, Murshid reads their timetable, tests, fixtures and sport, and adds up the load per day across all subjects.',
  'It schedules a work session on the lightest day before the due date and sets a reminder for the evening before.',
  'If even the lightest day before the due date has no room for it (after-school capacity is 240 min on school days, 330 at weekends), or there are 2+ tests in the 2 days before it is due, the teacher sees that student as "At risk: extra support", with the reason. The best-day model uses the same rule, so at-risk students are never counted as likely on time.',
  'This runs on fixed, explainable rules (no model), and the teacher can open "How Murshid worked this out".',
];

const GUARDRAILS: [string, string][] = [
  ['Consent', 'Consent is recorded per purpose (core service, school connector, guardian summaries, notifications, sharing with universities), versioned and separately revocable. Under-18s need a verified guardian for each purpose. The demo uses only fictional students, so consent is pre-recorded for them.'],
  ['School data separation', 'Every student belongs to exactly one tenant: a school or a family. A teacher only sees the classes they teach in their own school; a school admin only their own school; family accounts never appear to a school.'],
  ['Human approval before anything is sent', 'The chat never sends or posts anything outside Murshid. Publishing to a social profile (e.g. LinkedIn) is blocked in code until the student approves that exact draft; the approval is tied to the draft and expires.'],
  ['Audit log', 'Every change made for a student (by a teacher, an admin or Murshid) is logged with who, what and when.'],
  ['Data minimisation', 'Models see only the data the current step needs (capped in size), never other students. Student data is never used for ads.'],
  ['Wellbeing', 'No medical advice; stress and crisis messages get a safe reply and point to a parent, the school counsellor or helplines.'],
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-6 py-5">
        <Link href="/judges" className="flex items-center gap-2.5"><MurshidMark className="size-9" /><span className="text-base font-semibold">Murshid</span></Link>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/judges" className="text-muted-foreground hover:text-foreground">Demo</Link>
          <Link href="/survey" className="text-muted-foreground hover:text-foreground">Survey</Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-[1080px] px-6 pb-20 pt-4">
        <p className="text-sm font-medium text-primary">For judges and the curious</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">How Murshid works</h1>
        <p className="mt-3 max-w-[70ch] text-muted-foreground">
          Murshid is an AI agent that keeps a student&rsquo;s week under control. It understands what the student or teacher wants, plans the steps,
          uses tools on the student&rsquo;s real timetable and work, takes action in their plan, and explains what it did. Everything on this page
          describes what the code in this demo actually does.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">The agent loop</h2>
          <ol className="mt-4 grid gap-3 md:grid-cols-2">
            {LOOP.map((s) => (
              <li key={s.n} className="card flex gap-4 p-5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-primary">{s.n}</span>
                <span><span className="block font-medium">{s.title}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{s.body}</span></span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Acting on its own: when a teacher posts work</h2>
          <ol className="card mt-4 list-decimal space-y-2 p-6 ps-10 text-sm leading-relaxed">
            {AUTOMATION.map((a) => <li key={a}>{a}</li>)}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Tools</h2>
          <div className="card mt-4 divide-y divide-border">
            {TOOLS.map(([t, d]) => (
              <div key={t} className="grid gap-1 px-5 py-3 text-sm md:grid-cols-[220px_1fr]"><span className="font-medium">{t}</span><span className="text-muted-foreground">{d}</span></div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Guardrails</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {GUARDRAILS.map(([t, d]) => (
              <div key={t} className="card p-5"><p className="font-medium">{t}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p></div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Model routing</h2>
          <div className="card mt-4 space-y-3 p-6 text-sm leading-relaxed">
            <p><span className="font-medium">This demo:</span> free OpenRouter models in a fallback chain: NVIDIA Nemotron 3 Super first, then Google Gemma 4 31B, then Nemotron 3.5 Lightning. Each part of a request has its own model preference (e.g. opportunity search prefers the fast model). A rate-limited or failed model moves on to the next; if all fail, the rule-based engine answers.</p>
            <p><span className="font-medium">Reliability:</span> free models allow about 50 requests a day, so a daily budget guard switches to the rule-based engine before the limit, and the demo personas&rsquo; scripted questions can replay a saved answer (labelled &ldquo;Replayed demo answer&rdquo; in the trace).</p>
            <p><span className="font-medium">Production design:</span> routing by task (routing, chat, planning, reading notes) with a monthly AI budget per student (cheaper models from 80%, rules-only at 100%). Requests containing personal data are only sent to models cleared for it; models in regions not cleared for student data are excluded. Estimated AI cost: about US$0.44 per student per month (estimate).</p>
            <p><span className="font-medium">No model at all:</span> teacher analytics (class progress, who needs what, best day for homework, weekly reports) and the teacher-post automation run on fixed, explainable rules on the school&rsquo;s own data.</p>
          </div>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">Demo build: all students and teachers are fictional. Microsoft 365 sign-in is simulated. Proposed Grade 11 pilot at Our Own High School Al Warqa&rsquo;a.</p>
      </main>
    </div>
  );
}
