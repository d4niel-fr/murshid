'use client';

import Link from 'next/link';
import { Check, GraduationCap, Presentation } from 'lucide-react';
import { useState } from 'react';
import { SURVEYS, type SurveyQuestion, type SurveyVersion } from '@murshid/survey';
import { MurshidMark } from '@/components/shell/icons';
import { API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';

type Answer = string | string[] | number;

function Question({ q, n, value, onChange }: { q: SurveyQuestion; n: number; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const opt = 'rounded-full border px-3.5 py-1.5 text-sm transition-colors';
  const on = 'border-primary bg-brand-soft text-primary';
  const off = 'border-border bg-surface hover:bg-surface-2';
  return (
    <fieldset className="card p-5">
      <legend className="sr-only">{q.text}</legend>
      <p className="font-medium"><span className="me-2 text-muted-foreground">{n}.</span>{q.text}{!q.optional && <span className="text-[var(--danger)]"> *</span>}</p>
      {q.kind === 'scale' && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((k) => (
              <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)} className={cn(opt, 'min-w-11', value === k ? on : off)}>{k}</button>
            ))}
          </div>
          <div className="mt-1.5 flex max-w-[300px] justify-between text-2xs text-muted-foreground"><span>1 = {q.scale![0]}</span><span>5 = {q.scale![1]}</span></div>
        </div>
      )}
      {q.kind === 'single' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {q.options!.map((o) => <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)} className={cn(opt, value === o ? on : off)}>{o}</button>)}
        </div>
      )}
      {q.kind === 'multi' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {q.options!.map((o) => {
            const cur = Array.isArray(value) ? value : [];
            const sel = cur.includes(o);
            return <button key={o} type="button" aria-pressed={sel} onClick={() => onChange(sel ? cur.filter((x) => x !== o) : [...cur, o])} className={cn(opt, 'inline-flex items-center gap-1.5', sel ? on : off)}>{sel && <Check className="size-3.5" />}{o}</button>;
          })}
          <span className="w-full text-2xs text-muted-foreground">Pick all that apply.</span>
        </div>
      )}
      {q.kind === 'text' && (
        <textarea value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} maxLength={500} rows={3}
          placeholder="Please don't include names or contact details." className="mt-3 w-full rounded-[var(--radius-sm)] border border-border bg-surface p-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]" />
      )}
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
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[760px] items-center justify-between px-6 py-5">
        <Link href="/how-it-works" className="flex items-center gap-2.5"><MurshidMark className="size-9" /><span className="text-base font-semibold">Murshid</span></Link>
        <span className="text-xs text-muted-foreground">Anonymous survey</span>
      </header>
      <main className="mx-auto max-w-[760px] px-6 pb-20 pt-2">
        {state === 'done' ? (
          <div className="card mt-6 p-8 text-center">
            <span className="mx-auto inline-flex size-12 items-center justify-center rounded-full tint-success"><Check className="size-6" /></span>
            <h1 className="mt-4 text-2xl font-semibold">Thank you!</h1>
            <p className="mt-2 text-muted-foreground">Your answers help us build something that actually makes the school week easier.</p>
            <Link href="/how-it-works" className="mt-6 inline-block text-sm font-medium text-primary">See how Murshid works →</Link>
          </div>
        ) : !s ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">Help shape Murshid</h1>
            <p className="mt-2 text-muted-foreground">Murshid is a student project for the Dubai Chamber &ldquo;Create AI Agents&rdquo; championship: one plan for every class, assignment, test and activity. We&rsquo;d love 2-3 minutes of your honest answers. No names, no emails.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {([['student', 'I\u2019m a student', GraduationCap], ['teacher', 'I\u2019m a teacher or counsellor', Presentation]] as const).map(([v, label, Icon]) => (
                <button key={v} onClick={() => setVersion(v)} className="card flex items-center gap-3 p-6 text-start hover:ring-2 hover:ring-[var(--accent)]">
                  <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-soft text-primary"><Icon className="size-5" /></span>
                  <span><span className="block font-medium">{label}</span><span className="block text-sm text-muted-foreground">{SURVEYS[v].questions.length} questions</span></span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => { setVersion(null); setAnswers({}); setError(null); }} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{s.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{s.intro}</p>
            <div className="mt-6 flex flex-col gap-4">
              {s.questions.map((q, i) => <Question key={q.id} q={q} n={i + 1} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />)}
            </div>
            <label className="card mt-4 flex cursor-pointer items-start gap-3 p-5 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>I agree that my anonymous answers can be used to research and improve Murshid. I haven&rsquo;t included my name or contact details, and I understand that no personal data is collected (only an optional grade or role). If I&rsquo;m under 18, I&rsquo;m happy to answer, and I can skip any optional question.</span>
            </label>
            {error && <p className="mt-3 text-sm text-[var(--danger)]" role="alert">{error}</p>}
            <button onClick={submit} disabled={state === 'sending'} className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60">
              {state === 'sending' ? 'Sending…' : 'Send my answers'}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
