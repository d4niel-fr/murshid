'use client';

import { Dialog as D } from 'radix-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import type { Session } from '@/lib/types';
import { nAr } from '@/lib/plural';

/** Log an activity session (minutes + optional metric). Stored locally; charts and rings update immediately. */
export function LogSessionDialog({ trigger, activityId, open: openProp, onOpenChange }: { trigger?: ReactNode; activityId?: string; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const { world, update, tx, toast } = useApp();
  const acts = world.extracurriculars.activities;
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [actId, setActId] = useState(activityId ?? acts[0]?.id ?? '');
  const [date, setDate] = useState(world.today);
  const [minutes, setMinutes] = useState('45');
  const [metric, setMetric] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { if (open) { setActId(activityId ?? acts[0]?.id ?? ''); setDate(world.today); setMinutes('45'); setMetric(''); setNote(''); } }, [open, activityId, acts, world.today]);
  const act = acts.find((a) => a.id === actId);
  const lastMetric = act ? [...act.sessions].reverse().find((s) => s.metric)?.metric : undefined;

  const save = () => {
    const mins = Math.max(1, Math.min(720, Number(minutes) || 0));
    if (!act || !mins) return;
    const s: Session = { id: `log-${Date.now()}`, date, minutes: mins, ...(note ? { note } : {}) };
    if (lastMetric && metric !== '' && !Number.isNaN(Number(metric))) s.metric = { name: lastMetric.name, unit: lastMetric.unit, value: Number(metric) };
    update((u) => ({ ...u, sessions: { ...u.sessions, [act.id]: [...(u.sessions[act.id] ?? []), s] } }));
    setOpen(false);
    toast({ title: tx(`Logged ${mins} min of ${act.name}`, `تم تسجيل ${nAr(mins, 'minute', true)} من ${act.name}`), description: tx('Your charts and progress rings are updated.', 'تم تحديث الرسوم وحلقات التقدّم.') });
  };

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <DialogContent title={tx('Log a session', 'تسجيل جلسة')} description={tx('Training, practice, a club meeting or a hackathon day.', 'تدريب أو تمرين أو اجتماع نادٍ أو يوم هاكاثون.')}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4">
          <div>
            <Label htmlFor="ls-act">{tx('Activity', 'النشاط')}</Label>
            <Select id="ls-act" value={actId} onChange={(e) => setActId(e.target.value)}>
              {acts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ls-date">{tx('Date', 'التاريخ')}</Label>
              <Input id="ls-date" type="date" value={date} max={world.today} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ls-min">{tx('Minutes', 'الدقائق')}</Label>
              <Input id="ls-min" inputMode="numeric" type="number" min={1} max={720} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
          </div>
          {lastMetric && (
            <div>
              <Label htmlFor="ls-metric">{lastMetric.name}{lastMetric.unit.toLowerCase() !== lastMetric.name.toLowerCase() ? ` (${lastMetric.unit})` : ''} <span className="font-normal text-muted-foreground">· {tx('optional, last', 'اختياري، آخر قيمة')} {lastMetric.value}</span></Label>
              <Input id="ls-metric" inputMode="decimal" type="number" step="any" value={metric} onChange={(e) => setMetric(e.target.value)} placeholder={String(lastMetric.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="ls-note">{tx('Note', 'ملاحظة')}</Label>
            <Textarea id="ls-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('How did it go?', 'كيف كانت؟')} />
          </div>
          <div className="flex justify-end gap-2">
            <D.Close asChild><Button variant="ghost">{tx('Cancel', 'إلغاء')}</Button></D.Close>
            <Button type="submit">{tx('Save session', 'حفظ الجلسة')}</Button>
          </div>
        </form>
      </DialogContent>
    </D.Root>
  );
}
