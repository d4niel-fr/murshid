'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { CalendarClock, MessageCircle, Send } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { OpportunityCard, useSaveOpportunity } from '@/components/shared/opportunity-card';
import { Bento, Empty, Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check } from '@/components/ui/check';
import { Select } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Segmented } from '@/components/ui/segmented';
import { diffDays, formatDate } from '@/lib/dates';
import { fadeUp } from '@/lib/motion';
import type { Application, Opportunity } from '@/lib/types';
import { count, nAr } from '@/lib/plural';

type Tab = 'discover' | 'saved' | 'applications';
const KINDS: (Opportunity['kind'] | 'all')[] = ['all', 'hackathon', 'competition', 'olympiad', 'summer', 'internship', 'volunteering', 'scholarship'];
const KIND_L: Record<string, [string, string]> = {
  all: ['All', 'الكل'], hackathon: ['Hackathons', 'هاكاثونات'], competition: ['Competitions', 'مسابقات'], olympiad: ['Olympiads', 'أولمبياد'],
  summer: ['Summer', 'صيفي'], internship: ['Internships', 'تدريب'], volunteering: ['Volunteering', 'تطوع'], scholarship: ['Scholarships', 'منح'],
};

function View() {
  const { world, tx, locale, update, toast, bandConfig } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const canApply = bandConfig.features.applications;
  const [tab, setTab] = useState<Tab>(params.get('tab') === 'applications' && canApply ? 'applications' : 'discover');
  const tabParam = params.get('tab');
  useEffect(() => { setTab(tabParam === 'applications' && canApply ? 'applications' : 'discover'); }, [tabParam, canApply]);
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all');
  const present = KINDS.filter((k) => k === 'all' || world.opportunities.some((o) => o.kind === k));
  const list = world.opportunities.filter((o) => kind === 'all' || o.kind === kind);
  const { saved: isSaved } = useSaveOpportunity();
  const saved = world.opportunities.filter((o) => isSaved(o.id));

  const apply = (o: Opportunity) => {
    if (world.applications.some((a) => a.opportunityId === o.id)) { setTab('applications'); return; }
    const app: Application = {
      id: `ua-${Date.now()}`, opportunityId: o.id, title: o.title, status: 'in-progress', deadline: o.deadline,
      checklist: [
        { id: 'c1', title: tx('Read eligibility', 'قراءة الشروط'), done: false },
        { id: 'c2', title: tx('Draft statement', 'كتابة البيان'), done: false },
        { id: 'c3', title: tx('Ask for a reference', 'طلب توصية'), done: false },
        { id: 'c4', title: tx('Submit', 'الإرسال'), done: false },
      ],
    };
    update((u) => ({ ...u, newApps: [...u.newApps, app], savedOpps: u.savedOpps.includes(o.id) ? u.savedOpps : [...u.savedOpps, o.id] }));
    toast({ title: tx('Application started', 'بدأ الطلب'), description: o.title, action: { label: tx('View', 'عرض'), onClick: () => setTab('applications') } });
  };

  const STATUS: Record<Application['status'], string> = { saved: tx('Saved', 'محفوظ'), 'in-progress': tx('In progress', 'قيد التنفيذ'), submitted: tx('Submitted', 'مُرسل'), accepted: tx('Accepted', 'مقبول') };

  return (
    <Page wide>
      <PageHeader
        eyebrow={tx('Matched to your profile', 'مطابقة لملفك')}
        title={canApply ? tx('Opportunities & applications', 'الفرص والطلبات') : tx('Opportunities', 'الفرص')}
        subtitle={tx('Competitions, olympiads, programmes and volunteering, sorted by fit. All listings here are demo data.', 'مسابقات وأولمبياد وبرامج وتطوع، مرتبة حسب الملاءمة. جميع القوائم هنا بيانات تجريبية.')}
        actions={<Button variant="outline" onClick={() => router.push('/app/chat?q=Find%20opportunities%20for%20me')}><MessageCircle />{tx('Ask Murshid', 'اسأل مرشد')}</Button>}
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={tab} onChange={setTab} ariaLabel="Tabs" options={[
          { value: 'discover', label: tx('Discover', 'اكتشف') },
          { value: 'saved', label: `${tx('Saved', 'المحفوظة')} · ${saved.length}` },
          ...(canApply ? [{ value: 'applications' as const, label: `${tx('Applications', 'الطلبات')} · ${world.applications.length}` }] : []),
        ]} />
        {tab === 'discover' && (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {present.map((k) => (
              <button key={k} onClick={() => setKind(k)} className={k === kind ? 'h-8 shrink-0 rounded-full bg-[var(--deep)] px-3.5 text-xs font-medium text-white' : 'h-8 shrink-0 rounded-full bg-surface px-3.5 text-xs text-muted-foreground hover:text-foreground'}>
                {tx(KIND_L[k]![0], KIND_L[k]![1])}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab !== 'applications' ? (
        <Bento key={`${tab}-${kind}`}>
          {(tab === 'discover' ? list : saved).map((o) => (
            <motion.div key={o.id} variants={fadeUp} className="col-span-12 grid min-w-0 md:col-span-6 xl:col-span-4">
              <OpportunityCard o={o} onApply={canApply ? apply : undefined} />
            </motion.div>
          ))}
          {tab === 'saved' && !saved.length && (
            <div className="col-span-12"><Empty action={<Button size="sm" onClick={() => setTab('discover')}>{tx('Browse opportunities', 'تصفح الفرص')}</Button>}>{tx('Nothing saved yet. Tap the bookmark on any opportunity.', 'لا شيء محفوظ بعد. اضغط على علامة الحفظ في أي فرصة.')}</Empty></div>
          )}
        </Bento>
      ) : (
        <Bento key="apps">
          {world.applications.map((a) => {
            const done = a.checklist.filter((c) => c.done).length;
            const days = diffDays(a.deadline, world.today);
            return (
              <Card key={a.id} className="col-span-12 md:col-span-6 xl:col-span-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug">{a.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{formatDate(a.deadline, locale)} · {days >= 0 ? tx(`${count(days, 'day')} left`, `يتبقى ${nAr(days, 'day')}`) : tx('Closed', 'مغلق')}</p>
                  </div>
                  <Badge tone={a.status === 'submitted' || a.status === 'accepted' ? 'success' : a.status === 'in-progress' ? 'brand' : 'neutral'}>{STATUS[a.status]}</Badge>
                </div>
                <div className="mb-3 flex items-center gap-3"><ProgressBar value={(done / Math.max(1, a.checklist.length)) * 100} /><span className="text-xs tabular text-muted-foreground">{done}/{a.checklist.length}</span></div>
                <ul className="flex flex-col gap-1">
                  {a.checklist.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-1">
                      <Check checked={c.done} label={c.title} onChange={(v) => update((u) => ({ ...u, appChecklist: { ...u.appChecklist, [`${a.id}:${c.id}`]: v } }))} />
                      <span className={c.done ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>{c.title}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
                  <Select aria-label={tx('Status', 'الحالة')} value={a.status} onChange={(e) => { update((u) => ({ ...u, appStatus: { ...u.appStatus, [a.id]: e.target.value as Application['status'] } })); toast({ title: tx('Status updated', 'تم تحديث الحالة') }); }} className="h-9 w-auto">
                    {(Object.keys(STATUS) as Application['status'][]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => router.push(`/app/chat?q=${encodeURIComponent(`Help me with my ${a.title} application`)}`)}><Send />{tx('Get help', 'مساعدة')}</Button>
                </div>
              </Card>
            );
          })}
        </Bento>
      )}
    </Page>
  );
}

export default function OpportunitiesPage() {
  return <Suspense fallback={null}><View /></Suspense>;
}
