'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Building2, CalendarClock, Camera, CheckCircle2, ChevronRight, ClipboardList, FileText, Home, MessageCircle, Paperclip, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { MicrosoftMark } from '@/components/shell/icons';
import { Bento, Empty, Page, PageHeader } from '@/components/shared/page';
import { LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { getSchool, getStream, type Announcement, type Reminder } from '@/lib/school-api';
import { ClassStream, Reminders } from '@/components/school/stream';
import { SchoolTabs } from '@/components/life/school-tabs';
import { Workings } from '@/components/shared/workings';
import { subjectName } from '@/lib/subjects';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
const shortDate = (d: string, locale: 'en' | 'ar' = 'en') => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });


export default function SchoolPage() {
  const { client, tx, prefs, locale } = useApp();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<{ announcements: Announcement[]; reminders: Reminder[] }>({ announcements: [], reminders: [] });
  const [showAll, setShowAll] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = () => { setError(null); setAttempt((n) => n + 1); };
  useEffect(() => {
    let live = true;
    getSchool(client.devUser).then((d) => {
      if (!live) return;
      setData(d); setError(null);
      if (d.licence?.type === 'institution') getStream(client.devUser).then((x) => { if (live) setStream(x); }).catch(() => {});
    }).catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [client.devUser, attempt]);

  if (error && !data) return (
    <Page><PageHeader title={tx('School', 'المدرسة')} />
      <Empty action={<Button variant="secondary" onClick={retry}>{tx('Try again', 'حاول مجدداً')}</Button>}>
        {/not set up|onboard|no student/i.test(error) ? tx('Finish setting up Murshid to see your school.', 'أكمل إعداد مرشد لعرض مدرستك.') : tx('Could not reach Murshid. Check your connection and try again.', 'تعذّر الاتصال بمرشد. تحقّق من اتصالك وحاول مجدداً.')}
      </Empty>
    </Page>
  );
  if (!data) return <Page><PageHeader title={tx('School', 'المدرسة')} /><LoadingState label={tx('Loading your school…', 'جارٍ تحميل مدرستك…')} rows={4} /></Page>;

  const lic = data.licence;
  if (lic.type === 'family') {
    return (
      <Page>
        <PageHeader eyebrow={tx('Your plan', 'خطتك')} title={`Murshid ${data.family.plan}`} subtitle={data.family.boughtBy === 'parent' ? tx(`Set up by ${data.family.parent?.name ?? 'your parent'} for you.`, 'أعدّها لك أحد الوالدين.') : tx('You set this up for yourself.', 'أنت من أعدّ هذه الخطة.')} />
        <Bento>
          <Card className="col-span-12 lg:col-span-7">
            <CardHeader title={tx('Family plan', 'خطة عائلية')} icon={<Home />} />
            <p className="text-sm">{tx('Your Murshid account belongs to your family, not a school. Your plan, tasks and progress stay private to you and your parent.', 'حسابك يتبع عائلتك وليس مدرسة.')}</p>
          </Card>
          <Card className="col-span-12 lg:col-span-5">
            <CardHeader title={tx('Does your school use Murshid?', 'هل تستخدم مدرستك مرشد؟')} icon={<Building2 />} />
            <Muted>{tx('If your school licenses Murshid, your teachers can post work straight into your plan.', 'إذا رخّصت مدرستك مرشد، يمكن لمعلميك إرسال الواجبات مباشرة إلى خطتك.')}</Muted>
            <Link href="/welcome" className="tap-row mt-3 text-sm font-medium text-primary">{tx('Link my school', 'ربط مدرستي')}</Link>
          </Card>
        </Bento>
      </Page>
    );
  }

  const sc = data.school;
  const wr = sc.weeklyReport;
  const formLabel: Record<string, string> = { form: tx('Murshid form', 'نموذج مرشد'), google_form: 'Google Form', microsoft_form: 'Microsoft Form' };
  return (
    <Page wide>
      <PageHeader eyebrow={lic.parentOrgName ?? tx('Your school', 'مدرستك')} title={lic.orgName}
        subtitle={tx('Demo school tenant for the proposed Grade 11 pilot. Work your teachers set lands here and in your plan automatically.', 'مدرسة تجريبية للمشروع التجريبي المقترح للصف 11. الواجبات التي يحددها معلموك تصل هنا وإلى خطتك تلقائيًا.')}
        actions={<span className="inline-flex h-9 items-center gap-2 rounded-full bg-surface px-4 text-xs font-medium">{lic.connectedVia === 'microsoft365' ? <><MicrosoftMark className="size-3.5" />{tx('Demo: simulated Microsoft 365 sign-in', 'تجريبي: تسجيل دخول Microsoft 365 محاكى')}</> : <><CheckCircle2 className="size-3.5 text-success" />{tx('School licence', 'ترخيص مدرسي')}</>}</span>} />
      <SchoolTabs />
      <Reminders items={stream.reminders} onDismiss={(id) => setStream((x) => ({ ...x, reminders: x.reminders.filter((r) => r.id !== id) }))} />
      <Bento>
        <Card className="col-span-12 xl:col-span-7">
          <CardHeader title={tx('From your teachers', 'من معلميك')} icon={<ClipboardList />} action={<Badge tone="outline">{sc.assignments.length}</Badge>} />
          {!sc.assignments.length && <Muted>{tx('Nothing from your teachers yet. New work lands here and in your plan.', 'لا شيء من معلميك بعد. تصل الواجبات الجديدة هنا وإلى خطتك.')}</Muted>}
          <ul className="flex flex-col divide-y divide-border">
            {(showAll ? sc.assignments : sc.assignments.slice(0, 8)).map((a: any) => {
              const h = a.handIn;
              const label = a.status === 'marked' ? tx(`Marked${h?.grade !== null && h?.grade !== undefined ? ` · ${h.grade}%` : ''}`, `مُصحّح${h?.grade !== null && h?.grade !== undefined ? ` · ${h.grade}%` : ''}`)
                : a.status === 'returned' ? tx('Returned', 'أُعيد') : a.status === 'missing' ? tx('Overdue', 'متأخر') : a.status === 'submitted' ? tx('Handed in', 'سُلّم') : tx(`Due ${shortDate(a.dueDate)}`, `التسليم ${shortDate(a.dueDate, 'ar')}`);
              const tone = a.status === 'missing' ? 'text-danger font-medium' : a.status === 'returned' ? 'text-warning font-medium' : a.status === 'submitted' || a.status === 'marked' ? 'text-success font-medium' : 'text-muted-foreground';
              return (
                <motion.li key={a.id} layout className={cn('relative flex flex-wrap items-start gap-x-3 py-3', a.posted && a.status === 'pending' && 'rounded-xl bg-[color-mix(in_oklab,var(--success)_7%,transparent)] px-2.5')}>
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.status === 'missing' ? 'bg-danger' : a.status === 'returned' ? 'bg-warning' : a.status === 'submitted' || a.status === 'marked' ? 'bg-success' : 'bg-[var(--text-muted)]')} />
                  <span className="min-w-0 flex-1">
                    <Link href={`/app/school/assignments/${encodeURIComponent(a.id)}`} className="block text-sm font-medium after:absolute after:inset-0 hover:underline">
                      {a.title}{a.posted && a.status === 'pending' && <Badge className="ms-2" tone="success">{tx('New', 'جديد')}</Badge>}{formLabel[a.format] && <Badge className="ms-2" tone="outline">{formLabel[a.format]}</Badge>}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{subjectName(a.subject, locale)} &middot; <bdi>{a.teacher}</bdi></span>
                    {(a.attachments > 0 || a.photosRequired || a.unread > 0 || (a.status === 'returned' && h?.feedback)) && (
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {a.attachments > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="size-3.5" />{a.attachments}</span>}
                        {a.photosRequired && <span className="inline-flex items-center gap-1"><Camera className="size-3.5" />{tx('Photos of notes', 'صور الملاحظات')}</span>}
                        {a.unread > 0 && <span className="inline-flex items-center gap-1 font-medium text-primary"><MessageCircle className="size-3.5" />{tx(`${a.unread === 1 ? '1 new message' : `${a.unread} new messages`} from ${a.teacher}`, `${a.unread === 1 ? 'رسالة جديدة' : a.unread === 2 ? 'رسالتان جديدتان' : a.unread <= 10 ? `${a.unread} رسائل جديدة` : `${a.unread} رسالة جديدة`} من ${a.teacher}`)}</span>}
                        {a.status === 'returned' && h?.feedback && <span className="line-clamp-1 text-warning">“{h.feedback}”</span>}
                      </span>
                    )}
                    {a.posted && a.trace && a.status === 'pending' && <span className="mt-1 block text-xs text-muted-foreground">{tx('Murshid added a work session and a reminder to your plan.', 'أضاف مرشد جلسة عمل وتذكيراً إلى خطتك.')}</span>}
                  </span>
                  <span className={cn('flex shrink-0 items-center gap-1 text-xs', tone)}>{label}<ChevronRight className="size-3.5 text-muted-foreground rtl:rotate-180" /></span>
                  {prefs.showWorkings && a.trace && <span className="relative z-10 block basis-full ps-5"><Workings trace={a.trace} className="mt-2" /></span>}
                </motion.li>
              );
            })}
          </ul>
          {sc.assignments.length > 8 && <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 min-h-10 text-sm font-medium text-primary">{showAll ? tx('Show fewer', 'عرض أقل') : tx(`Show all ${sc.assignments.length}`, `عرض الكل (${sc.assignments.length})`)}</button>}
        </Card>
        <Card className="col-span-12 xl:col-span-5">
          <CardHeader title={tx('Your weekly report', 'تقريرك الأسبوعي')} icon={<FileText />} action={<Badge tone={wr.status === 'submitted' ? 'success' : 'outline'}>{wr.status === 'submitted' ? tx('Sent', 'أُرسل') : tx('Sends Fri 4 PM', 'يُرسل الجمعة 4 م')}</Badge>} />
          <p className="text-sm leading-relaxed">{locale === 'ar' && wr.summaryAr ? wr.summaryAr : wr.summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[[tx('Handed in', 'سُلّم'), `${wr.completion}%`], [tx('Still to do', 'متبقٍ'), wr.remaining.length], [tx('Tests', 'اختبارات'), wr.upcomingTests.length]].map(([l, v]) => (
              <div key={l as string} className="rounded-md bg-surface-2 p-2.5"><div className="text-lg font-semibold tabular-nums">{v as string}</div><div className="text-2xs text-muted-foreground">{l as string}</div></div>
            ))}
          </div>
          <Muted className="mt-3 text-xs">{tx('Your teachers see this summary of your progress and what is left. It sends itself every Friday.', 'يرى معلموك هذا الملخص كل جمعة.')}</Muted>
        </Card>
        <ClassStream items={stream.announcements} onReply={(id, r) => setStream((x) => ({ ...x, announcements: x.announcements.map((a) => (a.id === id ? { ...a, replies: [...a.replies, r] } : a)) }))} />
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader title={tx('Coming up', 'قريبًا')} icon={<CalendarClock />} />
          <ul className="flex flex-col gap-2 text-sm">
            {wr.upcomingTests.map((t: any) => <li key={t.title + t.date} className="flex justify-between gap-3"><span>{t.title}</span><span className="shrink-0 text-xs text-muted-foreground">{shortDate(t.date, locale)}</span></li>)}
            {!wr.upcomingTests.length && <Muted>{tx('No tests this week.', 'لا اختبارات هذا الأسبوع.')}</Muted>}
          </ul>
          <Link href="/app/chat?q=Plan%20my%20week%20around%20my%20tests%20and%20training" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Sparkles className="size-4" />{tx('Plan my week around these', 'خطط أسبوعي حولها')}</Link>
        </Card>
        <Card className="col-span-12">
          <CardHeader title={tx('Your classes', 'صفوفك')} icon={<Building2 />} />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {sc.classes.map((c: any) => (
              <li key={c.id} className="rounded-md border border-border px-3 py-2"><span className="block text-sm font-medium">{c.subjectName}</span><span className="block truncate text-xs text-muted-foreground">{c.teacher.name}{c.teamsClassId ? ' \u00b7 Teams' : ''}</span></li>
            ))}
          </ul>
        </Card>
      </Bento>
    </Page>
  );
}
