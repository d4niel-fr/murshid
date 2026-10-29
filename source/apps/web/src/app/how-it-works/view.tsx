'use client';

import { Footer, MarketingShell, Panel, Shot } from '@/components/marketing/chrome';
import { Rise, spring } from '@/components/marketing/motion';
import { PageHero, SectionHead } from '@/components/marketing/page-hero';

const LOOP: { title: string; body: string }[] = [
  { title: 'Safety check first', body: 'Messages with crisis language (self-harm, abuse, danger) never reach a model. Murshid replies with a fixed, supportive message and UAE helplines (800-HOPE).' },
  { title: 'Understand the goal and plan', body: 'Keyword rules decide which parts of the request need handling: studies, training, opportunities, CV, week plan, side project, wellbeing. If no rule matches and a model is available, a small routing model picks up to three. Quick lookups go straight to the rule engine.' },
  { title: 'Read the student’s real data', body: 'Each part first calls its read tools (timetable, assignments, grades, training, goals, opportunities), so the plan is grounded in the student’s own numbers and dates.' },
  { title: 'Reason and use tools', body: 'The model gets that data plus a short list of tools it may call, and can make up to two rounds of tool calls before it must answer. When a request has several parts, the first part leads and owns any changes; the others only advise, so nothing is created twice.' },
  { title: 'Take action', body: 'Write tools change only the student’s own planner and records: add a task, write a week plan into the calendar, save an opportunity with a prep task, add a project milestone, or build a LinkedIn-ready CV and PDF. Every change is audit-logged.' },
  { title: 'Fall back safely', body: 'If every model fails or the daily model budget is used up, the same steps run on the rule-based engine from the same data, and a clear “write” request (“plan my week”, “make my CV”) is still carried out.' },
  { title: 'Explain the result', body: 'The reply comes back with a trace: goal understood, steps planned, tools used, actions taken and result. Turn on “Show how Murshid worked it out” in Settings to see it under every reply.' },
];

const TOOLS: [string, string, string][] = [
  ['Timetable and calendar', 'Tests, deadlines and fixtures in the next days.', 'Read'],
  ['Assignments', 'Teacher-posted work and Microsoft Teams-synced work.', 'Read'],
  ['Grades, training, goals', 'Subject trends, assessments, training load, personal bests.', 'Read'],
  ['Opportunity search', 'Competitions, programmes and internships matched to the student; save one with a prep task.', 'Read · Write'],
  ['Calendar and planner', 'Write a 7-day week plan, add tasks and reminders.', 'Write'],
  ['CV builder', 'LinkedIn headline, About and experience, exported as a PDF.', 'Write'],
  ['Cards', 'Progress charts, task lists and opportunity cards shown in the chat.', 'UI'],
];

const AUTOMATION = [
  'A teacher posts work in the school portal, or it syncs from Microsoft Teams.',
  'For every student in the class, Murshid reads their timetable, tests, fixtures and sport, and adds up the load per day across all subjects.',
  'It schedules a work session on the lightest day before the due date and sets a reminder for the evening before.',
  'If even the lightest day has no room (after-school capacity is 240 minutes on school days, 330 at weekends), or there are 2+ tests in the 2 days before it is due, the teacher sees that student as “At risk: extra support”, with the reason.',
  'All of this runs on fixed, explainable rules with no model, and the teacher can open “How Murshid worked this out”.',
];

const GUARDRAILS: [string, string][] = [
  ['Consent', 'Recorded per purpose (core service, school connector, guardian summaries, notifications, sharing with universities), versioned and separately revocable. Under-18s need a verified guardian for each purpose.'],
  ['School data separation', 'Every student belongs to exactly one tenant: a school or a family. A teacher only sees the classes they teach; a school admin only their own school; family accounts never appear to a school.'],
  ['Human approval', 'The chat never sends or posts anything outside Murshid. Publishing to LinkedIn is blocked in code until the student approves that exact draft; the approval is tied to the draft and expires.'],
  ['Audit log', 'Every change made for a student, by a teacher, an admin or Murshid, is logged with who, what and when.'],
  ['Data minimisation', 'Models see only the data the current step needs, capped in size, and never other students. Student data is never used for ads.'],
  ['Wellbeing', 'No medical advice. Stress and crisis messages get a safe reply and point to a parent, the school counsellor or helplines.'],
];

const ROUTING: [string, string][] = [
  ['This demo', 'Free OpenRouter models in a fallback chain: NVIDIA Nemotron 3 Super, then Google Gemma 4 31B, then Nemotron 3.5 Lightning. A rate-limited or failed model moves on to the next; if all fail, the rule-based engine answers.'],
  ['Reliability', 'Free models allow about 50 requests a day, so a daily budget guard switches to the rule engine before the limit, and the demo personas’ scripted questions can replay a saved answer, labelled “Replayed demo answer” in the trace.'],
  ['Production design', 'Routing by task with a monthly AI budget per student: cheaper models from 80%, rules only at 100%. Personal data only goes to models cleared for it. Estimated AI cost: about US$0.49 per student per month.'],
  ['No model at all', 'Teacher analytics (class progress, who needs what, best day for homework, weekly reports) and the teacher-post automation run on fixed, explainable rules on the school’s own data.'],
];

export function HowItWorks() {
  return (
    <MarketingShell>
      <main>
        <PageHero
          eyebrow="For judges and the curious"
          lines={['How Murshid', 'works']}
          intro={<>Murshid understands what a student or teacher wants, plans the steps, uses tools on the student’s real timetable and work, acts in their plan, and explains what it did. <b className="font-medium text-white">Everything here describes what the code in this demo actually does.</b></>}
        />

        {/* the loop */}
        <section id="loop" aria-labelledby="loop-title" className="px-[1.5rem] py-[6rem] sm:px-[2.5rem]">
          <SectionHead eyebrow="Every request" lines={['The agent', 'loop']} note="Seven steps, in this order, for every message. The trace under each reply shows which ones ran." />
          <ol className="mt-[3.5rem] grid gap-x-[2.5rem] md:grid-cols-2">
            {LOOP.map((s, i) => (
              <Rise as="li" key={s.title} delay={(i % 2) * 90} y={24} config={spring(190, 26)} className="grid grid-cols-[3.5rem_1fr] gap-x-[1rem] border-t border-[var(--border)] py-[1.75rem]">
                <span className="mk-figure text-[2rem] text-[var(--brand)]">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="block text-[1.375rem] font-medium leading-tight tracking-[-0.02em]">{s.title}</span>
                  <span className="mt-[0.5rem] block text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">{s.body}</span>
                </span>
              </Rise>
            ))}
          </ol>
        </section>

        {/* teacher posts */}
        <section aria-labelledby="auto" className="mk-band bg-[var(--surface)] px-[1.5rem] py-[6rem] sm:px-[2.5rem]">
          <SectionHead eyebrow="Acting on its own" lines={['When a teacher', 'posts work']} note="No model involved: fixed rules a teacher can read and check." />
          <div className="mt-[3.5rem] grid gap-[3rem] lg:grid-cols-12">
            <ol className="border-b border-[var(--border)] lg:col-span-6">
              {AUTOMATION.map((a, i) => (
                <Rise as="li" key={a} delay={i * 80} y={20} className="grid grid-cols-[3rem_1fr] gap-[1rem] border-t border-[var(--border)] py-[1.5rem]">
                  <span className="mk-figure text-[1.5rem] text-[var(--brand)]">{i + 1}</span>
                  <span className="text-[1rem] leading-relaxed">{a}</span>
                </Rise>
              ))}
            </ol>
            <Rise delay={200} y="2rem" className="lg:col-span-6">
              <Shot src="/shots/d-bestday.jpg" alt="Best day for homework: every set and due day with the class on-time likelihood" focus="62% 30%" className="aspect-[4/3] w-full !rounded-[2rem]" />
              <p className="mt-[1rem] text-[0.8125rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">Best day for homework · Grade 11 English · synthetic class</p>
            </Rise>
          </div>
        </section>

        {/* tools */}
        <section aria-labelledby="tools" className="px-[1.5rem] py-[6rem] sm:px-[2.5rem]">
          <SectionHead eyebrow="The tools" lines={['What it may', 'touch']} note="Reads ground the plan. Writes only ever change the student’s own planner and records." />
          <div className="mt-[3rem] border-b border-[var(--border)]">
            {TOOLS.map(([t, d, k], i) => (
              <Rise key={t} delay={i * 50} y={12} className="grid items-baseline gap-[0.5rem] border-t border-[var(--border)] py-[1.25rem] md:grid-cols-[18rem_1fr_8rem]">
                <span className="text-[1.0625rem] font-medium">{t}</span>
                <span className="text-[1rem] leading-relaxed text-[var(--text-muted)]">{d}</span>
                <span className="md:text-right"><span className={`inline-block rounded-full px-[0.875rem] py-[0.375rem] text-[0.6875rem] font-medium uppercase tracking-[0.14em] ${k.includes('Write') ? 'bg-[var(--deep)] text-white' : 'bg-[var(--surface)]'}`}>{k}</span></span>
              </Rise>
            ))}
          </div>
        </section>

        {/* guardrails */}
        <section id="guards" aria-labelledby="guards-title" className="mk-band relative isolate overflow-hidden bg-[var(--deep)] px-[1.5rem] py-[6rem] text-white sm:px-[2.5rem]">
          <SectionHead tone="dark" eyebrow="Safe by design" lines={['Six', 'guardrails']} note="In the code, not in a policy document." />
          <div className="mt-[3.5rem] grid gap-[1.25rem] md:grid-cols-2 lg:grid-cols-3">
            {GUARDRAILS.map(([t, d], i) => (
              <Rise key={t} delay={(i % 3) * 90} y={24} config={spring(180, 26)}>
                <Panel tone="glass" className="h-full !p-[1.75rem]">
                  <span className="grid size-[2.5rem] place-items-center rounded-full bg-white text-[0.8125rem] font-medium text-[var(--deep)]">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-[1.25rem] text-[1.5rem] font-medium tracking-[-0.02em]">{t}</h3>
                  <p className="mt-[0.75rem] text-[0.9375rem] leading-relaxed text-white/65">{d}</p>
                </Panel>
              </Rise>
            ))}
          </div>
        </section>

        {/* routing */}
        <section aria-labelledby="routing" className="px-[1.5rem] py-[6rem] sm:px-[2.5rem]">
          <SectionHead eyebrow="Models" lines={['Routing and', 'its budget']} />
          <div className="mt-[3.5rem] grid gap-[1.25rem] md:grid-cols-2">
            {ROUTING.map(([t, d], i) => (
              <Rise key={t} delay={(i % 2) * 90} y={20}>
                <Panel className="h-full !p-[1.75rem]">
                  <h3 className="text-[1.25rem] font-medium tracking-[-0.01em]">{t}</h3>
                  <p className="mt-[0.75rem] text-[1rem] leading-relaxed text-[var(--text-muted)]">{d}</p>
                </Panel>
              </Rise>
            ))}
          </div>
          <p className="mt-[3rem] text-[0.8125rem] uppercase tracking-[0.1em] text-[var(--text-muted)]">Demo build: all students and teachers are fictional. Microsoft 365 sign-in is simulated. Proposed Grade 11 pilot at a Dubai secondary school; the school in the demo is fictional.</p>
        </section>
      </main>
      <Footer />
    </MarketingShell>
  );
}
