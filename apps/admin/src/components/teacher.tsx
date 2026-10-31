'use client';

import { CalendarCheck2, CheckCircle2, Info, Smartphone, TriangleAlert, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge, Bar, Card, cn } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const STATUS_TONE: Record<string, 'danger' | 'warning' | 'success' | 'info'> = { at_risk: 'danger', watch: 'warning', on_track: 'info', ahead: 'success' };
const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function Avatar({ initials, app }: { initials: string; app?: boolean }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--deep)] text-[11px] font-medium text-white">
      {initials}
      {app && <span title="Uses the Murshid app" className="absolute -bottom-0.5 -right-0.5 grid size-3.5 place-items-center rounded-full bg-[var(--success)] text-white"><Smartphone className="size-2.5" /></span>}
    </span>
  );
}

export function SummaryStats({ s }: { s: any }) {
  const items: [string, ReactNode, string?, string?][] = [
    ['Students', s.students, `${s.ahead} ahead \u00b7 ${s.onTrack} on track`],
    ['At risk', s.atRisk, 'need support this week', 'danger'],
    ['Keep an eye', s.watch, `${s.heavyWeek} with a very full week`, 'warning'],
    ['Work handed in', `${s.avgCompletion}%`, `${s.overdue} overdue in this class`],
    ['Class average', s.avgGrade === null ? '\u2014' : `${s.avgGrade}%`, 'recent marked work'],
  ];
  return (
    <section className="on-deep mb-6 rounded-[var(--radius-band)] px-8 pb-8 pt-7">
      <div className="flex items-center justify-between gap-4">
        <span className="eyebrow">This week, in numbers</span>
        <span className="text-xs text-white/55">Worked out with fixed rules from the class&rsquo;s own work, tests and activities</span>
      </div>
      <dl className="mt-8 grid grid-cols-5 gap-x-6">
        {items.map(([label, value, sub, tone]) => (
          <div key={label} className="min-w-0 border-t border-white/20 pt-5">
            <dt className="truncate text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/60">{label}</dt>
            <dd className={cn('figure mt-4 text-[3rem]', tone === 'danger' && 'text-[#ff9b8f]', tone === 'warning' && 'text-[#f3c76f]')}>{value}</dd>
            {sub && <dd className="mt-2 truncate text-xs text-white/60">{sub}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ProgressTable({ report, subjectName }: { report: any; subjectName: string }) {
  const [filter, setFilter] = useState<string>('all');
  const rows = report.students.filter((r: any) => filter === 'all' || r.status === filter);
  const chip = (id: string, label: string, n: number) => (
    <button key={id} onClick={() => setFilter(id)} className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-colors', filter === id ? 'bg-[var(--deep)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}>{label}<span className={cn('tabular-nums', filter === id ? 'text-white/60' : 'text-[var(--text-muted)]')}>{n}</span></button>
  );
  const s = report.summary;
  return (
    <Card pad={false} title={<span>Class progress <span className="hidden font-normal text-[var(--text-muted)] xl:inline">&middot; {subjectName} work, with each student&rsquo;s whole week in view</span></span>}
      action={<div className="flex flex-wrap justify-end gap-0.5 rounded-full bg-[var(--surface-2)] p-1">{chip('all', 'All', s.students)}{chip('at_risk', 'At risk', s.atRisk)}{chip('watch', 'Keep an eye', s.watch)}{chip('on_track', 'On track', s.onTrack)}{chip('ahead', 'Ahead', s.ahead)}</div>}>
      <table className="tbl">
        <thead><tr><th>Student</th><th>Status</th><th>Handed in</th><th>Avg</th><th>Still to do</th><th>Next 7 days</th><th className="w-[30%]">Why</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id}>
              <td>
                <div className="flex items-center gap-2.5">
                  <Avatar initials={r.initials} app={Boolean(r.appId)} />
                  <span className="min-w-0"><span className="block whitespace-nowrap font-medium">{r.name}</span><span className="text-xs text-[var(--text-muted)]">{r.section}</span></span>
                </div>
              </td>
              <td><Badge tone={STATUS_TONE[r.status]}>{r.statusLabel}</Badge></td>
              <td className="w-32"><div className="flex items-center gap-2"><Bar value={r.subject.completion} tone={r.subject.completion < 70 ? 'warning' : r.subject.completion >= 95 ? 'success' : 'accent'} /><span className="text-xs tabular-nums">{r.subject.completion}%</span></div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{r.subject.submitted} of {r.subject.assigned - r.subject.pending} due</div></td>
              <td className="tabular-nums">{r.subject.avgGrade ?? '\u2014'}{r.subject.avgGrade !== null && '%'}</td>
              <td className="whitespace-nowrap">
                {r.subject.overdue > 0 && <Badge tone="danger" className="mr-1">{r.subject.overdue} overdue</Badge>}
                <span className="text-xs">{r.subject.pending} open</span>
                {r.all.overdue - r.subject.overdue > 0 && <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">+{r.all.overdue - r.subject.overdue} overdue elsewhere</div>}
              </td>
              <td className="w-32">
                <div className="flex items-center gap-2"><Bar value={Math.min(100, r.all.loadPct)} tone={r.all.loadPct >= 85 ? 'warning' : 'accent'} /><span className="text-xs tabular-nums">{r.all.loadPct}%</span></div>
                <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{r.all.testsNext7.length} test{r.all.testsNext7.length === 1 ? '' : 's'} &middot; {r.all.activityHoursNext7} h sport/activities</div>
              </td>
              <td className="text-xs leading-relaxed text-[var(--text-muted)]">{r.flags.length ? r.flags.slice(0, 3).join(' \u00b7 ') : 'Up to date, steady week.'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-[var(--border)] px-4 py-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">How status is set: </span>{report.rules.join(' ')} &ldquo;Next 7 days&rdquo; = how full the week is after school (homework in all subjects, test revision, sport and events). <Smartphone className="inline size-3" /> = already using the Murshid app.
      </div>
    </Card>
  );
}

const GROUP_STYLE: Record<string, { tone: 'danger' | 'warning' | 'info' | 'success'; icon: typeof Users }> = {
  support: { tone: 'danger', icon: TriangleAlert }, lighten: { tone: 'warning', icon: CalendarCheck2 }, core: { tone: 'info', icon: Users }, extension: { tone: 'success', icon: CheckCircle2 },
};

export function Delegation({ rec }: { rec: any }) {
  return (
    <div className="space-y-4">
      <div className="card flex items-start gap-3 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-[var(--info)]" />
        <div className="text-sm"><span className="font-medium">For the next task: </span>{rec.summary}</div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {rec.groups.map((g: any) => {
          const st = GROUP_STYLE[g.id]!;
          const Icon = st.icon;
          return (
            <Card key={g.id} title={<span className="flex items-center gap-2"><Icon className="size-4" style={{ color: `var(--${st.tone})` }} />{g.title} <Badge tone={st.tone}>{g.students.length}</Badge></span>}>
              <p className="text-sm">{g.action}</p>
              <ul className="mt-3 space-y-1.5">
                {g.students.map((s: any) => (
                  <li key={s.id} className="text-sm leading-snug"><span className="font-medium">{s.name}</span> <span className="text-xs text-[var(--text-muted)]">&mdash; {s.reason}</span></li>
                ))}
                {!g.students.length && <li className="text-xs text-[var(--text-muted)]">Nobody this week.</li>}
              </ul>
            </Card>
          );
        })}
      </div>
      <div className="grid grid-cols-[1.3fr_1fr] gap-4">
        <Card title="Peer partners">
          {rec.pairs.length ? (
            <ul className="space-y-2.5">
              {rec.pairs.map((p: any) => (
                <li key={p.support.id} className="text-sm"><span className="font-medium">{p.partner.name}</span> <span className="text-[var(--text-muted)]">with</span> <span className="font-medium">{p.support.name}</span><div className="text-xs text-[var(--text-muted)]">{p.reason}</div></li>
              ))}
            </ul>
          ) : <p className="text-sm text-[var(--text-muted)]">No pairs needed.</p>}
        </Card>
        <Card title="Mixed groups for group work">
          <ul className="space-y-2">
            {rec.mixedGroups.map((g: any) => (
              <li key={g.name} className="text-sm"><span className="font-medium">{g.name}:</span> <span className="text-[var(--text-muted)]">{g.students.join(', ')}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">{rec.rules.join(' ')}</p>
    </div>
  );
}

function cellStyle(v: number): React.CSSProperties {
  const color = v >= 80 ? 'var(--success)' : v >= 65 ? 'var(--warning)' : 'var(--danger)';
  const pct = v >= 80 ? 10 + (v - 80) * 1.2 : v >= 65 ? 14 : 12;
  return { background: `color-mix(in oklab, ${color} ${pct}%, var(--surface))`, borderColor: `color-mix(in oklab, ${color} 35%, var(--border))` };
}

export function HomeworkTiming({ t, minutes, onMinutes, onUse }: { t: any; minutes: number; onMinutes: (m: number) => void; onUse: (set: string, due: string) => void }) {
  const [showMethod, setShowMethod] = useState(false);
  const cells: any[] = t.heatmap.cells;
  const max = Math.max(...t.days.map((d: any) => d.loadPct), 100);
  return (
    <div className="space-y-4">
      <div className="card overflow-hidden" data-testid="best-day">
        <div className="on-deep flex items-center justify-between gap-8 rounded-[var(--radius-lg)] p-7">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Recommendation for a {t.minutes}-minute task</div>
            <div className="display mt-4 text-[1.75rem] leading-tight">{t.best.headline}</div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/68">{t.best.reason}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="text-right"><div className="figure text-[4rem] text-[var(--spark)]">{t.best.likelihood}%</div><div className="mt-2 text-xs text-white/65">{t.best.onTime} of {t.students} likely on time</div>{t.best.atRisk ? <div className="mt-0.5 text-xs font-medium text-[#f3c76f]">{t.best.atRisk} at risk &middot; extra support</div> : null}</div>
            <button onClick={() => onUse(t.best.set, t.best.due)} className="group mt-1 inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-[var(--deep)] transition-colors hover:bg-[var(--brand-light)] hover:text-white">Set it for {t.best.setLabel}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="nudge size-4" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </div>
        </div>
        <div className="flex items-start gap-2 border-t border-[var(--border)] px-5 py-2.5 text-xs text-[var(--text-muted)]"><TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--danger)]" /><span><span className="font-medium text-[var(--text)]">Avoid {t.avoid.setLabel} &rarr; {t.avoid.dueLabel}.</span> {t.avoid.reason}</span></div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1fr]">
        <Card title="On-time likelihood by set day and due day" action={
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">Task length
            <select aria-label="Task length" className="input h-7 w-24 py-0 text-xs" value={minutes} onChange={(e) => onMinutes(Number(e.target.value))}>
              {[20, 30, 40, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>}>
          <table className="w-full border-separate" style={{ borderSpacing: 6 }}>
            <thead><tr><th className="text-left text-xs font-medium text-[var(--text-muted)]">Set on</th>{t.heatmap.dueOffsets.map((k: number) => <th key={k} className="text-xs font-medium text-[var(--text-muted)]">Due +{k} school day{k > 1 ? 's' : ''}</th>)}</tr></thead>
            <tbody>
              {t.heatmap.setDays.map((sd: any) => (
                <tr key={sd.date}>
                  <td className="whitespace-nowrap pr-1 text-sm font-medium">{sd.label}</td>
                  {cells.filter((c) => c.set === sd.date).map((c) => (
                    <td key={c.due} className={cn('rounded-[var(--radius-sm)] border px-2 py-1.5 text-center', c.best && 'ring-[1.5px] ring-[var(--success)]')} style={cellStyle(c.likelihood)}>
                      <div className="text-base font-semibold tabular-nums text-[var(--text)]">{c.likelihood}%</div>
                      <div className="whitespace-nowrap text-[11px] text-[color-mix(in_oklab,var(--text-muted)_55%,var(--text))]">due {c.dueLabel}{c.weekend ? ' \u00b7 wknd' : ''}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="How full the class&rsquo;s days are" action={<span className="text-[11px] text-[var(--text-muted)]">avg after-school load, all subjects</span>}>
          <div className="flex h-[188px] items-end gap-1.5">
            {t.days.map((d: any) => (
              <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.loadPct}% full${d.items.length ? ` \u2014 ${d.items.join(', ')}` : ''}`}>
                <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{d.loadPct}%</span>
                <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max(4, (Math.min(d.loadPct, max) / max) * 130)}px`, background: d.level === 'heavy' ? 'var(--danger)' : d.level === 'moderate' ? 'var(--warning)' : 'var(--success)', opacity: d.schoolDay ? 0.85 : 0.45 }} />
                <span className="whitespace-nowrap text-[10px] font-medium">{d.label.split(' ').slice(0, 2).join(' ')}</span>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-xs">
            {t.days.filter((d: any) => d.items.length).slice(0, 6).map((d: any) => (
              <li key={d.date} className="flex gap-2"><span className="w-[72px] shrink-0 font-medium">{d.label}</span><span className="min-w-0 text-[var(--text-muted)]">{d.items.join(', ')}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="text-xs text-[var(--text-muted)]">
        <button onClick={() => setShowMethod((s) => !s)} className="inline-flex items-center gap-1 font-medium text-[var(--text)] underline-offset-2 hover:underline"><Info className="size-3.5" />How this is worked out</button>
        {showMethod && <ul className="mt-2 list-disc space-y-1 ps-5">{t.method.map((m: string) => <li key={m}>{m}</li>)}</ul>}
      </div>
    </div>
  );
}

export function WeeklyReports({ w, week, onWeek }: { w: any; week: 'current' | 'last'; onWeek: (w: 'current' | 'last') => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const r = w.rollup;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(['current', 'last'] as const).map((k) => (
            <button key={k} onClick={() => onWeek(k)} className={cn('h-8 rounded-full border px-3 text-sm', week === k ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-muted)]')}>{k === 'current' ? 'This week' : 'Last week'}</button>
          ))}
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          Week of {shortDate(w.weekStart)} &middot; {w.status === 'submitted' ? <span className="font-medium text-[var(--success)]">submitted automatically {shortDate(w.weekEnd)}, 4:00 PM</span> : <span>drafts &middot; each student&rsquo;s report sends itself on {shortDate(w.weekEnd)} at 4:00 PM</span>}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-6"><div className="eyebrow">Reports in</div><div className="figure mt-4 text-[2.25rem]">{r.submitted}/{r.students}</div></div>
        <div className="card p-6"><div className="eyebrow">Work handed in (all subjects)</div><div className="figure mt-4 text-[2.25rem]">{r.avgCompletion}%</div></div>
        <div className="card p-6"><div className="eyebrow">Students with overdue work</div><div className="figure mt-4 text-[2.25rem]">{r.withOverdue}</div></div>
        <div className="card min-w-0 p-6"><div className="eyebrow">Coming up</div><div className="mt-4 space-y-1 text-xs">{r.pressure.map((p: any) => <div key={p.title} className="leading-snug"><span className="font-medium">{p.title}</span> <span className="text-[var(--text-muted)]">&middot; {p.students}</span></div>)}</div></div>
      </div>
      <Card pad={false} title="Student reports">
        <table className="tbl">
          <thead><tr><th>Student</th><th>Handed in</th><th>Done this week</th><th>Overdue</th><th>Still to do (7 days)</th><th>Tests</th><th className="w-[38%]">Report</th></tr></thead>
          <tbody>
            {w.reports.map((x: any) => (
              <tr key={x.studentId} className="cursor-pointer" onClick={() => setOpen(open === x.studentId ? null : x.studentId)}>
                <td className="whitespace-nowrap font-medium">{x.name}{x.appId && <Smartphone className="ml-1.5 inline size-3.5 text-[var(--success)]" aria-label="Uses the Murshid app" />}</td>
                <td className="tabular-nums">{x.completion}%</td>
                <td className="tabular-nums">{x.completed}</td>
                <td>{x.overdue.length ? <Badge tone="danger">{x.overdue.length}</Badge> : <span className="text-xs text-[var(--text-muted)]">0</span>}</td>
                <td className="tabular-nums">{x.remaining.length}</td>
                <td className="tabular-nums">{x.upcomingTests.length}</td>
                <td className="text-xs leading-relaxed text-[var(--text-muted)]">
                  {x.summary}
                  {open === x.studentId && (
                    <div className="mt-2 space-y-1 text-[var(--text)]">
                      {x.remaining.map((it: any) => <div key={it.title + it.dueDate}>&bull; {it.subject}: {it.title} <span className="text-[var(--text-muted)]">(due {shortDate(it.dueDate)})</span></div>)}
                      {x.overdue.map((it: any) => <div key={it.title + it.dueDate} className="text-[var(--danger)]">&bull; Overdue: {it.subject}: {it.title}</div>)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
