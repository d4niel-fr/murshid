'use client';

import { CalendarOff, CheckCircle2, Clock3, Send, XCircle } from 'lucide-react';
import { useState } from 'react';
import { dayLabel, SchoolSection } from '@/components/life/gate';
import { useLoad } from '@/components/life/use-load';
import { useApp } from '@/components/providers/app-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { askLeave, getAttendance, withdrawLeave, type Attendance, type LeaveReason, type Mark } from '@/lib/life-api';
import { cn } from '@/lib/utils';

const REASONS: Record<LeaveReason, [string, string]> = {
  illness: ['Illness', 'مرض'], appointment: ['Appointment', 'موعد'], family: ['Family', 'ظرف عائلي'], religious: ['Religious occasion', 'مناسبة دينية'], competition: ['Competition or event', 'مسابقة أو فعالية'], other: ['Other', 'أخرى'],
};
const MARK: Record<Mark, { en: string; ar: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
  present: { en: 'Present', ar: 'حاضر', tone: 'success' }, late: { en: 'Late', ar: 'متأخر', tone: 'warning' }, absent: { en: 'Absent', ar: 'غائب', tone: 'danger' }, excused: { en: 'Excused', ar: 'غياب بعذر', tone: 'info' },
};

export default function AttendancePage() {
  const { tx } = useApp();
  const load = useLoad(getAttendance);
  return (
    <SchoolSection title={tx('Attendance', 'الحضور')} subtitle={tx('Your attendance this term, and leave requests. A parent can ask for leave from their own account too.', 'حضورك هذا الفصل وطلبات الإذن. يمكن لولي الأمر طلب الإذن من حسابه أيضاً.')} load={load}>
      {(d) => <Body d={d} setData={(f) => load.setData((x) => (x ? f(x) : x))} />}
    </SchoolSection>
  );
}

function Body({ d, setData }: { d: Attendance; setData: (f: (x: Attendance) => Attendance) => void }) {
  const { tx, locale, client, toast, account } = useApp();
  const today = new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ from: today, to: today, reason: 'illness' as LeaveReason, note: '' });
  const [busy, setBusy] = useState(false);
  const parent = account?.me.role === 'parent';
  const send = async () => {
    setBusy(true);
    try {
      const l = await askLeave(client.devUser, form);
      setData((x) => ({ ...x, leave: [l, ...x.leave] }));
      setForm({ ...form, note: '' });
      toast({ tone: 'success', title: tx('Sent to the school office', 'أُرسل إلى إدارة المدرسة') });
    } catch (e) { toast({ tone: 'danger', title: (e as Error).message }); } finally { setBusy(false); }
  };
  const withdraw = async (id: string) => {
    try { await withdrawLeave(client.devUser, id); setData((x) => ({ ...x, leave: x.leave.filter((l) => l.id !== id) })); }
    catch (e) { toast({ tone: 'danger', title: (e as Error).message }); }
  };
  const tone = (r: number | null) => (r === null ? 'var(--text-muted)' : r >= 95 ? 'var(--success)' : r >= 90 ? 'var(--warning)' : 'var(--danger)');
  return (
    <div className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 lg:col-span-5">
        <CardHeader title={tx(`This term (${d.term.replace('T', 'Term ')})`, `هذا الفصل (${d.term.replace('T', 'الفصل ')})`)} />
        <div className="flex items-center gap-5">
          <ProgressRing value={d.rate ?? 0} color={tone(d.rate)} locale={locale} />
          <div className="text-sm">
            <p className="font-medium">{d.rate === null ? tx('No registers yet this term', 'لا سجلات بعد هذا الفصل') : d.rate >= 95 ? tx('Excellent attendance', 'حضور ممتاز') : d.rate >= 90 ? tx('Good, keep it up', 'جيد، استمر') : tx('Below 90%: every lesson counts', 'أقل من 90٪: كل درس مهم')}</p>
            <Muted className="mt-1 text-xs">{tx('Late and excused count as attended. UAE schools expect at least 95%.', 'يُحتسب التأخير والغياب بعذر حضوراً. تتوقع مدارس الإمارات 95٪ على الأقل.')}</Muted>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-border">
          {d.classes.map((c) => (
            <li key={c.id} className="py-2.5">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium">{c.subjectName}</span><span className="tabular-nums" style={{ color: tone(c.rate) }}>{c.rate === null ? '–' : `${c.rate}%`}</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full" style={{ width: `${c.rate ?? 0}%`, background: tone(c.rate) }} /></div>
              {(c.absent > 0 || c.late > 0) && <p className="mt-1 text-xs text-muted-foreground">{[c.absent && tx(`${c.absent} absent`, `غياب ${c.absent}`), c.late && tx(`${c.late} late`, `تأخر ${c.late}`), c.excused && tx(`${c.excused} excused`, `بعذر ${c.excused}`)].filter(Boolean).join(' · ')}</p>}
            </li>
          ))}
        </ul>
      </Card>

      <div className="col-span-12 grid content-start gap-4 lg:col-span-7">
        <Card>
          <CardHeader title={parent ? tx('Ask for leave for your child', 'اطلب إذناً لابنك') : tx('Ask for leave', 'اطلب إذناً')} icon={<CalendarOff />} />
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{tx('First day', 'اليوم الأول')}<input type="date" required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to < e.target.value ? e.target.value : form.to })} className="mt-1 h-11 w-full rounded-full border border-border bg-transparent px-4" /></label>
            <label className="text-sm">{tx('Last day', 'اليوم الأخير')}<input type="date" required min={form.from} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="mt-1 h-11 w-full rounded-full border border-border bg-transparent px-4" /></label>
            <label className="text-sm sm:col-span-2">{tx('Reason', 'السبب')}
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value as LeaveReason })} className="mt-1 h-11 w-full rounded-full border border-border bg-transparent px-4">
                {(Object.keys(REASONS) as LeaveReason[]).map((r) => <option key={r} value={r}>{locale === 'ar' ? REASONS[r][1] : REASONS[r][0]}</option>)}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">{tx('Note for the school (optional)', 'ملاحظة للمدرسة (اختياري)')}
              <textarea dir="auto" rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-[18px] border border-border bg-transparent px-4 py-2.5" />
            </label>
            <Button type="submit" disabled={busy} className="sm:col-span-2 sm:justify-self-start"><Send className="size-4" />{busy ? tx('Sending…', 'جارٍ الإرسال…') : tx('Send request', 'أرسل الطلب')}</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title={tx('Requests', 'الطلبات')} />
          {!d.leave.length ? <Muted>{tx('No leave requests this term.', 'لا طلبات إذن هذا الفصل.')}</Muted> : (
            <ul className="divide-y divide-border">
              {d.leave.map((l) => (
                <li key={l.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                  {l.status === 'approved' ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : l.status === 'declined' ? <XCircle className="mt-0.5 size-4 text-danger" /> : <Clock3 className="mt-0.5 size-4 text-muted-foreground" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{dayLabel(l.from, locale)}{l.to !== l.from && ` – ${dayLabel(l.to, locale)}`}</span>
                    <span className="block text-xs text-muted-foreground">{locale === 'ar' ? REASONS[l.reason][1] : REASONS[l.reason][0]}{l.by === 'parent' && ` · ${tx(`asked by ${l.byName}`, `بطلب من ${l.byName}`)}`}</span>
                    {l.reply && <span dir="auto" className="mt-1 block">“{l.reply}”</span>}
                  </span>
                  <Badge tone={l.status === 'approved' ? 'success' : l.status === 'declined' ? 'danger' : 'outline'}>{l.status === 'approved' ? tx('Approved', 'مقبول') : l.status === 'declined' ? tx('Declined', 'مرفوض') : tx('Waiting', 'قيد الانتظار')}</Badge>
                  {l.status === 'pending' && <button type="button" onClick={() => void withdraw(l.id)} className="text-xs font-medium text-muted-foreground hover:text-foreground">{tx('Withdraw', 'سحب')}</button>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {d.classes.some((c) => c.recent.length) && (
          <Card>
            <CardHeader title={tx('Recent absences and lates', 'آخر الغيابات والتأخيرات')} />
            <ul className="grid gap-2 sm:grid-cols-2">
              {d.classes.flatMap((c) => c.recent.map((r) => ({ ...r, subject: c.subjectName }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((r) => (
                <li key={`${r.subject}-${r.date}`} className={cn('flex items-center justify-between gap-2 rounded-[14px] bg-surface px-3 py-2 text-sm')}>
                  <span className="min-w-0 truncate">{r.subject} · <span className="text-muted-foreground">{dayLabel(r.date, locale)}</span></span>
                  <Badge tone={MARK[r.mark].tone}>{locale === 'ar' ? MARK[r.mark].ar : MARK[r.mark].en}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
