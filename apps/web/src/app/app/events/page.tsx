'use client';

import { Bus, CalendarPlus, GraduationCap, PartyPopper, Trophy, Umbrella, Users } from 'lucide-react';
import { useState } from 'react';
import { dayLabel, SchoolSection } from '@/components/life/gate';
import { useLoad } from '@/components/life/use-load';
import { useApp } from '@/components/providers/app-provider';
import { Badge } from '@/components/ui/badge';
import { Card, Muted } from '@/components/ui/card';
import { getEvents, type EventKind, type SchoolEvent } from '@/lib/life-api';

const KIND: Record<EventKind, { I: typeof Bus; en: string; ar: string }> = {
  holiday: { I: Umbrella, en: 'Holiday', ar: 'عطلة' }, exam: { I: GraduationCap, en: 'Exams', ar: 'اختبارات' }, trip: { I: Bus, en: 'Trip', ar: 'رحلة' },
  event: { I: PartyPopper, en: 'Event', ar: 'فعالية' }, meeting: { I: Users, en: 'Meeting', ar: 'اجتماع' }, sport: { I: Trophy, en: 'Sport', ar: 'رياضة' },
};

/** One event as a calendar file (.ics) the phone or Outlook can add. */
function ics(e: SchoolEvent) {
  const d = (s: string) => s.replace(/-/g, '');
  const end = new Date(`${e.end}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  const esc = (s: string) => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Murshid//School dates//EN', 'BEGIN:VEVENT', `UID:${e.id}@murshid`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d(e.date)}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, '')}`, `SUMMARY:${esc(e.title)}`, ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function download(e: SchoolEvent) {
  const url = URL.createObjectURL(new Blob([ics(e)], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = `${e.title.replace(/[^\w\- ]+/g, '').slice(0, 40) || 'event'}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EventsPage() {
  const { tx } = useApp();
  const load = useLoad(getEvents);
  return (
    <SchoolSection title={tx('School dates', 'مواعيد المدرسة')} subtitle={tx('Holidays, exams, trips and meetings from your school. Add any of them to your phone’s calendar.', 'العطل والاختبارات والرحلات والاجتماعات. أضف أياً منها إلى تقويم هاتفك.')} load={load}>
      {(d) => <List d={d} />}
    </SchoolSection>
  );
}

function List({ d }: { d: { today: string; upcoming: SchoolEvent[]; past: SchoolEvent[] } }) {
  const { tx, locale } = useApp();
  const [past, setPast] = useState(false);
  const groups = new Map<string, SchoolEvent[]>();
  for (const e of d.upcoming) { const k = e.date.slice(0, 7); groups.set(k, [...(groups.get(k) ?? []), e]); }
  const days = (e: SchoolEvent) => Math.round((Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${d.today}T00:00:00Z`)) / 86_400_000);
  const row = (e: SchoolEvent) => {
    const k = KIND[e.kind]; const n = days(e); const on = e.date <= d.today && d.today <= e.end;
    return (
      <li key={e.id} className="flex items-start gap-3 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface"><k.I className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block text-sm font-medium">{e.title}</span>
          <span className="block text-xs text-muted-foreground">{dayLabel(e.date, locale, { weekday: 'short', day: 'numeric', month: 'short' })}{e.end !== e.date && ` – ${dayLabel(e.end, locale, { weekday: 'short', day: 'numeric', month: 'short' })}`} · {locale === 'ar' ? k.ar : k.en}</span>
          {e.note && <span dir="auto" className="mt-1 block text-sm text-muted-foreground">{e.note}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          {on ? <Badge tone="navy">{tx('Now', 'الآن')}</Badge> : n >= 0 && <Badge tone="outline">{n === 0 ? tx('Today', 'اليوم') : n === 1 ? tx('Tomorrow', 'غداً') : tx(`In ${n} days`, `بعد ${n} يوماً`)}</Badge>}
          {e.end >= d.today && <button type="button" onClick={() => download(e)} aria-label={tx(`Add ${e.title} to my calendar`, `أضف ${e.title} إلى تقويمي`)} className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-surface hover:text-foreground"><CalendarPlus className="size-3.5" />{tx('Add', 'أضف')}</button>}
        </span>
      </li>
    );
  };
  return (
    <div className="grid gap-4">
      {!d.upcoming.length && <Muted>{tx('Nothing coming up.', 'لا مواعيد قادمة.')}</Muted>}
      {[...groups.entries()].map(([m, list]) => (
        <Card key={m}>
          <p className="eyebrow mb-1">{new Date(`${m}-01T00:00:00Z`).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
          <ul className="divide-y divide-border">{list.map(row)}</ul>
        </Card>
      ))}
      {d.past.length > 0 && (
        <div>
          <button type="button" onClick={() => setPast((v) => !v)} className="min-h-10 text-sm font-medium text-primary">{past ? tx('Hide earlier dates', 'إخفاء المواعيد السابقة') : tx('Show earlier dates', 'عرض المواعيد السابقة')}</button>
          {past && <Card className="mt-2"><ul className="divide-y divide-border opacity-75">{d.past.map(row)}</ul></Card>}
        </div>
      )}
    </div>
  );
}
