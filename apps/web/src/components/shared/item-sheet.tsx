'use client';

import Link from 'next/link';
import { Dialog as D } from 'radix-ui';
import { ArrowRight, CalendarClock, Clock3, Copy, Layers, Maximize2, MessageCircle, MoveRight, Tag, Timer, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Check } from '@/components/ui/check';
import { DialogContent } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { addDays, formatDate } from '@/lib/dates';
import type { PlannerBlock } from '@/lib/merge';
import type { Task, UpcomingItem } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Anything that shows up in the planner or the task list, with what the detail view needs to know about it. */
export type DetailItem =
  | { kind: 'task'; task: Task; date: string }
  | { kind: 'block'; block: PlannerBlock }
  | { kind: 'upcoming'; item: UpcomingItem }
  | { kind: 'session'; id: string; activity: string; date: string; minutes: number };

export const detailKey = (d: DetailItem) =>
  d.kind === 'task' ? `task:${d.task.id}` : d.kind === 'block' ? `block:${d.block.id}` : d.kind === 'upcoming' ? `upcoming:${d.item.id}` : `session:${d.id}`;

const AREA: Record<Task['area'], [string, string, string]> = {
  academics: ['Study', 'دراسة', 'var(--chart-1)'],
  extracurriculars: ['Activity', 'نشاط', 'var(--chart-2)'],
  goals: ['Goal', 'هدف', 'var(--chart-3)'],
  wellbeing: ['Wellbeing', 'العافية', 'var(--chart-3)'],
  applications: ['Applications', 'الطلبات', 'var(--chart-4)'],
};
const UPCOMING: Record<UpcomingItem['type'], [string, string]> = {
  test: ['Test', 'اختبار'], exam: ['Exam', 'امتحان'], homework: ['Homework', 'واجب'], event: ['Event', 'فعالية'],
  competition: ['Competition', 'مسابقة'], deadline: ['Deadline', 'موعد نهائي'], session: ['Session', 'جلسة'],
};

/**
 * The detail view behind every planner item and task: what it is, when, how long, your own notes, and the next
 * step (tick it, start a focus timer for it, ask Murshid, move or edit a study block).
 */
export function ItemSheet({ item, onOpenChange }: { item: DetailItem | null; onOpenChange: (open: boolean) => void }) {
  const { tx, locale, user, update, world, toast } = useApp();
  const open = item !== null;
  const key = item ? detailKey(item) : '';
  const [note, setNote] = useState('');
  useEffect(() => { setNote(key ? user.itemNotes?.[key] ?? '' : ''); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  // notes save as you type (debounced)
  useEffect(() => {
    if (!key) return;
    if ((user.itemNotes?.[key] ?? '') === note) return;
    const t = setTimeout(() => update((u) => ({ ...u, itemNotes: { ...u.itemNotes, [key]: note } })), 400);
    return () => clearTimeout(t);
  }, [note, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return <D.Root open={false} onOpenChange={onOpenChange}><span /></D.Root>;

  // live values (the item may have changed since it was opened)
  const block = item.kind === 'block' ? user.planner.find((b) => b.id === item.block.id) ?? item.block : null;
  const task = item.kind === 'task' ? item.task : null;
  const title = block?.title ?? task?.title ?? (item.kind === 'upcoming' ? item.item.title : item.kind === 'session' ? item.activity : '');
  const date = block?.date ?? (item.kind === 'task' ? item.date : item.kind === 'upcoming' ? item.item.date : item.kind === 'session' ? item.date : world.today);
  const time = block?.start ?? (task?.due && /^\d\d:\d\d$/.test(task.due) ? task.due : undefined);
  const minutes = block?.minutes ?? task?.minutes ?? (item.kind === 'session' ? item.minutes : undefined);
  const area = block?.area ?? task?.area;
  const done = block ? !!user.plannerDone[block.id] : task ? !!(task.id in user.taskDone ? user.taskDone[task.id] : task.done) : item.kind === 'session';
  const canTick = !!block || !!task;
  const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${world.today}T00:00:00`).getTime()) / 86_400_000);
  const when = days === 0 ? tx('Today', 'اليوم') : days === 1 ? tx('Tomorrow', 'غداً') : days === -1 ? tx('Yesterday', 'أمس') : days > 1 ? tx(`In ${days} days`, `بعد ${days} أيام`) : tx(`${-days} days ago`, `قبل ${-days} أيام`);
  const color = area ? AREA[area][2] : item.kind === 'upcoming' ? (item.item.type === 'exam' || item.item.type === 'test' ? 'var(--danger)' : 'var(--warning)') : 'var(--chart-2)';
  const kindLabel = item.kind === 'block' ? tx('Study block you planned', 'وقت خططت له')
    : item.kind === 'task' ? tx("Today's task", 'مهمة اليوم')
    : item.kind === 'upcoming' ? tx(...UPCOMING[item.item.type])
    : tx('Logged session', 'جلسة مسجلة');

  const setDone = (v: boolean) => {
    if (block) update((u) => ({ ...u, plannerDone: { ...u.plannerDone, [block.id]: v } }));
    else if (task) update((u) => ({ ...u, taskDone: { ...u.taskDone, [task.id]: v } }));
    if (v) toast({ title: tx('Done. Nice work.', 'تم. أحسنت.'), tone: 'success' });
  };
  const patchBlock = (p: Partial<PlannerBlock>) => block && update((u) => ({ ...u, planner: u.planner.map((b) => (b.id === block.id ? { ...b, ...p } : b)) }));
  const removeBlock = () => {
    if (!block) return;
    const kept = block;
    update((u) => ({ ...u, planner: u.planner.filter((b) => b.id !== kept.id) }));
    onOpenChange(false);
    toast({ title: tx('Block removed', 'أُزيل الوقت'), description: kept.title, action: { label: tx('Undo', 'تراجع'), onClick: () => update((u) => ({ ...u, planner: [...u.planner, kept] })) } });
  };
  const duplicate = () => {
    if (!block) return;
    const copy: PlannerBlock = { ...block, id: `pb-${Date.now()}`, date: addDays(block.date, 1) };
    update((u) => ({ ...u, planner: [...u.planner, copy] }));
    toast({ title: tx('Copied to the next day', 'نُسخ إلى اليوم التالي'), description: formatDate(copy.date, locale, { weekday: 'long', day: 'numeric', month: 'short' }) });
  };
  const ask = item.kind === 'upcoming'
    ? tx(`Make me a revision plan for "${title}" on ${date}`, `ضع لي خطة مراجعة لـ "${title}" في ${date}`)
    : tx(`Help me get started on "${title}"`, `ساعدني في البدء بـ "${title}"`);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent title={<span className="flex items-start gap-2.5"><span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: color }} /><span dir="auto" className={cn('min-w-0 [overflow-wrap:anywhere]', done && canTick && 'text-muted-foreground line-through')}>{title}</span></span>}
        description={kindLabel} className="w-[min(94vw,560px)]">
        <div className="flex flex-col gap-5">
          {canTick && (
            <button type="button" onClick={() => setDone(!done)} className={cn('flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-start transition-colors', done ? 'border-transparent tint-success' : 'border-border hover:bg-surface')}>
              <Check checked={done} label={tx('Done', 'تم')} onChange={setDone} />
              <span className="flex-1 text-[0.9375rem] font-medium">{done ? tx('Done', 'تم') : tx('Mark as done', 'وضع علامة تم')}</span>
              <span className="text-xs text-muted-foreground">{tx('or press D', 'أو اضغط D')}</span>
            </button>
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact icon={<CalendarClock className="size-4" />} label={tx('When', 'متى')} value={`${formatDate(date, locale, { weekday: 'short', day: 'numeric', month: 'short' })}${time ? ` · ${time}` : ''}`} sub={when} />
            {minutes ? <Fact icon={<Clock3 className="size-4" />} label={tx('How long', 'المدة')} value={tx(`${minutes} min`, `${minutes} دقيقة`)} /> : null}
            {area && <Fact icon={<Tag className="size-4" />} label={tx('Area', 'المجال')} value={tx(AREA[area][0], AREA[area][1])} />}
            {item.kind === 'upcoming' && <Fact icon={<Tag className="size-4" />} label={tx('Type', 'النوع')} value={tx(...UPCOMING[item.item.type])} />}
          </dl>

          {block && (
            <fieldset className="grid grid-cols-2 gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-4">
              <legend className="sr-only">{tx('Edit this block', 'عدّل هذا الوقت')}</legend>
              <div className="col-span-2 sm:col-span-4"><Label htmlFor="is-title">{tx('What', 'ماذا')}</Label><Input id="is-title" value={block.title} onChange={(e) => patchBlock({ title: e.target.value })} onBlur={(e) => { if (!e.target.value.trim()) patchBlock({ title: tx('Study block', 'وقت دراسة') }); }} /></div>
              <div className="col-span-2"><Label htmlFor="is-date">{tx('Day', 'اليوم')}</Label><Input id="is-date" type="date" value={block.date} onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && patchBlock({ date: e.target.value })} /></div>
              <div><Label htmlFor="is-start">{tx('Start', 'البداية')}</Label><Input id="is-start" type="time" value={block.start} onChange={(e) => e.target.value && patchBlock({ start: e.target.value })} /></div>
              <div><Label htmlFor="is-min">{tx('Minutes', 'الدقائق')}</Label><Input id="is-min" type="number" min={5} max={300} value={block.minutes} onChange={(e) => { const n = Number(e.target.value); if (n >= 5 && n <= 300) patchBlock({ minutes: n }); }} /></div>
              <div className="col-span-2 sm:col-span-4"><Label htmlFor="is-area">{tx('Area', 'المجال')}</Label>
                <Select id="is-area" value={block.area} onChange={(e) => patchBlock({ area: e.target.value as Task['area'] })}>
                  {(['academics', 'extracurriculars', 'wellbeing', 'applications'] as const).map((a) => <option key={a} value={a}>{tx(AREA[a][0], AREA[a][1])}</option>)}
                </Select></div>
            </fieldset>
          )}

          <div>
            <Label htmlFor="is-note">{tx('Your notes', 'ملاحظاتك')}</Label>
            <Textarea id="is-note" dir="auto" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder={tx('Page numbers, what to bring, where you got stuck…', 'أرقام الصفحات، ما تحتاج إحضاره، أين توقفت…')} />
            <p className="mt-1 text-xs text-muted-foreground">{tx('Only you see this. Saved on this device.', 'لا يراها غيرك. تُحفظ على هذا الجهاز.')}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {item.kind !== 'session' && !done && (
              <Button asChild><Link href={`/app/study/focus?start=${minutes && minutes >= 50 ? 50 : 25}&label=${encodeURIComponent(title.slice(0, 60))}`} onClick={() => onOpenChange(false)}><Timer />{tx('Start focus', 'ابدأ التركيز')}</Link></Button>
            )}
            <Button variant="secondary" asChild><Link href={`/app/chat?q=${encodeURIComponent(ask)}`} onClick={() => onOpenChange(false)}><MessageCircle />{tx('Ask Murshid', 'اسأل مرشد')}</Link></Button>
            {item.kind === 'upcoming' && (item.item.type === 'test' || item.item.type === 'exam') && (
              <Button variant="secondary" asChild><Link href="/app/study/flashcards" onClick={() => onOpenChange(false)}><Layers />{tx('Revise with flashcards', 'راجع بالبطاقات')}</Link></Button>
            )}
            {block && <>
              <Button variant="secondary" onClick={() => patchBlock({ date: addDays(block.date, 1) })}><MoveRight className="rtl:-scale-x-100" />{tx('Move to next day', 'انقل لليوم التالي')}</Button>
              <Button variant="ghost" onClick={duplicate}><Copy />{tx('Duplicate', 'تكرار')}</Button>
              <Button variant="ghost" className="text-[var(--danger)]" onClick={removeBlock}><Trash2 />{tx('Delete', 'حذف')}</Button>
            </>}
            {item.kind === 'session' && <Button variant="secondary" asChild><Link href="/app/extracurriculars" onClick={() => onOpenChange(false)}>{tx('Open activities', 'افتح الأنشطة')}<ArrowRight className="rtl:-scale-x-100" /></Link></Button>}
          </div>
        </div>
        <DoneShortcut enabled={open && canTick} toggle={() => setDone(!done)} />
      </DialogContent>
    </D.Root>
  );
}

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</dt>
      <dd className="mt-1 font-medium tabular">{value}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  );
}

/** D ticks the item while its detail is open (not while typing). */
function DoneShortcut({ enabled, toggle }: { enabled: boolean; toggle: () => void }) {
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'd' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); toggle(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [enabled, toggle]);
  return null;
}

/**
 * Handlers that make a row open its detail: double-click with a mouse, a single tap on touch screens (double-tap
 * zooms on phones). Clicks on a control inside the row (a checkbox, a delete button) do not open it. Pair it with a
 * <DetailsButton> so keyboard and screen-reader users have a real button to reach.
 */
export function openOn(open: () => void) {
  const fromControl = (e: React.SyntheticEvent) => Boolean((e.target as HTMLElement).closest('button,a,input,select,textarea,[role=checkbox]'));
  return {
    onDoubleClick: (e: React.MouseEvent) => { if (!fromControl(e)) { window.getSelection()?.removeAllRanges(); open(); } },
    onClick: (e: React.MouseEvent) => {
      if (fromControl(e)) return;
      if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) open();
    },
  };
}

/** The keyboard way into a row's detail: shows on hover and focus, always on touch screens. */
export function DetailsButton({ label, onOpen, className }: { label: string; onOpen: () => void; className?: string }) {
  return (
    <button type="button" onClick={onOpen} aria-label={label} title={label}
      className={cn('grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-[color-mix(in_oklab,var(--text)_8%,transparent)] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:hidden', className)}>
      <Maximize2 className="size-3" />
    </button>
  );
}
