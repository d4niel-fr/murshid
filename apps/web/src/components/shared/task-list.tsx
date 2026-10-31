'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Check } from '@/components/ui/check';
import { bandMotion, spring } from '@/lib/motion';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const AREA_LABEL: Record<Task['area'], { en: string; ar: string; tone: string }> = {
  academics: { en: 'Study', ar: 'دراسة', tone: 'text-[var(--chart-1)]' },
  extracurriculars: { en: 'Activity', ar: 'نشاط', tone: 'text-[var(--chart-2)]' },
  goals: { en: 'Goal', ar: 'هدف', tone: 'text-[var(--chart-3)]' },
  wellbeing: { en: 'Wellbeing', ar: 'العافية', tone: 'text-[var(--chart-3)]' },
  applications: { en: 'Applications', ar: 'الطلبات', tone: 'text-[var(--chart-4)]' },
};

function Burst() {
  // 8 particles, transform/opacity only; one burst per tick
  return (
    <span className="pointer-events-none absolute start-[11px] top-1/2 size-0" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <motion.span key={i} className="absolute size-1.5 rounded-full bg-primary"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * 22, y: Math.sin(a) * 22, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} />
        );
      })}
    </span>
  );
}

export function TaskRow({ task, onToggle }: { task: Task; onToggle: (done: boolean) => void }) {
  const { tx } = useApp();
  const [burst, setBurst] = useState(0);
  const area = AREA_LABEL[task.area];
  return (
    <motion.li layout="position" transition={spring.layout} className="relative flex min-h-12 items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-surface-2">
      <span className="relative">
        <Check checked={task.done} label={task.title} onChange={(v) => { onToggle(v); if (v) setBurst((b) => b + 1); }} />
        <AnimatePresence>{task.done && burst > 0 && <Burst key={burst} />}</AnimatePresence>
      </span>
      <span className="min-w-0 flex-1">
        <span className="relative inline-block max-w-full align-middle">
          <span className={cn('block truncate text-sm transition-colors duration-300', task.done ? 'text-muted-foreground' : 'text-foreground')}>{task.title}</span>
          <motion.span aria-hidden className="absolute start-0 top-1/2 h-px w-full origin-left bg-[var(--text-muted)] rtl:origin-right" initial={false} animate={{ scaleX: task.done ? 1 : 0 }} transition={spring.snappy} />
        </span>
      </span>
      <span className={cn('hidden text-xs font-medium sm:inline', area.tone)}>{tx(area.en, area.ar)}</span>
      <span className="w-12 text-end text-xs tabular text-muted-foreground">{task.due && /^\d\d:\d\d$/.test(task.due) ? task.due : task.minutes ? `${task.minutes}m` : ''}</span>
    </motion.li>
  );
}

/** Today list with tick animation and inline add. Writes ticks + new tasks to local user state. */
export function TaskList({ tasks, max, allowAdd = true }: { tasks: Task[]; max?: number; allowAdd?: boolean }) {
  const { update, tx, toast, band } = useApp();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const shown = max ? tasks.slice(0, max) : tasks;
  const toggle = (t: Task, done: boolean) => {
    update((u) => ({ ...u, taskDone: { ...u.taskDone, [t.id]: done } }));
    const remaining = tasks.filter((x) => (x.id === t.id ? !done : !x.done)).length;
    if (done && remaining === 0) toast({ title: tx('Everything done for today 🎉', 'أنجزت كل مهام اليوم 🎉'), description: bandMotion[band].celebrate ? tx('Streak kept alive. Enjoy your evening!', 'حافظت على سلسلتك. استمتع بمسائك!') : undefined });
  };
  const add = () => {
    const v = title.trim();
    if (!v) { setAdding(false); return; }
    const task: Task = { id: `u-${Date.now()}`, title: v, area: 'academics', done: false };
    update((u) => ({ ...u, extraTasks: [...u.extraTasks, task] }));
    setTitle('');
    toast({ title: tx('Task added', 'تمت إضافة المهمة') });
  };
  return (
    <div>
      <ul className="-mx-2 flex flex-col">
        {shown.map((t) => <TaskRow key={t.id} task={t} onToggle={(d) => toggle(t, d)} />)}
      </ul>
      {allowAdd && (
        <div className="mt-2">
          {adding ? (
            <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex items-center gap-2">
              <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onBlur={add} placeholder={tx('New task…', 'مهمة جديدة…')} className="h-9 flex-1 rounded-sm bg-surface-2 px-3 text-sm outline-none ring-1 ring-inset ring-border focus:ring-[var(--accent)]" />
              <Button size="sm" type="submit">{tx('Add', 'إضافة')}</Button>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground">
              <Plus className="size-4" />{tx('Add task', 'إضافة مهمة')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
