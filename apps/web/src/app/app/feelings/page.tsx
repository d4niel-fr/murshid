'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Heart, Lock, MessageCircleHeart, Trash2, Users, Wind } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLoad } from '@/components/life/use-load';
import { MoodFace } from '@/components/life/mood-face';
import { Breathing } from '@/components/life/breathing';
import { dayLabel } from '@/components/life/gate';
import { useApp } from '@/components/providers/app-provider';
import { Bento, Empty, Page, PageHeader } from '@/components/shared/page';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { checkIn, deleteCheckIn, getFeelings, MOODS, type Feelings, type Mood } from '@/lib/life-api';
import { cn } from '@/lib/utils';

/** The daily check-in: how I feel, a few words for it, a private note, and whether my teachers see it. */
export default function FeelingsPage() {
  const { tx, locale, band, client, toast } = useApp();
  const load = useLoad(getFeelings);
  const [mood, setMood] = useState<Mood | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [share, setShare] = useState<'teacher' | 'private'>('teacher');
  const [talk, setTalk] = useState(false);
  const [talkTo, setTalkTo] = useState('');
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const young = band === 'g5-6';
  // Home's quick faces open this page with the face already picked
  useEffect(() => { const m = Number(new URLSearchParams(window.location.search).get('mood')); if (m >= 1 && m <= 5) setMood(m as Mood); }, []);
  const d = load.data;
  const label = (id: string) => { const e = d?.emotions.find((x) => x.id === id); return e ? (locale === 'ar' ? e.ar : e.en) : id; };
  const choices = useMemo(() => {
    if (!d || !mood) return [];
    const pool = young ? d.emotions.filter((e) => e.simple) : d.emotions;
    return all ? pool : pool.filter((e) => Math.abs(e.mood - mood) <= (young ? 1 : 0) || e.mood === mood);
  }, [d, mood, all, young]);

  const save = async () => {
    if (!mood) return;
    setBusy(true);
    try {
      const saved = await checkIn(client.devUser, { mood, words, note: note.trim(), share: talk ? 'teacher' : share, talkTo: talk && talkTo ? talkTo : null });
      load.setData((x) => (x ? { ...x, today: saved, history: [saved, ...x.history.filter((h) => h.id !== saved.id)] } : x));
      setEditing(false);
      toast({ tone: 'success', title: talk && talkTo ? tx('Saved. Your teacher will find a moment to talk.', 'تم الحفظ. سيجد معلمك وقتاً للحديث معك.') : tx('Checked in. Thank you for sharing.', 'تم تسجيل شعورك. شكراً لمشاركتك.') });
    } catch (e) { toast({ tone: 'danger', title: (e as Error).message }); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm(tx('Delete this check-in?', 'حذف هذا التسجيل؟'))) return;
    try { await deleteCheckIn(client.devUser, id); load.setData((x) => (x ? { ...x, history: x.history.filter((h) => h.id !== id), today: x.today?.id === id ? null : x.today } : x)); }
    catch (e) { toast({ tone: 'danger', title: (e as Error).message }); }
  };
  const startEdit = (f: Feelings) => {
    const t = f.today!;
    setMood(t.mood); setWords(t.words); setNote(t.note); setShare(t.share); setTalk(Boolean(t.talkTo)); setTalkTo(t.talkTo ?? ''); setEditing(true);
  };

  if (load.error && !d) return <Page><PageHeader title={tx('Check-in', 'كيف حالك؟')} /><ErrorState detail={load.error} onRetry={load.reload} /></Page>;
  if (load.noSchool) return (
    <Page><PageHeader eyebrow={tx('Wellbeing', 'العافية')} title={tx('Check-in', 'كيف حالك؟')} />
      <Empty>{tx('Daily check-ins come with a school account, so your teachers can look out for you. The breathing exercise works for everyone:', 'تأتي التسجيلات اليومية مع حساب المدرسة. تمرين التنفّس متاح للجميع:')}</Empty>
      <Card className="mt-4"><Breathing /></Card>
    </Page>
  );
  if (!d) return <Page><PageHeader title={tx('Check-in', 'كيف حالك؟')} /><LoadingState rows={4} /></Page>;

  const done = d.today && !editing;
  const low = (d.today?.mood ?? mood ?? 5) <= 2;
  return (
    <Page wide>
      <PageHeader eyebrow={tx('Wellbeing', 'العافية')} title={tx('How are you feeling?', 'كيف تشعر اليوم؟')}
        subtitle={tx('Twenty seconds a day. Your teachers see the check-ins you share, never the ones you keep to yourself.', 'عشرون ثانية في اليوم. يرى معلموك ما تشاركه فقط، ولا يرون ما تحتفظ به لنفسك.')} />
      <Bento>
        <Card className="col-span-12 lg:col-span-7">
          {d.prompt && <p className="mb-5 rounded-[18px] bg-surface px-4 py-3 text-sm"><span className="block text-xs text-muted-foreground">{tx(`${d.prompt.by} asks`, `يسأل ${d.prompt.by}`)}</span><span dir="auto" className="font-medium">{d.prompt.question}</span></p>}
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-start gap-4">
                <div className="flex items-center gap-4">
                  <span style={{ color: MOODS[d.today!.mood - 1]!.tone }}><MoodFace mood={d.today!.mood} filled className="size-16" /></span>
                  <div>
                    <p className="text-lg font-medium">{tx('You checked in today', 'سجّلت شعورك اليوم')}</p>
                    <p className="text-sm text-muted-foreground">{d.today!.words.map(label).join(' · ') || (locale === 'ar' ? MOODS[d.today!.mood - 1]!.ar : MOODS[d.today!.mood - 1]!.en)}</p>
                  </div>
                </div>
                <p className="text-sm">{d.today!.mood <= 2 ? tx('Thank you for being honest. Hard days happen to everyone, and they pass. Try the breathing below, and talk to someone you trust.', 'شكراً لصراحتك. الأيام الصعبة تمرّ على الجميع وتنتهي. جرّب تمرين التنفّس وتحدّث مع شخص تثق به.') : d.today!.mood === 3 ? tx('An ordinary day is fine. A short walk or a glass of water can help if you feel flat.', 'اليوم العادي لا بأس به. المشي القصير أو كوب ماء قد يساعدان.') : tx('Good to hear. Notice what made today good: it is worth doing again.', 'يسعدنا ذلك. لاحظ ما جعل يومك جيداً لتكرره.')}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge tone="outline">{d.today!.share === 'teacher' ? <><Users className="size-3" />{tx('Shared with your teachers', 'مُشارك مع معلميك')}</> : <><Lock className="size-3" />{tx('Only you', 'لك وحدك')}</>}</Badge>
                  {d.today!.talkTo && <Badge tone="outline"><MessageCircleHeart className="size-3" />{tx(`Asked ${d.teachers.find((t) => t.id === d.today!.talkTo)?.name ?? 'a teacher'} to talk`, `طلبت الحديث مع ${d.teachers.find((t) => t.id === d.today!.talkTo)?.name ?? 'معلم'}`)}</Badge>}
                </div>
                <Button variant="secondary" size="sm" onClick={() => startEdit(d)}>{tx('Change today’s check-in', 'تعديل تسجيل اليوم')}</Button>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <fieldset>
                  <legend className="mb-3 text-sm font-medium">{tx('Pick the face that fits', 'اختر الوجه المناسب')}</legend>
                  <div role="radiogroup" className="grid grid-cols-5 gap-1.5 sm:gap-3">
                    {MOODS.map((m) => (
                      <button key={m.mood} type="button" role="radio" aria-checked={mood === m.mood} onClick={() => { setMood(m.mood); setWords((w) => w.filter((id) => Math.abs((d.emotions.find((e) => e.id === id)?.mood ?? m.mood) - m.mood) <= 1)); }}
                        className={cn('flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[20px] border px-1 py-3 text-[0.75rem] font-medium transition-[background-color,border-color,transform] active:scale-[0.97]', mood === m.mood ? 'border-transparent bg-surface' : 'border-border hover:bg-surface')}
                        style={{ color: mood === m.mood ? m.tone : undefined }}>
                        <MoodFace mood={m.mood} filled={mood === m.mood} className="size-10 sm:size-12" />
                        <span className={cn(mood === m.mood ? '' : 'text-muted-foreground')}>{locale === 'ar' ? m.ar : m.en}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                {mood && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                    <fieldset className="mt-6">
                      <legend className="mb-3 flex w-full items-center justify-between text-sm font-medium">{tx('Which words fit? (up to 3)', 'ما الكلمات المناسبة؟ (حتى 3)')}
                        <button type="button" onClick={() => setAll((v) => !v)} className="text-xs font-normal text-primary">{all ? tx('Fewer words', 'كلمات أقل') : tx('More words', 'كلمات أكثر')}</button>
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {choices.map((e) => {
                          const on = words.includes(e.id);
                          return <button key={e.id} type="button" aria-pressed={on} disabled={!on && words.length >= 3} onClick={() => setWords((w) => (on ? w.filter((x) => x !== e.id) : [...w, e.id]))}
                            className={cn('h-10 rounded-full px-4 text-sm transition-colors disabled:opacity-40', on ? 'bg-[var(--deep)] text-white' : 'bg-surface hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_8%)]')}>{locale === 'ar' ? e.ar : e.en}</button>;
                        })}
                      </div>
                    </fieldset>
                    <label className="mt-6 block text-sm font-medium" htmlFor="feel-note">{tx('Anything you want to add?', 'هل تريد إضافة شيء؟')} <span className="font-normal text-muted-foreground">{tx('(optional)', '(اختياري)')}</span></label>
                    <textarea id="feel-note" dir="auto" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('What happened, or what would help…', 'ماذا حدث، أو ما الذي قد يساعد…')}
                      className="mt-2 w-full resize-y rounded-[18px] border border-border bg-transparent px-4 py-3 text-[0.9375rem] outline-none focus:border-[var(--brand-light)]" />
                    <div className="mt-5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tx('Who sees this', 'من يرى هذا')}>
                      {([['teacher', Users, tx('Share with my teachers', 'شارك مع معلميّ'), tx('They see the face, words and note', 'يرون الوجه والكلمات والملاحظة')], ['private', Lock, tx('Just for me', 'لي وحدي'), tx('Only counted, never shown', 'يُحتسب فقط ولا يظهر')]] as const).map(([v, I, t, s]) => (
                        <button key={v} type="button" role="radio" aria-checked={(talk ? 'teacher' : share) === v} disabled={talk && v === 'private'} onClick={() => setShare(v)}
                          className={cn('flex items-start gap-3 rounded-[18px] border px-4 py-3 text-start transition-colors disabled:opacity-40', (talk ? 'teacher' : share) === v ? 'border-[var(--deep)] bg-surface' : 'border-border hover:bg-surface')}>
                          <I className="mt-0.5 size-4 shrink-0" /><span><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted-foreground">{s}</span></span>
                        </button>
                      ))}
                    </div>
                    {d.teachers.length > 0 && (
                      <div className="mt-4 rounded-[18px] bg-surface px-4 py-3">
                        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
                          <input type="checkbox" checked={talk} onChange={(e) => { setTalk(e.target.checked); if (e.target.checked && !talkTo) setTalkTo(d.teachers[0]!.id); }} className="size-4 accent-[var(--deep)]" />
                          <span className="font-medium">{tx('I’d like to talk to a teacher', 'أودّ الحديث مع معلم')}</span>
                        </label>
                        {talk && (
                          <select aria-label={tx('Which teacher', 'أي معلم')} value={talkTo} onChange={(e) => setTalkTo(e.target.value)} className="mt-2 h-10 w-full rounded-full border border-border bg-[var(--bg)] px-4 text-sm">
                            {d.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Button onClick={() => void save()} disabled={busy}>{busy ? tx('Saving…', 'جارٍ الحفظ…') : tx('Check in', 'سجّل شعوري')}</Button>
                      {editing && <Button variant="ghost" onClick={() => setEditing(false)}>{tx('Cancel', 'إلغاء')}</Button>}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <div className="col-span-12 grid content-start gap-4 lg:col-span-5">
          <Card>
            <CardHeader title={tx('One minute to calm down', 'دقيقة للهدوء')} icon={<Wind />} />
            <Breathing />
            {low && <Muted className="mt-3 text-xs">{tx('If you ever feel unsafe, tell a trusted adult or your school counsellor straight away. In an emergency in the UAE call 999.', 'إذا شعرت يوماً بعدم الأمان فأخبر شخصاً بالغاً تثق به أو مرشد المدرسة فوراً. في حالات الطوارئ في الإمارات اتصل بـ 999.')}</Muted>}
          </Card>
          <Card>
            <CardHeader title={tx('Your last six weeks', 'آخر ستة أسابيع')} icon={<Heart />} action={d.streak > 1 ? <Badge tone="outline">{tx(`${d.streak} days in a row`, `${d.streak} أيام متتالية`)}</Badge> : undefined} />
            <div className="flex h-28 items-end gap-2" role="img" aria-label={tx('Average mood by week', 'متوسط الشعور أسبوعياً')}>
              {d.weeks.map((w) => (
                <div key={w.from} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-[6px] bg-[var(--brand)] transition-[height] duration-500" title={w.average ? `${w.average}/5` : tx('No check-ins', 'لا تسجيلات')} style={{ height: `${w.average ? (w.average / 5) * 100 : 4}%`, opacity: w.average ? 0.35 + (w.average / 5) * 0.65 : 0.15 }} />
                  </div>
                  <span className="text-[0.6875rem] tabular-nums text-muted-foreground">{dayLabel(w.from, locale, { day: 'numeric', month: 'short' })}</span>
                </div>
              ))}
            </div>
            {d.words.length > 0 && (
              <>
                <p className="mb-2 mt-5 text-xs text-muted-foreground">{tx('Words you used most this month', 'أكثر الكلمات هذا الشهر')}</p>
                <div className="flex flex-wrap gap-1.5">{d.words.map((w) => <Badge key={w.id} tone="outline">{label(w.id)} · {w.n}</Badge>)}</div>
              </>
            )}
          </Card>
        </div>

        <Card className="col-span-12">
          <CardHeader title={tx('Your check-ins', 'تسجيلاتك')} />
          {!d.history.length ? <Muted>{tx('Your check-ins will show here.', 'ستظهر تسجيلاتك هنا.')}</Muted> : (
            <ul className="divide-y divide-border">
              {d.history.slice(0, 20).map((h) => (
                <li key={h.id} className="flex items-start gap-3 py-3">
                  <span style={{ color: MOODS[h.mood - 1]!.tone }}><MoodFace mood={h.mood} filled className="size-9" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{dayLabel(h.date, locale, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                    <span className="block text-xs text-muted-foreground">{h.words.map(label).join(' · ') || (locale === 'ar' ? MOODS[h.mood - 1]!.ar : MOODS[h.mood - 1]!.en)}</span>
                    {h.note && <span dir="auto" className="mt-1 block text-sm">{h.note}</span>}
                  </span>
                  {h.share === 'private' && <Lock className="mt-1 size-3.5 shrink-0 text-muted-foreground" aria-label={tx('Only you', 'لك وحدك')} />}
                  {!h.demo && <button type="button" onClick={() => void remove(h.id)} aria-label={tx('Delete', 'حذف')} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-[var(--danger)]"><Trash2 className="size-4" /></button>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Bento>
    </Page>
  );
}
