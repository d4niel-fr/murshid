'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { SURVEYS, type SurveyQuestion, type SurveyVersion } from '@murshid/survey';
import { Footer, MarketingShell, Panel } from '@/components/marketing/chrome';
import { Rise } from '@/components/marketing/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';

type Answer = string | string[] | number;

function Question({ q, n, value, onChange }: { q: SurveyQuestion; n: number; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const opt = 'rounded-full border px-5 py-2.5 text-[0.9375rem] transition-colors';
  const on = 'border-[var(--deep)] bg-[var(--deep)] text-white';
  const off = 'border-[var(--border)] bg-white hover:border-[var(--text)]';
  return (
    <fieldset className="border-t border-[var(--border)] py-8">
      <legend className="sr-only">{q.text}</legend>
      <p className="flex gap-5 text-[1.25rem] font-medium leading-[1.35]"><span className="mk-figure w-10 shrink-0 pt-1 text-[1.5rem] text-[var(--brand)]">{String(n).padStart(2, '0')}</span><span>{q.text}{!q.optional && <span className="text-[var(--danger)]"> *</span>}</span></p>
      <div className="ps-[3.75rem]">
      {q.kind === 'scale' && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((k) => (
              <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={cn(opt, 'min-w-11', value === k ? on : off)}>{k}</button>
            ))}
          </div>
          <div className="mt-3 flex max-w-[20rem] justify-between text-[0.75rem] uppercase text-[var(--text-muted)]"><span>1 = {q.scale![0]}</span><span>5 = {q.scale![1]}</span></div>
        </div>
      )}
      {q.kind === 'single' && (
        <div className="mt-5 flex flex-wrap gap-2">
          {q.options!.map((o) => <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className={cn(opt, value === o ? on : off)}>{o}</button>)}
        </div>
      )}
      {q.kind === 'multi' && (
        <div className="mt-5 flex flex-wrap gap-2">
          {q.options!.map((o) => {
            const cur = Array.isArray(value) ? value : [];
            const sel = cur.includes(o);
            return <button key={o} type="button" aria-pressed={sel} onClick={() => onChange(sel ? cur.filter((x) => x !== o) : [...cur, o])} className={cn(opt, 'inline-flex items-center gap-1.5', sel ? on : off)}>{sel && <Check className="size-3.5" />}{o}</button>;
          })}
          <span className="w-full text-[0.75rem] uppercase text-[var(--text-muted)]">Pick all that apply.</span>
        </div>
      )}
      {q.kind === 'text' && (
        <textarea value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} maxLength={500} rows={3}
          placeholder="Please don't include names or contact details." className="mt-4 w-full rounded-[1rem] border border-[var(--border)] bg-white p-4 text-[1rem] outline-none focus:border-[var(--brand-light)]" />
      )}
      </div>
    </fieldset>
  );
}

export default function SurveyPage() {
  const [version, setVersion] = useState<SurveyVersion | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const s = version ? SURVEYS[version] : null;
  const missing = s ? s.questions.filter((q) => !q.optional && (answers[q.id] === undefined || answers[q.id] === '' || (Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length === 0))) : [];

  const submit = async () => {
    if (!version) return;
    if (missing.length) { setError(`Please answer question ${s!.questions.indexOf(missing[0]!) + 1}.`); return; }
    if (!consent) { setError('Please tick the consent box.'); return; }
    setState('sending'); setError(null);
    try {
      const res = await fetch(`${API_BASE}/survey`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version, answers, consent: true }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `HTTP ${res.status}`);
      setState('done');
    } catch (e) {
      setState('idle'); setError(`Sorry, that didn't send (${(e as Error).message}). Please try again.`);
    }
  };

  return (
    <MarketingShell>
      <main>
        <PageHero eyebrow="Anonymous · 2–3 minutes · no names" lines={state === 'done' ? ['Thank', 'you'] : ['Help shape', 'Murshid']}
          intro={state === 'done' ? 'Your answers help us build something that actually makes the school week easier.' : <>Murshid is a student project for the Dubai Chamber “Create AI Agents” championship: one plan for every class, assignment, test and activity. We’d love a few minutes of honest answers.</>} />
        <section className="px-[1.5rem] py-[5rem] text-[var(--text)] sm:px-[2.5rem]">
          <div className="mx-auto max-w-[52rem]">
            {state === 'done' ? (
              <Rise className="flex flex-wrap items-center justify-between gap-6 border-t border-[var(--border)] pt-10">
                <span className="inline-flex items-center gap-3 text-[1rem] font-medium uppercase"><span className="grid size-10 place-items-center rounded-full bg-[var(--deep)] text-white"><Check className="size-5" /></span>Answers received</span>
                <Link href="/how-it-works" className="mk-link text-[1rem] font-medium uppercase">See how Murshid works →</Link>
              </Rise>
            ) : !s ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {([['student', 'I’m a student'], ['teacher', 'I’m a teacher or counsellor']] as const).map(([v, label], i) => (
                  <Rise key={v} delay={i * 110}>
                    <button onClick={() => setVersion(v)} className="group block w-full text-start">
                      <Panel className="!p-[2rem] transition-colors group-hover:bg-[var(--deep)] group-hover:text-white">
                        <span className="text-[0.75rem] font-medium uppercase text-[var(--brand)]">0{i + 1} · {SURVEYS[v].questions.length} questions</span>
                        <span className="mk-h2 mt-5 block text-[2.25rem]">{label}</span>
                        <span className="mt-6 inline-block text-[0.875rem] font-medium uppercase">Start →</span>
                      </Panel>
                    </button>
                  </Rise>
                ))}
              </div>
            ) : (
              <>
                <button onClick={() => { setVersion(null); setAnswers({}); setError(null); }} className="mk-link text-[0.875rem] font-medium uppercase">← Back</button>
                <h2 className="mk-h2 mt-6 text-[2.75rem]">{s.title}</h2>
                <p className="mt-3 text-[1.0625rem] text-[var(--text-muted)]">{s.intro}</p>
                <div className="mt-10">
                  {s.questions.map((q, i) => <Question key={q.id} q={q} n={i + 1} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />)}
                </div>
                <label className="flex cursor-pointer items-start gap-4 border-y border-[var(--border)] py-8 text-[0.9375rem] leading-[1.6]">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 accent-[var(--deep)]" />
                  <span>I agree that my anonymous answers can be used to research and improve Murshid. I haven&rsquo;t included my name or contact details, and I understand that no personal data is collected (only an optional grade or role). If I&rsquo;m under 18, I&rsquo;m happy to answer, and I can skip any optional question.</span>
                </label>
                {error && <p className="mt-4 text-[0.9375rem] text-[var(--danger)]" role="alert">{error}</p>}
                <button onClick={submit} disabled={state === 'sending'}
                  className="mt-8 h-[3.25rem] w-full rounded-full bg-[var(--text)] text-[0.875rem] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-[var(--deep)] disabled:opacity-60"
                  style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)' }}>
                  {state === 'sending' ? 'Sending…' : 'Send my answers →'}
                </button>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </MarketingShell>
  );
}
