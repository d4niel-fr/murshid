'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Building2, CheckCircle2, ChevronRight, GraduationCap, HeartHandshake } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { MicrosoftMark } from '@/components/shell/icons';
import { Footer, MarketingShell, Panel } from '@/components/marketing/chrome';
import { PageHero } from '@/components/marketing/page-hero';
import { Button } from '@/components/ui/button';
import { getMsAccounts, onboard, startMs } from '@/lib/school-api';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Path = 'parent' | 'student' | 'school';

const CHOICES: { id: Path; title: string; sub: string; icon: typeof Building2; badge?: string }[] = [
  { id: 'school', title: 'My school provides Murshid', sub: 'Sign in with your school Microsoft account or a school code. Your teachers\u2019 work comes straight into your plan.', icon: Building2, badge: 'Most students' },
  { id: 'parent', title: 'I\u2019m a parent', sub: 'Buy Murshid for your child and get a weekly summary of how they are doing.', icon: HeartHandshake },
  { id: 'student', title: 'I\u2019m a student', sub: 'Get Murshid for yourself: one plan for classes, sport, tests and goals.', icon: GraduationCap },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-2"><span className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</span>{children}</label>;
}
const inputCls = 'h-12 rounded-[1rem] border border-[var(--border)] bg-white px-4 text-[1rem] text-[var(--text)] outline-none focus:border-[var(--brand-light)]';

export default function WelcomePage() {
  const router = useRouter();
  const { setPrefs } = useApp();
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState<'form' | 'ms' | 'done'>('form');
  const [form, setForm] = useState<Record<string, string>>({ plan: 'family-plus', grade: '10', childGrade: '8' });
  const [accounts, setAccounts] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (fn: () => Promise<void>) => { setError(null); setBusy(true); try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const submitFamily = () => run(async () => {
    const body = path === 'parent'
      ? { path, parentName: form.parentName, email: form.email, childName: form.childName, childGrade: Number(form.childGrade), plan: form.plan }
      : { path, name: form.name, email: form.email, grade: Number(form.grade), plan: form.plan };
    setResult(await onboard(body)); setStep('done');
  });
  const microsoft = () => run(async () => { await startMs(); setAccounts((await getMsAccounts()).items); setStep('ms'); });
  const pickMs = (a: any) => run(async () => {
    const r = await onboard({ path: 'school', via: 'microsoft', code: a.code });
    setPrefs({ persona: r.student.id, band: 'g11-12' });
    router.push('/school');
  });
  const joinCode = () => run(async () => {
    setResult(await onboard({ path: 'school', via: 'join_code', joinCode: form.joinCode, name: form.name, email: form.email, grade: Number(form.grade) })); setStep('done');
  });
  const back = () => { setPath(null); setStep('form'); setError(null); setResult(null); };

  return (
    <MarketingShell>
      <main>
        <PageHero eyebrow="Get started · demo, no payment taken" lines={['Get', 'Murshid']}
          intro="One plan for every class, test, assignment and activity. How are you getting it? Family accounts and school accounts never share data." />
        <section className="px-[1.5rem] py-[5rem] text-[var(--text)] sm:px-[2.5rem]">
        <AnimatePresence mode="wait">
          {!path ? (
            <motion.div key="choose" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {CHOICES.map((c, i) => (
                  <button key={c.id} onClick={() => setPath(c.id)} className={cn('group flex text-start', c.id === 'school' ? 'rounded-[2rem] bg-[var(--deep)] text-white' : 'rounded-[2rem] bg-[var(--surface)]')}
                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 1.25rem), calc(100% - 1.25rem) 100%, 0 100%)' }}>
                    <span className="flex w-full flex-col items-start gap-4 p-8">
                      <span className="flex w-full items-center justify-between">
                        <c.icon className={cn('size-6', c.id === 'school' ? 'text-[var(--brand-light)]' : 'text-[var(--brand)]')} strokeWidth={1.6} />
                        <span className={cn('text-[0.75rem] font-medium uppercase', c.id === 'school' ? 'text-[var(--spark)]' : 'text-[var(--text-muted)]')}>{c.badge ?? `0${i + 1}`}</span>
                      </span>
                      <span className="mk-h2 mt-4 text-[2rem]">{c.title}</span>
                      <span className={cn('text-[1rem] leading-[1.55]', c.id === 'school' ? 'text-white/65' : 'text-[var(--text-muted)]')}>{c.sub}</span>
                      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[0.875rem] font-medium uppercase">Continue <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key={path + step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-[36rem]">
              <button onClick={back} className="mk-link mb-6 inline-flex items-center gap-2 text-[0.875rem] font-medium uppercase"><ArrowLeft className="size-4" />Back</button>
              <Panel className="!rounded-[2rem] !p-[2rem]">
                {error && <div className="mb-4 rounded-[1rem] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-3 py-2 text-sm text-danger">{error}</div>}
                {step === 'done' && result ? (
                  <div className="flex flex-col items-start gap-3">
                    <CheckCircle2 className="size-8 text-success" />
                    <h2 className="mk-h2 text-[2.25rem]">{result.student.name} is set up</h2>
                    <p className="text-sm text-muted-foreground">
                      {result.licence.type === 'family'
                        ? `Family ${result.licence.planName} plan, ${result.licence.boughtBy === 'parent' ? 'paid by a parent' : 'paid by the student'}. Account: ${result.account.email}.`
                        : `Linked to ${result.licence.orgName} under the school licence.`}
                    </p>
                    <p className="text-xs text-muted-foreground">Demo only: no payment was taken.</p>
                    <Link href="/" className="mk-link mt-2 text-[0.875rem] font-medium uppercase">Open Murshid →</Link>
                  </div>
                ) : path === 'school' && step === 'ms' ? (
                  <>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)]"><MicrosoftMark className="size-5" />Microsoft</div>
                    <h2 className="mk-h2 mt-4 text-[2.25rem]">Pick an account</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">to continue to Murshid &middot; Demo Secondary School</p>
                    <ul className="mt-4 divide-y divide-border overflow-hidden rounded-[1.25rem] bg-white">
                      {accounts.map((a) => (
                        <li key={a.id}><button disabled={busy} onClick={() => pickMs(a)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-surface-2 disabled:opacity-60">
                          <span className="grid size-9 place-items-center rounded-full bg-[var(--deep)] text-xs font-medium text-white">{a.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}</span>
                          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{a.name}</span><span className="block truncate text-xs text-muted-foreground">{a.email}</span></span>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </button></li>
                      ))}
                    </ul>
                    <p className="mt-4 text-2xs text-muted-foreground">Simulated Microsoft Entra ID sign-in for the demo.</p>
                  </>
                ) : path === 'school' ? (
                  <>
                    <h2 className="mk-h2 text-[2.25rem]">Your school provides Murshid</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Sign in with the Microsoft account your school gave you (simulated in this demo). Murshid links you to your school and your classes.</p>
                    <button onClick={microsoft} disabled={busy} className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[var(--border)] bg-white text-[15px] font-medium text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:opacity-60">
                      <MicrosoftMark className="size-5" />Demo: simulated Microsoft 365 sign-in
                    </button>
                    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use a school code<span className="h-px flex-1 bg-border" /></div>
                    <div className="grid gap-3">
                      <Field label="School code"><input className={inputCls} placeholder="e.g. DSS-G11" value={form.joinCode ?? ''} onChange={set('joinCode')} /></Field>
                      <div className="grid grid-cols-[1fr_96px] gap-3">
                        <Field label="Your name"><input className={inputCls} value={form.name ?? ''} onChange={set('name')} /></Field>
                        <Field label="Grade"><select className={inputCls} value={form.grade} onChange={set('grade')}>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g}>{g}</option>)}</select></Field>
                      </div>
                      <Field label="School email"><input className={inputCls} type="email" value={form.email ?? ''} onChange={set('email')} /></Field>
                      <Button variant="outline" onClick={joinCode} disabled={busy || !form.joinCode || !form.name || !form.email}>Join my school</Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mk-h2 text-[2.25rem]">{path === 'parent' ? 'Get Murshid for your child' : 'Get Murshid for yourself'}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{path === 'parent' ? 'You own the account; your child gets the app, you get a weekly summary.' : 'Your own account and plan. You can link a school later.'}</p>
                    <div className="mt-5 grid gap-3">
                      {path === 'parent' ? (
                        <>
                          <Field label="Your name"><input className={inputCls} value={form.parentName ?? ''} onChange={set('parentName')} /></Field>
                          <div className="grid grid-cols-[1fr_96px] gap-3">
                            <Field label="Child's name"><input className={inputCls} value={form.childName ?? ''} onChange={set('childName')} /></Field>
                            <Field label="Grade"><select className={inputCls} value={form.childGrade} onChange={set('childGrade')}>{[5, 6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g}>{g}</option>)}</select></Field>
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-[1fr_96px] gap-3">
                          <Field label="Your name"><input className={inputCls} value={form.name ?? ''} onChange={set('name')} /></Field>
                          <Field label="Grade"><select className={inputCls} value={form.grade} onChange={set('grade')}>{[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g}>{g}</option>)}</select></Field>
                        </div>
                      )}
                      <Field label="Email"><input className={inputCls} type="email" value={form.email ?? ''} onChange={set('email')} /></Field>
                      <Field label="Plan"><select className={inputCls} value={form.plan} onChange={set('plan')}><option value="family-plus">Plus &middot; AED 29 a month</option><option value="family-pro">Pro &middot; AED 79 a month</option></select></Field>
                      <Button onClick={submitFamily} disabled={busy || !form.email || !(path === 'parent' ? form.parentName && form.childName : form.name)}>Create account</Button>
                      <p className="text-2xs text-muted-foreground">Demo: no payment is taken.</p>
                    </div>
                  </>
                )}
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
        </section>
      </main>
      <Footer />
    </MarketingShell>
  );
}
