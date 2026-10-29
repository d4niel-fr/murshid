'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Building2, CalendarClock, CheckCircle2, ClipboardList, FileText, Home, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { MicrosoftMark } from '@/components/shell/icons';
import { Bento, Empty, Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { getSchool } from '@/lib/school-api';
import { Workings } from '@/components/shared/workings';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });


export default function SchoolPage() {
  const { client, tx, prefs } = useApp();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getSchool(client.devUser).then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [client.devUser]);

  if (error) return <Page><PageHeader title={tx('School', 'المدرسة')} /><Empty action={<Link className="text-sm font-medium text-primary" href="/welcome">{tx('Set up Murshid', 'إعداد مرشد')}</Link>}>{tx('Connect to the Murshid API to see your school or family plan.', 'اتصل بواجهة مرشد لعرض مدرستك أو خطتك العائلية.')}</Empty></Page>;
  if (!data) return <Page><PageHeader title={tx('School', 'المدرسة')} /><Muted>{tx('Loading…', 'جارٍ التحميل…')}</Muted></Page>;

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
            <Link href="/welcome" className="mt-3 text-sm font-medium text-primary">{tx('Link my school', 'ربط مدرستي')}</Link>
          </Card>
        </Bento>
      </Page>
    );
  }

  const sc = data.school;
  const wr = sc.weeklyReport;
  return (
    <Page wide>
      <PageHeader eyebrow={lic.parentOrgName ?? tx('Your school', 'مدرستك')} title={lic.orgName}
        subtitle={tx('Demo school tenant for the proposed Grade 11 pilot. Work your teachers set lands here and in your plan automatically.', 'مدرسة تجريبية للمشروع التجريبي المقترح للصف 11. الواجبات التي يحددها معلموك تصل هنا وإلى خطتك تلقائيًا.')}
        actions={<span className="inline-flex h-9 items-center gap-2 rounded-full bg-surface px-4 text-xs font-medium">{lic.connectedVia === 'microsoft365' ? <><MicrosoftMark className="size-3.5" />{tx('Demo: simulated Microsoft 365 sign-in', 'تجريبي: تسجيل دخول Microsoft 365 محاكى')}</> : <><CheckCircle2 className="size-3.5 text-success" />{tx('School licence', 'ترخيص مدرسي')}</>}</span>} />
      <Bento>
        <Card className="col-span-12 xl:col-span-7">
          <CardHeader title={tx('From your teachers', 'من معلميك')} icon={<ClipboardList />} action={<Badge tone="outline">{sc.assignments.length}</Badge>} />
          <ul className="flex flex-col divide-y divide-border">
            {sc.assignments.slice(0, 8).map((a: any) => (
              <motion.li key={a.id} layout className={cn('flex items-start gap-3 py-2.5', a.posted && 'rounded-md bg-[color-mix(in_oklab,var(--success)_8%,transparent)] px-2')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.status === 'missing' ? 'bg-danger' : a.posted ? 'bg-success' : 'bg-[var(--text-muted)]')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{a.title}{a.posted && <Badge className="ms-2" tone="success">{tx('New', 'جديد')}</Badge>}</span>
                  <span className="block text-xs text-muted-foreground">{a.subject} &middot; {a.teacher}{a.instructions ? ` \u00b7 ${a.instructions}` : ''}</span>
                  {a.posted && a.trace && <span className="mt-1 block text-xs text-muted-foreground">{tx('Murshid added a work session and a reminder to your plan.', 'أضاف مرشد جلسة عمل وتذكيراً إلى خطتك.')}</span>}
                  {prefs.showWorkings && a.trace && <Workings trace={a.trace} className="mt-2" />}
                </span>
                <span className={cn('shrink-0 text-xs', a.status === 'missing' ? 'font-medium text-danger' : 'text-muted-foreground')}>{a.status === 'missing' ? tx('Overdue', 'متأخر') : a.dueDate === data.today ? tx('Due today', 'مستحق اليوم') : `${tx('Due', 'موعد')} ${a.dueLabel}`}</span>
              </motion.li>
            ))}
          </ul>
        </Card>
        <Card className="col-span-12 xl:col-span-5">
          <CardHeader title={tx('Your weekly report', 'تقريرك الأسبوعي')} icon={<FileText />} action={<Badge tone={wr.status === 'submitted' ? 'success' : 'outline'}>{wr.status === 'submitted' ? tx('Sent', 'أُرسل') : tx('Sends Fri 4 PM', 'يُرسل الجمعة 4 م')}</Badge>} />
          <p className="text-sm leading-relaxed">{wr.summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[[tx('Handed in', 'سُلّم'), `${wr.completion}%`], [tx('Still to do', 'متبقٍ'), wr.remaining.length], [tx('Tests', 'اختبارات'), wr.upcomingTests.length]].map(([l, v]) => (
              <div key={l as string} className="rounded-md bg-surface-2 p-2.5"><div className="text-lg font-semibold tabular-nums">{v as string}</div><div className="text-2xs text-muted-foreground">{l as string}</div></div>
            ))}
          </div>
          <Muted className="mt-3 text-xs">{tx('Your teachers see this summary of your progress and what is left. It sends itself every Friday.', 'يرى معلموك هذا الملخص كل جمعة.')}</Muted>
        </Card>
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader title={tx('Your classes', 'صفوفك')} icon={<Building2 />} />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sc.classes.map((c: any) => (
              <li key={c.id} className="rounded-md border border-border px-3 py-2"><span className="block text-sm font-medium">{c.subjectName}</span><span className="block truncate text-xs text-muted-foreground">{c.teacher.name}{c.teamsClassId ? ' \u00b7 Teams' : ''}</span></li>
            ))}
          </ul>
        </Card>
        <Card className="col-span-12 lg:col-span-5">
          <CardHeader title={tx('Coming up', 'قريبًا')} icon={<CalendarClock />} />
          <ul className="flex flex-col gap-2 text-sm">
            {wr.upcomingTests.map((t: any) => <li key={t.title + t.date} className="flex justify-between gap-3"><span>{t.title}</span><span className="shrink-0 text-xs text-muted-foreground">{shortDate(t.date)}</span></li>)}
            {!wr.upcomingTests.length && <Muted>{tx('No tests this week.', 'لا اختبارات هذا الأسبوع.')}</Muted>}
          </ul>
          <Link href="/chat?q=Plan%20my%20week%20around%20my%20tests%20and%20training" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary"><Sparkles className="size-4" />{tx('Plan my week around these', 'خطط أسبوعي حولها')}</Link>
        </Card>
      </Bento>
    </Page>
  );
}
