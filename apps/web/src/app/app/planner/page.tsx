'use client';

import { Dialog as D } from 'radix-ui';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { TaskList } from '@/components/shared/task-list';
import { Button } from '@/components/ui/button';
import { Check } from '@/components/ui/check';
import { DialogContent } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/input';
import { addDays, formatDate, startOfWeek } from '@/lib/dates';
import type { PlannerBlock } from '@/lib/merge';
import { stagger, fadeUp } from '@/lib/motion';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const AREA_COLOR: Record<Task['area'], string> = {
  academics: 'var(--chart-1)', extracurriculars: 'var(--chart-2)', goals: 'var(--chart-3)', wellbeing: 'var(--chart-3)', applications: 'var(--chart-4)',
};

type Item = { id: string; kind: 'upcoming' | 'block' | 'session' | 'task'; title: string; time?: string; color: string; done?: boolean; minutes?: number };

function AddBlock({ defaultDate, open, setOpen }: { defaultDate: string; open: boolean; setOpen: (v: boolean) => void }) {
  const { update, tx, toast } = useApp();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState('17:00');
  const [minutes, setMinutes] = useState('45');
  const [area, setArea] = useState<Task['area']>('academics');
  const save = () => {
    if (!title.trim()) return;
    const b: PlannerBlock = { id: `pb-${Date.now()}`, title: title.trim(), date, start, minutes: Number(minutes) || 30, area };
    update((u) => ({ ...u, planner: [...u.planner, b] }));
    toast({ title: tx('Added to your week', 'أضيف إلى أسبوعك'), description: `${b.title} · ${formatDate(b.date, 'en', { weekday: 'short' })} ${b.start}` });
    setOpen(false); setTitle('');
  };
  return (
    <D.Root open={open} onOpenChange={(v) => { setOpen(v); if (v) setDate(defaultDate); }}>
      <DialogContent title={tx('Plan a study or activity block', 'خطط لوقت دراسة أو نشاط')}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4">
          <div><Label htmlFor="pb-t">{tx('What', 'ماذا')}</Label><Input id="pb-t" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('e.g. Physics revision: waves', 'مثلاً: مراجعة الفيزياء')} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="pb-d">{tx('Day', 'اليوم')}</Label><Input id="pb-d" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label htmlFor="pb-s">{tx('Start', 'البداية')}</Label><Input id="pb-s" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label htmlFor="pb-m">{tx('Minutes', 'الدقائق')}</Label><Input id="pb-m" type="number" min={10} max={300} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          </div>
          <div><Label htmlFor="pb-a">{tx('Area', 'المجال')}</Label>
            <Select id="pb-a" value={area} onChange={(e) => setArea(e.target.value as Task['area'])}>
              <option value="academics">{tx('Study', 'دراسة')}</option><option value="extracurriculars">{tx('Activity', 'نشاط')}</option>
              <option value="wellbeing">{tx('Wellbeing', 'العافية')}</option><option value="applications">{tx('Applications', 'الطلبات')}</option>
            </Select></div>
          <div className="flex justify-end gap-2"><D.Close asChild><Button variant="ghost">{tx('Cancel', 'إلغاء')}</Button></D.Close><Button type="submit" disabled={!title.trim()}>{tx('Add', 'إضافة')}</Button></div>
        </form>
      </DialogContent>
    </D.Root>
  );
}

export default function PlannerPage() {
  const { world, tx, locale, user, update } = useApp();
  const [offset, setOffset] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addDate, setAddDate] = useState(world.today);
  const weekStart = addDays(startOfWeek(world.today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byDay = useMemo(() => {
    const m: Record<string, Item[]> = {};
    for (const d of days) m[d] = [];
    for (const u of world.dashboard.upcoming) if (m[u.date]) m[u.date]!.push({ id: u.id, kind: 'upcoming', title: u.title, color: u.type === 'exam' || u.type === 'test' ? 'var(--danger)' : 'var(--warning)' });
    for (const b of user.planner) if (m[b.date]) m[b.date]!.push({ id: b.id, kind: 'block', title: b.title, time: b.start, minutes: b.minutes, color: AREA_COLOR[b.area], done: !!user.plannerDone[b.id] });
    // today's tasks (incl. ones teachers set) sit in today's column too, so the week never looks empty next to the task list
    if (m[world.today]) for (const t of world.dashboard.today) {
      const time = t.due && /^\d{2}:\d{2}$/.test(t.due) ? t.due : undefined;
      m[world.today]!.push({ id: `task-${t.id}`, kind: 'task', title: t.title, time, minutes: t.minutes, color: AREA_COLOR[t.area] ?? 'var(--chart-1)', done: !!(t.id in user.taskDone ? user.taskDone[t.id] : t.done) });
    }
    for (const a of world.extracurriculars.activities) for (const s of a.sessions) if (m[s.date] && s.date <= world.today) m[s.date]!.push({ id: s.id, kind: 'session', title: a.name, minutes: s.minutes, color: 'var(--chart-2)', done: true });
    for (const d of days) m[d]!.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, world, user]);

  const label = `${formatDate(days[0]!, locale, { day: 'numeric', month: 'short' })} – ${formatDate(days[6]!, locale, { day: 'numeric', month: 'short' })}`;
  return (
    <Page wide>
      <PageHeader
        eyebrow={tx('Week view', 'عرض الأسبوع')}
        title={tx('Planner', 'المخطط')}
        subtitle={tx('Deadlines, sessions you logged and the study blocks you plan, side by side.', 'المواعيد والجلسات المسجلة وأوقات الدراسة المخططة جنباً إلى جنب.')}
        actions={<>
          <div className="flex items-center rounded-full bg-surface p-1">
            <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label={tx('Previous week', 'الأسبوع السابق')} onClick={() => setOffset((o) => o - 1)}><ChevronLeft className="rtl:-scale-x-100" /></Button>
            <button onClick={() => setOffset(0)} className="px-2 text-sm font-medium tabular">{offset === 0 ? tx('This week', 'هذا الأسبوع') : label}</button>
            <Button size="icon-sm" variant="ghost" className="rounded-full" aria-label={tx('Next week', 'الأسبوع التالي')} onClick={() => setOffset((o) => o + 1)}><ChevronRight className="rtl:-scale-x-100" /></Button>
          </div>
          <Button onClick={() => { setAddDate(world.today >= days[0]! && world.today <= days[6]! ? world.today : days[0]!); setAddOpen(true); }}><Plus />{tx('Plan a block', 'خطط لوقت')}</Button>
        </>}
      />
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <motion.div key={weekStart} initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-7">
          {days.map((d) => {
            const isToday = d === world.today;
            return (
              <motion.div key={d} variants={fadeUp} className={cn('card flex min-h-[220px] min-w-0 flex-col p-3', isToday && 'border-transparent ring-[1.5px] ring-[var(--accent)]')}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{formatDate(d, locale, { weekday: 'short' })}</span>
                  <span className={cn('text-lg font-semibold tabular', isToday && 'text-primary')}>{formatDate(d, locale, { day: 'numeric' })}</span>
                </div>
                <ul className="flex flex-1 flex-col gap-1.5">
                  {byDay[d]!.slice(0, 6).map((it) => (
                    <li key={it.id} className="group flex items-start gap-1.5 rounded-md border-s-[3px] bg-surface-2 px-2 py-1.5 text-xs" style={{ borderInlineStartColor: it.color }}>
                      {it.kind === 'block' && <Check checked={!!it.done} label={it.title} className="mt-px size-4 border" onChange={(v) => update((u) => ({ ...u, plannerDone: { ...u.plannerDone, [it.id]: v } }))} />}
                      <span className="min-w-0 flex-1">
                        <span className={cn('line-clamp-2 font-medium', it.done && (it.kind === 'block' || it.kind === 'task') && 'text-muted-foreground line-through')}>{it.title}</span>
                        <span className="text-muted-foreground tabular">{it.time ? `${it.time} · ` : ''}{it.minutes ? `${it.minutes}m` : it.kind === 'upcoming' ? tx('Due', 'موعد') : it.kind === 'task' ? tx('Task', 'مهمة') : ''}</span>
                      </span>
                      {it.kind === 'block' && (
                        <button aria-label={tx('Remove', 'إزالة')} onClick={() => update((u) => ({ ...u, planner: u.planner.filter((b) => b.id !== it.id) }))} className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100"><Trash2 className="size-3 text-muted-foreground" /></button>
                      )}
                    </li>
                  ))}
                  {byDay[d]!.length === 0 && <li className="px-1 py-2 text-[0.6875rem] text-muted-foreground">{tx('Nothing planned yet', 'لا شيء مخطط بعد')}</li>}
                  {byDay[d]!.length > 6 && <li className="px-1 text-[0.6875rem] text-muted-foreground">+{byDay[d]!.length - 6} {tx('more', 'أخرى')}</li>}
                </ul>
                <button onClick={() => { setAddDate(d); setAddOpen(true); }} className="mt-2 inline-flex h-8 items-center justify-center gap-1 rounded-md text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground"><Plus className="size-3.5" />{tx('Add', 'إضافة')}</button>
              </motion.div>
            );
          })}
        </motion.div>
        <div className="card h-fit p-5">
          <p className="card-title mb-3">{tx("Today's tasks", "مهام اليوم")}</p>
          <TaskList tasks={world.dashboard.today} />
        </div>
      </div>
      <AddBlock key={addDate} defaultDate={addDate} open={addOpen} setOpen={setAddOpen} />
    </Page>
  );
}
