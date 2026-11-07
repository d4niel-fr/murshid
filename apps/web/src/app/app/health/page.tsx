'use client';

import { Activity, Apple, Bike, Check, Copy, Dumbbell, Footprints, HeartPulse, Link2, Loader2, Moon, RefreshCw, Shield, Trash2, Trophy, Upload, Waves, X } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dayLabel } from '@/components/life/gate';
import { useApp } from '@/components/providers/app-provider';
import { Ago } from '@/components/shared/ago';
import { Bento, Empty, Page, PageHeader } from '@/components/shared/page';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { DialogContent } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { ApiError } from '@/lib/http';
import { connectHealth, deleteHealth, disconnectHealth, getHealth, importHealth, makeShortcut, syncHealth, type Health, type HealthWorkout, type Provider, type ProviderId } from '@/lib/health-api';
import { readHealthFile } from '@/lib/health-import';
import { cn } from '@/lib/utils';

type MetricKey = 'activeMinutes' | 'steps' | 'sleepMinutes';
const SPORT_ICON: Record<string, typeof Activity> = { running: Footprints, walking: Footprints, cycling: Bike, swimming: Waves, gym: Dumbbell, football: Trophy };
/** Which of the student's activities a workout belongs to (by name). */
const SPORT_MATCH: Record<string, RegExp> = {
  football: /football|soccer|كرة القدم/i, running: /run|athletic|track|cross|جري|ألعاب القوى/i, swimming: /swim|سباحة/i, cycling: /cycl|bike|دراج/i, basketball: /basket|سلة/i,
  gym: /gym|fitness|strength|لياقة/i, racket: /tennis|padel|badminton|squash|تنس/i, yoga: /yoga|يوغا/i, 'martial arts': /karate|taekwondo|judo|martial|box|كاراتيه/i, dance: /danc|رقص/i,
};
const HOWTO: Partial<Record<ProviderId, [string, string]>> = {
  garmin: ['In the Garmin Connect app, open Settings › Connected Apps and link Strava, then connect Strava here. Or export an activity as GPX or TCX from Garmin Connect on the web and upload it.', 'في تطبيق Garmin Connect افتح الإعدادات › التطبيقات المتصلة واربط Strava، ثم اربط Strava هنا. أو صدّر نشاطاً بصيغة GPX أو TCX من موقع Garmin Connect وارفعه.'],
  huawei: ['In Huawei Health, find data sharing in your profile settings and turn on Strava, then connect Strava here. Or share a workout as a GPX file and upload it.', 'في تطبيق Huawei Health ابحث عن مشاركة البيانات في إعدادات ملفك وفعّل Strava، ثم اربط Strava هنا. أو شارك تمريناً كملف GPX وارفعه.'],
  samsung: ['Samsung Health can share workouts to Strava. For daily steps, use Settings › Download personal data, then upload the step_daily_trend CSV file.', 'يمكن لتطبيق Samsung Health مشاركة التمارين مع Strava. وللخطوات اليومية استخدم الإعدادات › تنزيل البيانات الشخصية ثم ارفع ملف step_daily_trend.'],
  polar: ['In Polar Flow, link Strava under Settings › Partners, then connect Strava here. Or export a session as TCX or GPX and upload it.', 'في Polar Flow اربط Strava من الإعدادات › الشركاء، ثم اربط Strava هنا. أو صدّر جلسة بصيغة TCX أو GPX وارفعها.'],
  coros: ['In the COROS app, link Strava under third-party apps, then connect Strava here. Or export a workout as GPX or TCX and upload it.', 'في تطبيق COROS اربط Strava من تطبيقات الطرف الثالث، ثم اربط Strava هنا. أو صدّر تمريناً بصيغة GPX أو TCX وارفعه.'],
  google: ['Google is closing the Google Fit connection for apps. Download your Fit data from takeout.google.com (choose Fit), then upload the daily metrics CSV.', 'تُغلق Google ربط Google Fit بالتطبيقات. نزّل بيانات Fit من takeout.google.com (اختر Fit) ثم ارفع ملف المقاييس اليومية CSV.'],
};
const hm = (m: number | null, ar: boolean) => (m === null ? '–' : ar ? `${Math.floor(m / 60)} س ${m % 60} د` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);

export default function HealthPage() {
  const { tx, locale, client, toast, account, world, user, update } = useApp();
  const [d, setD] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [metric, setMetric] = useState<MetricKey>('activeMinutes');
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [showShortcut, setShowShortcut] = useState(false);
  const fileFor = useRef<ProviderId>('garmin');
  const input = useRef<HTMLInputElement>(null);
  const ar = locale === 'ar';

  const load = useCallback(async () => {
    try { setD(await getHealth(client.devUser)); setError(null); }
    catch (e) { if (e instanceof ApiError && e.code === 'health_private') setBlocked(true); else setError((e as Error).message); }
  }, [client.devUser]);
  useEffect(() => {
    void load();
    // back from Fitbit / Strava / Oura
    const q = new URLSearchParams(window.location.search);
    const ok = q.get('connected'); const err = q.get('error');
    if (ok) toast({ tone: 'success', title: tx(`Connected ${ok[0]!.toUpperCase()}${ok.slice(1)}`, 'تم الربط') });
    if (err) toast({ tone: 'danger', title: err === 'declined' ? tx('Not connected: access was not approved.', 'لم يتم الربط: لم تتم الموافقة.') : err === 'scope' ? tx('Strava needs permission to read your activities. Try again and leave that box ticked.', 'يحتاج Strava إلى إذن قراءة أنشطتك. حاول مجدداً مع ترك الخيار محدداً.') : err === 'expired' ? tx('That took too long. Please try connecting again.', 'استغرق الأمر وقتاً طويلاً. حاول الربط مجدداً.') : tx('Could not connect. Please try again.', 'تعذّر الربط. حاول مجدداً.') });
    if (ok || err) window.history.replaceState(null, '', '/app/health');
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); try { await fn(); await load(); } catch (e) { toast({ tone: 'danger', title: (e as Error).message }); } finally { setBusy(null); } };
  const connect = (p: Provider) => run(p.id, async () => {
    const r = await connectHealth(client.devUser, p.id);
    if (r.url) { window.location.href = r.url; return; }
    toast({ tone: 'success', title: tx(`${p.name} connected (demo data)`, `تم ربط ${p.name} (بيانات تجريبية)`) });
  });
  const upload = (source: ProviderId) => { fileFor.current = source; input.current?.click(); };
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const source = fileFor.current;
    setBusy(`file-${source}`); setProgress(0);
    try {
      let days = 0; let workouts = 0;
      for (const f of Array.from(files).slice(0, 50)) {
        const r = await readHealthFile(f, (x) => setProgress(x));
        const kind = r.kind === 'apple' ? 'apple' : source;
        for (let i = 0; i < Math.max(1, Math.ceil(r.workouts.length / 1000)); i++) {
          const res = await importHealth(client.devUser, kind, i === 0 ? r.days : [], r.workouts.slice(i * 1000, i * 1000 + 1000));
          days += res.days; workouts += res.workouts;
        }
      }
      toast({ tone: 'success', title: tx(`Added ${days ? `${days} days` : ''}${days && workouts ? ' and ' : ''}${workouts ? `${workouts} workout${workouts === 1 ? '' : 's'}` : ''}`, `أُضيفت ${days ? `${days} أيام` : ''}${days && workouts ? ' و' : ''}${workouts ? `${workouts} تمارين` : ''}`), description: tx('Only the totals left your device.', 'خرجت المجاميع فقط من جهازك.') });
      await load();
    } catch (e) { toast({ tone: 'danger', title: (e as Error).message }); } finally { setBusy(null); setProgress(null); if (input.current) input.current.value = ''; }
  };
  const newShortcut = () => run('shortcut', async () => { setShortcut((await makeShortcut(client.devUser)).url); });

  // workouts -> the student's own activities (logged as a session once)
  const acts = world.extracurriculars.activities;
  const logged = useMemo(() => new Set(Object.values(user.sessions).flat().map((s) => s.id)), [user.sessions]);
  const matchOf = (w: HealthWorkout) => acts.find((a) => SPORT_MATCH[w.sport]?.test(`${a.name} ${a.kind}`));
  const logTo = (w: HealthWorkout, actId: string) => {
    const act = acts.find((a) => a.id === actId); if (!act) return;
    update((u) => ({ ...u, sessions: { ...u.sessions, [act.id]: [...(u.sessions[act.id] ?? []), { id: `health-${w.id}`, date: w.date, minutes: w.minutes, note: w.title }] } }));
    toast({ tone: 'success', title: tx(`Logged ${w.minutes} min to ${act.name}`, `سُجّلت ${w.minutes} دقيقة في ${act.name}`) });
  };

  if (blocked || account?.me.role === 'parent') return <Page><PageHeader eyebrow={tx('Health', 'الصحة')} title={tx('Health & fitness', 'الصحة واللياقة')} /><Empty>{tx('Health and activity data stays with your child. They can choose to talk to you about it.', 'تبقى بيانات الصحة والنشاط مع طفلك، ويمكنه أن يختار الحديث معك عنها.')}</Empty></Page>;
  if (error && !d) return <Page><PageHeader title={tx('Health & fitness', 'الصحة واللياقة')} /><ErrorState detail={error} onRetry={() => void load()} /></Page>;
  if (!d) return <Page><PageHeader title={tx('Health & fitness', 'الصحة واللياقة')} /><LoadingState rows={4} /></Page>;

  const anything = d.providers.some((p) => p.connected);
  const goal = metric === 'activeMinutes' ? d.goals.activeMinutes : metric === 'steps' ? d.goals.steps : d.goals.sleepMinutes;
  const values = d.days.map((x) => x[metric]);
  const max = Math.max(goal * 1.25, ...values.map((v) => v ?? 0));
  const fmt = (v: number | null) => (v === null ? '–' : metric === 'sleepMinutes' ? hm(v, ar) : metric === 'steps' ? v.toLocaleString(ar ? 'ar-AE' : 'en-GB') : tx(`${v} min`, `${v} د`));
  const order: ProviderId[] = ['apple', 'fitbit', 'strava', 'garmin', 'huawei', 'samsung', 'google', 'oura', 'polar', 'coros'];
  const providers = [...d.providers].sort((a, b) => Number(b.connected) - Number(a.connected) || order.indexOf(a.id) - order.indexOf(b.id));
  const strava = d.providers.find((p) => p.id === 'strava')!;

  return (
    <Page wide>
      <PageHeader eyebrow={tx('Health', 'الصحة')} title={tx('Health & fitness', 'الصحة واللياقة')}
        subtitle={tx('Steps, active minutes, sleep and workouts from your phone or watch, next to your schoolwork. Only you see them: not teachers, not parents.', 'الخطوات ودقائق النشاط والنوم والتمارين من هاتفك أو ساعتك بجانب دراستك. أنت وحدك تراها: لا المعلمون ولا أولياء الأمور.')} />
      <input ref={input} type="file" multiple accept=".gpx,.tcx,.csv,.txt,.zip,.xml,application/zip,text/csv,application/gpx+xml" className="hidden" onChange={(e) => void onFiles(e.target.files)} />

      <section className="on-deep mb-6 grid grid-cols-2 gap-2.5 rounded-[var(--radius-band)] bg-[var(--deep)] p-3 text-white sm:gap-3 sm:p-5 md:p-6 lg:grid-cols-4">
        {[
          [HeartPulse, tx('Active a day (7-day average)', 'النشاط يومياً (متوسط 7 أيام)'), d.summary.activeMinutes === null ? '–' : tx(`${d.summary.activeMinutes} min`, `${d.summary.activeMinutes} د`), tx(`Aim for ${d.goals.activeMinutes} minutes of moving that gets you breathing harder`, `الهدف ${d.goals.activeMinutes} دقيقة من حركة ترفع أنفاسك`)],
          [Check, tx('Days you hit 60 minutes', 'أيام بلغت فيها 60 دقيقة'), `${d.summary.activeDays}/7`, d.summary.streak > 1 ? tx(`${d.summary.streak} days in a row`, `${d.summary.streak} أيام متتالية`) : tx('This week', 'هذا الأسبوع')],
          [Footprints, tx('Steps a day', 'الخطوات يومياً'), d.summary.steps === null ? '–' : d.summary.steps.toLocaleString(ar ? 'ar-AE' : 'en-GB'), tx('10,000 is a common target', '10,000 هدف شائع')],
          [Moon, tx('Sleep a night', 'النوم ليلاً'), hm(d.summary.sleepMinutes, ar), tx(`${d.goals.sleepMinutes / 60}–${d.goals.sleepUpTo / 60} hours is right at your age`, `${d.goals.sleepMinutes / 60}–${d.goals.sleepUpTo / 60} ساعات مناسبة لعمرك`)],
        ].map(([I, label, value, sub]) => {
          const Icon = I as typeof Activity;
          return (
            <div key={label as string} className="glass min-w-0 rounded-[20px] p-3.5 sm:p-4">
              <p className="eyebrow flex items-start gap-2 text-[0.625rem] sm:text-[0.6875rem]"><Icon className="mt-px size-3.5 shrink-0" />{label as string}</p>
              <p className="figure mt-2 text-[1.5rem] leading-none sm:text-[1.875rem]">{value as string}</p>
              <p className="mt-1.5 text-[0.6875rem] leading-snug text-white/65 sm:text-xs">{sub as string}</p>
            </div>
          );
        })}
      </section>

      <Bento>
        <Card className="col-span-12 lg:col-span-8">
          <CardHeader title={metric === 'activeMinutes' ? tx('Active minutes, last 14 days', 'دقائق النشاط، آخر 14 يوماً') : metric === 'steps' ? tx('Steps, last 14 days', 'الخطوات، آخر 14 يوماً') : tx('Sleep, last 14 nights', 'النوم، آخر 14 ليلة')}
            action={<Segmented size="sm" value={metric} onChange={setMetric} ariaLabel={tx('Measure', 'المقياس')} options={[{ value: 'activeMinutes', label: tx('Active', 'النشاط') }, { value: 'steps', label: tx('Steps', 'الخطوات') }, { value: 'sleepMinutes', label: tx('Sleep', 'النوم') }]} />} />
          {!anything ? <Muted>{tx('Connect an app below (or upload a file) and your days fill in here.', 'اربط تطبيقاً أدناه (أو ارفع ملفاً) وستظهر أيامك هنا.')}</Muted> : (
            <div className="relative">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--text-muted)]/60" style={{ bottom: `calc(${(goal / max) * 100}% * 0.86 + 1.5rem)` }} />
              <div className="flex h-56 gap-1.5 sm:gap-2" role="img" aria-label={d.days.map((x) => `${x.date}: ${fmt(x[metric])}`).join(', ')}>
                {d.days.map((x) => {
                  const v = x[metric]; const met = v !== null && v >= goal;
                  return (
                    <div key={x.date} className="flex flex-1 flex-col items-center gap-1.5" title={`${dayLabel(x.date, locale)}: ${fmt(v)}`}>
                      <div className="flex w-full flex-1 items-end">
                        <div className={cn('w-full rounded-t-[6px] transition-[height] duration-500', v === null ? 'bg-surface-2' : met ? 'bg-[var(--brand)]' : 'bg-[color-mix(in_oklab,var(--brand)_45%,transparent)]')} style={{ height: `${v === null ? 3 : Math.max(3, (v / max) * 100)}%` }} />
                      </div>
                      <span className="text-[0.625rem] tabular-nums text-muted-foreground">{dayLabel(x.date, locale, { day: 'numeric' })}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-[var(--text-muted)]" />{tx(`Goal: ${fmt(goal)}`, `الهدف: ${fmt(goal)}`)}</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--brand)]" />{tx('Goal reached', 'بلغت الهدف')}</span>
              </p>
            </div>
          )}
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <CardHeader title={tx('Why it helps your studies', 'لماذا يساعد دراستك')} />
          <ul className="grid gap-3 text-sm">
            <li className="flex gap-2.5"><HeartPulse className="mt-0.5 size-4 shrink-0 text-primary" />{tx('An hour of activity a day is the WHO advice for 5–17 year olds. It helps focus and memory too.', 'توصي منظمة الصحة العالمية بساعة نشاط يومياً لمن هم بين 5 و17 عاماً، وهي تساعد التركيز والذاكرة أيضاً.')}</li>
            <li className="flex gap-2.5"><Moon className="mt-0.5 size-4 shrink-0 text-primary" />{tx('Sleep is when the day’s learning is stored. A short night before a test costs more than it gains.', 'النوم هو وقت تخزين ما تعلمته. السهر قبل الاختبار يضر أكثر مما ينفع.')}</li>
            <li className="flex gap-2.5"><Trophy className="mt-0.5 size-4 shrink-0 text-primary" />{tx('Log workouts to your activities, and they count in your Activities page.', 'سجّل التمارين في أنشطتك لتُحتسب في صفحة الأنشطة.')}</li>
          </ul>
        </Card>

        <Card className="col-span-12">
          <CardHeader title={tx('Workouts', 'التمارين')} action={d.workouts.length > 0 ? <Badge tone="outline">{d.workouts.length}</Badge> : undefined} />
          {!d.workouts.length ? <Muted>{tx('Workouts from your watch or apps show here, and you can log them to your activities.', 'تظهر هنا التمارين من ساعتك أو تطبيقاتك، ويمكنك تسجيلها في أنشطتك.')}</Muted> : (
            <ul className="divide-y divide-border">
              {d.workouts.slice(0, 20).map((w) => {
                const I = SPORT_ICON[w.sport] ?? Activity; const m = matchOf(w); const done = logged.has(`health-${w.id}`);
                return (
                  <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface"><I className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" dir="auto">{w.title}</span>
                      <span className="block text-xs text-muted-foreground">{dayLabel(w.date, locale)} · {tx(`${w.minutes} min`, `${w.minutes} د`)}{w.distanceKm ? ` · ${w.distanceKm} km` : ''} · {d.providers.find((p) => p.id === w.source)?.name}</span>
                    </span>
                    {/* phones: the action sits on its own line, under the name */}
                    <span className="flex w-full justify-start ps-[3.25rem] sm:w-auto sm:ps-0">
                    {done ? <Badge tone="success"><Check className="size-3" />{tx('Logged', 'مُسجّل')}</Badge>
                      : acts.length > 0 && (m ? <Button size="sm" variant="secondary" className="max-w-full" onClick={() => logTo(w, m.id)}><Link2 className="size-3.5 shrink-0" /><span className="truncate">{tx(`Log to ${m.name}`, `سجّل في ${m.name}`)}</span></Button>
                        : <select aria-label={tx('Log to an activity', 'سجّل في نشاط')} defaultValue="" onChange={(e) => e.target.value && logTo(w, e.target.value)} className="h-9 max-w-full rounded-full border border-border bg-transparent px-3 text-xs"><option value="">{tx('Log to…', 'سجّل في…')}</option>{acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="col-span-12">
          <h2 className="card-title mb-3 mt-2">{tx('Your apps and devices', 'تطبيقاتك وأجهزتك')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {providers.map((p) => (
              <Card key={p.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--deep)] text-white">{p.id === 'apple' ? <Apple className="size-4" /> : <Activity className="size-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.connected ? <>{tx('Connected', 'متصل')}{p.lastSync && <> · {tx('updated', 'حُدّث')} <Ago ts={Date.parse(p.lastSync)} locale={locale} /></>}{p.demo && ` · ${tx('demo data', 'بيانات تجريبية')}`}</>
                        : p.how === 'oauth' ? tx('Sign in to connect', 'سجّل الدخول للربط') : p.how === 'shortcut' ? tx('iPhone Shortcut or Health export', 'اختصار iPhone أو تصدير الصحة') : p.how === 'via-strava' ? tx('Through Strava, or upload a file', 'عبر Strava أو برفع ملف') : tx('Upload a file', 'ارفع ملفاً')}
                    </p>
                  </div>
                  {p.connected && <Check className="size-4 text-success" aria-hidden />}
                </div>
                {p.error && <p className="mt-2 rounded-[12px] tint-danger px-3 py-2 text-xs">{p.error}</p>}
                {HOWTO[p.id] && !p.connected && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{ar ? HOWTO[p.id]![1] : HOWTO[p.id]![0]}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.how === 'oauth' && !p.connected && <Button size="sm" disabled={!p.available || busy === p.id} onClick={() => void connect(p)}>{busy === p.id ? <Loader2 className="size-3.5 animate-spin" /> : null}{p.available ? tx(`Connect ${p.name}`, `اربط ${p.name}`) : tx('Coming soon', 'قريباً')}</Button>}
                  {p.how === 'oauth' && p.connected && !p.demo && <Button size="sm" variant="secondary" disabled={busy === p.id} onClick={() => void run(p.id, () => syncHealth(client.devUser, p.id))}><RefreshCw className={cn('size-3.5', busy === p.id && 'animate-spin')} />{tx('Update now', 'حدّث الآن')}</Button>}
                  {p.how === 'shortcut' && <Button size="sm" onClick={() => setShowShortcut(true)}>{tx('Set up iPhone Shortcut', 'إعداد اختصار iPhone')}</Button>}
                  {p.how === 'via-strava' && !strava.connected && strava.available && <Button size="sm" variant="secondary" onClick={() => void connect(strava)}>{tx('Connect Strava', 'اربط Strava')}</Button>}
                  {p.how !== 'oauth' && <Button size="sm" variant="secondary" disabled={busy === `file-${p.id}`} onClick={() => upload(p.id)}>{busy === `file-${p.id}` ? <><Loader2 className="size-3.5 animate-spin" />{progress !== null ? `${Math.round(progress * 100)}%` : ''}</> : <><Upload className="size-3.5" />{p.id === 'apple' ? tx('Upload Health export', 'ارفع تصدير الصحة') : tx('Upload file', 'ارفع ملفاً')}</>}</Button>}
                  {p.connected && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(tx(`Disconnect ${p.name} and delete what came from it?`, `فصل ${p.name} وحذف بياناته؟`))) void run(`x-${p.id}`, () => disconnectHealth(client.devUser, p.id)); }}><X className="size-3.5" />{tx('Disconnect', 'افصل')}</Button>}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="col-span-12">
          <div className="flex flex-wrap items-start gap-3">
            <Shield className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{tx('Your health data is yours', 'بياناتك الصحية ملكك')}</p>
              <p className="mt-1 text-muted-foreground">{tx('Murshid keeps daily totals and workout summaries, never your routes or heart-rate traces. Files are read on this device. Teachers and parents never see this page. Sign-in tokens are stored encrypted, and disconnecting asks the service to forget Murshid.', 'يحتفظ مرشد بالمجاميع اليومية وملخصات التمارين فقط، لا بمساراتك ولا بنبضات قلبك. تُقرأ الملفات على هذا الجهاز. لا يرى المعلمون ولا أولياء الأمور هذه الصفحة. تُحفظ رموز الدخول مشفّرة، والفصل يطلب من الخدمة نسيان مرشد.')}</p>
            </div>
            {anything && <Button size="sm" variant="ghost" className="text-[var(--danger)]" onClick={() => { if (window.confirm(tx('Delete all your health data and disconnect every app?', 'حذف كل بياناتك الصحية وفصل كل التطبيقات؟'))) void run('all', () => deleteHealth(client.devUser)); }}><Trash2 className="size-3.5" />{tx('Delete all', 'احذف الكل')}</Button>}
          </div>
        </Card>
      </Bento>

      <D.Root open={showShortcut} onOpenChange={(v) => { setShowShortcut(v); if (!v) setShortcut(null); }}>
        <DialogContent title={tx('Apple Health on iPhone', 'Apple Health على iPhone')}>
          <p className="text-sm text-muted-foreground">{tx('Apple only lets apps on the iPhone read Health, so a Shortcut sends your daily numbers to Murshid. It takes two minutes.', 'تسمح Apple للتطبيقات على iPhone فقط بقراءة الصحة، لذا يرسل اختصار أرقامك اليومية إلى مرشد. يستغرق دقيقتين.')}</p>
          <ol className="mt-4 grid list-decimal gap-2.5 ps-5 text-sm">
            <li>{tx('Get your private link below and copy it.', 'احصل على رابطك الخاص أدناه وانسخه.')}</li>
            <li>{tx('In the Shortcuts app, tap + and add “Find Health Samples” (Steps, start date is today), then “Calculate Statistics” (Sum).', 'في تطبيق الاختصارات اضغط + وأضف «البحث عن عينات الصحة» (الخطوات، تاريخ البدء اليوم) ثم «حساب الإحصاءات» (المجموع).')}</li>
            <li>{tx('Do the same for Exercise Minutes if you like.', 'كرّر ذلك لدقائق التمرين إن أردت.')}</li>
            <li>{tx('Add “Get Contents of URL”: paste your link, Method POST, Request Body JSON with steps (and activeMinutes) set to the results.', 'أضف «الحصول على محتويات URL»: الصق رابطك، الطريقة POST، ونص الطلب JSON يحتوي steps (وactiveMinutes) بقيم النتائج.')}</li>
            <li>{tx('In Automation, make it run every evening (Time of Day, 9 PM, Run Immediately).', 'في الأتمتة اجعله يعمل كل مساء (وقت من اليوم، 9 مساءً، تشغيل فوري).')}</li>
          </ol>
          {shortcut ? (
            <div className="mt-4 rounded-[16px] bg-surface p-3">
              <p className="break-all font-mono text-xs" dir="ltr">{shortcut}</p>
              <Button size="sm" className="mt-2" onClick={() => { void navigator.clipboard?.writeText(shortcut); toast({ title: tx('Link copied', 'نُسخ الرابط') }); }}><Copy className="size-3.5" />{tx('Copy link', 'انسخ الرابط')}</Button>
              <p className="mt-2 text-xs text-muted-foreground">{tx('Keep it private: anyone with it can add numbers to your page. Making a new link stops the old one.', 'احتفظ به لنفسك: من يملكه يستطيع إضافة أرقام إلى صفحتك. إنشاء رابط جديد يوقف القديم.')}</p>
            </div>
          ) : <Button className="mt-4" disabled={busy === 'shortcut'} onClick={() => void newShortcut()}>{d.shortcut.set ? tx('Make a new link', 'أنشئ رابطاً جديداً') : tx('Get my private link', 'احصل على رابطي الخاص')}</Button>}
          {d.shortcut.lastUsed && <p className="mt-3 text-xs text-muted-foreground">{tx('Last received', 'آخر استلام')} <Ago ts={Date.parse(d.shortcut.lastUsed)} locale={locale} /></p>}
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{tx('Or upload your full history once: Health app › your picture › Export All Health Data, then upload export.zip here. It is read on this device.', 'أو ارفع سجلك كاملاً مرة واحدة: تطبيق الصحة › صورتك › تصدير كل البيانات الصحية، ثم ارفع export.zip هنا. يُقرأ على هذا الجهاز.')}</p>
        </DialogContent>
      </D.Root>
    </Page>
  );
}
