'use client';

import { Dialog as D } from 'radix-ui';
import { motion } from 'motion/react';
import { Award, CalendarClock, MessageCircle, Plus, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Bento, Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Check } from '@/components/ui/check';
import { DialogContent } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { ProgressRing } from '@/components/ui/progress-ring';
import { demoStudents } from '@/lib/bands';
import { addDays, diffDays, formatDate } from '@/lib/dates';
import type { Goal } from '@/lib/types';

const AREA: Record<Goal['area'], { en: string; ar: string; color: string }> = {
  academics: { en: 'Academics', ar: 'الدراسة', color: 'var(--chart-1)' },
  extracurriculars: { en: 'Activities', ar: 'الأنشطة', color: 'var(--chart-2)' },
  wellbeing: { en: 'Wellbeing', ar: 'العافية', color: 'var(--chart-3)' },
  future: { en: 'Future', ar: 'المستقبل', color: 'var(--chart-4)' },
};

function AddGoal() {
  const { update, tx, toast, world } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<Goal['area']>('academics');
  const [due, setDue] = useState(addDays(world.today, 60));
  const [steps, setSteps] = useState('');
  const save = () => {
    if (!title.trim()) return;
    const id = `ug-${Date.now()}`;
    const ms = steps.split('\n').map((x) => x.trim()).filter(Boolean);
    const goal: Goal = { id, title: title.trim(), area, due, progress: 0, milestones: (ms.length ? ms : [tx('First step', 'الخطوة الأولى'), tx('Halfway', 'منتصف الطريق'), tx('Finish', 'الإنهاء')]).map((t, i) => ({ id: `${id}-m${i}`, title: t, done: false })) };
    update((u) => ({ ...u, extraGoals: [...u.extraGoals, goal] }));
    toast({ title: tx('Goal added', 'تمت إضافة الهدف'), description: goal.title });
    setOpen(false); setTitle(''); setSteps('');
  };
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild><Button><Plus />{tx('New goal', 'هدف جديد')}</Button></D.Trigger>
      <DialogContent title={tx('New goal', 'هدف جديد')} description={tx('Small, specific and with a date works best.', 'الأفضل أن يكون صغيراً ومحدداً وبتاريخ.')}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4">
          <div><Label htmlFor="g-title">{tx('Goal', 'الهدف')}</Label><Input id="g-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('e.g. Run 5k under 25 minutes', 'مثلاً: الجري ٥ كم في أقل من ٢٥ دقيقة')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="g-area">{tx('Area', 'المجال')}</Label>
              <Select id="g-area" value={area} onChange={(e) => setArea(e.target.value as Goal['area'])}>{(Object.keys(AREA) as Goal['area'][]).map((a) => <option key={a} value={a}>{tx(AREA[a].en, AREA[a].ar)}</option>)}</Select></div>
            <div><Label htmlFor="g-due">{tx('By', 'بحلول')}</Label><Input id="g-due" type="date" min={world.today} value={due} onChange={(e) => setDue(e.target.value)} /></div>
          </div>
          <div><Label htmlFor="g-steps">{tx('Milestones (one per line, optional)', 'المراحل (سطر لكل مرحلة، اختياري)')}</Label>
            <textarea id="g-steps" value={steps} onChange={(e) => setSteps(e.target.value)} className="min-h-24 w-full rounded-[var(--radius-sm)] border border-border bg-field px-4 py-3 text-sm outline-none focus:border-[var(--accent)]" /></div>
          <div className="flex justify-end gap-2"><D.Close asChild><Button variant="ghost">{tx('Cancel', 'إلغاء')}</Button></D.Close><Button type="submit" disabled={!title.trim()}>{tx('Add goal', 'إضافة')}</Button></div>
        </form>
      </DialogContent>
    </D.Root>
  );
}

export default function GoalsPage() {
  const { world, tx, locale, update, toast, band, bandConfig } = useApp();
  const router = useRouter();
  const badges = demoStudents[band].badges;
  const toggle = (g: Goal, mId: string, done: boolean) => {
    update((u) => ({ ...u, milestones: { ...u.milestones, [mId]: done } }));
    const after = g.milestones.map((m) => (m.id === mId ? done : m.done));
    if (done && after.every(Boolean)) toast({ title: tx('Goal complete! 🎉', 'اكتمل الهدف! 🎉'), description: g.title });
  };
  return (
    <Page wide>
      <PageHeader
        eyebrow={tx(`${world.goals.length} goals`, `${world.goals.length} أهداف`)}
        title={tx('Goals', 'الأهداف')}
        subtitle={tx('Tick milestones as you reach them; progress rings update everywhere.', 'علّم المراحل عند إنجازها؛ تتحدث الحلقات في كل مكان.')}
        actions={<><Button variant="outline" onClick={() => router.push('/insights?area=goals')}>{tx('Chart my goals', 'ارسم أهدافي')}</Button><AddGoal /></>}
      />
      <Bento>
        {world.goals.map((g) => {
          const days = diffDays(g.due, world.today);
          return (
            <Card key={g.id} id={g.id} className="col-span-12 md:col-span-6 xl:col-span-4">
              <div className="flex items-start gap-4">
                <ProgressRing value={g.progress * 100} size={76} stroke={8} color={AREA[g.area].color} locale={locale} />
                <div className="min-w-0 flex-1">
                  <Badge tone="outline" className="mb-1.5">{tx(AREA[g.area].en, AREA[g.area].ar)}</Badge>
                  <p className="font-semibold leading-snug">{g.title}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{formatDate(g.due, locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {days >= 0 ? tx(`${days} days left`, `متبقي ${days} يوماً`) : tx('Past due', 'متأخر')}</p>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
                {g.milestones.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                    <Check checked={m.done} onChange={(v) => toggle(g, m.id, v)} label={m.title} />
                    <span className={m.done ? 'text-sm text-muted-foreground line-through' : 'text-sm'}>{m.title}</span>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" className="mt-2 self-start" onClick={() => router.push(`/chat?q=${encodeURIComponent(`Help me plan: ${g.title}`)}`)}><MessageCircle />{tx('Plan next steps', 'خطط للخطوات التالية')}</Button>
            </Card>
          );
        })}
        {bandConfig.features.badges && (
          <Card id="badges" className="col-span-12">
            <CardHeader title={tx('Badges', 'الشارات')} icon={<Award />} />
            {badges.length ? (
              <div className="flex flex-wrap gap-2.5">
                {badges.map((b, i) => (
                  <motion.span key={b} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 22 }}
                    className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-2 text-sm font-medium text-primary"><Award className="size-4" />{b.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</motion.span>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">{tx('No badges yet.', 'لا توجد شارات بعد.')}</p>}
          </Card>
        )}
        {!world.goals.length && (
          <Card className="col-span-12"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Target className="size-4" />{tx('No goals yet. Add your first one.', 'لا أهداف بعد. أضف هدفك الأول.')}</p></Card>
        )}
      </Bento>
    </Page>
  );
}
