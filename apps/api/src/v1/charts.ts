/** Rule-based ChartSpec builders for GET /progress and the chat `render_chart` tool. */
import type { ChartSpec, ProgressRange } from '@murshid/core';
import { addDays } from '../lib/time';
import {
  activityLabel, clamp, currentTerm, dayDiff, goalProgress, goalStates, goalValueAt, mondayOfDate, round, subjectScoreAt,
} from './data';
import type { DemoView } from './store';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const color = (i: number) => `var(--chart-${(i % 6) + 1})`;
const RANGE_TEXT: Record<ProgressRange, string> = { '4w': 'the last 4 weeks', '12w': 'the last 12 weeks', term: 'this term', year: 'the past year' };
const RANGE_TITLE: Record<ProgressRange, string> = { '4w': 'Last 4 weeks', '12w': 'Last 12 weeks', term: 'This term', year: 'Past 12 months' };

export interface Bucket { key: string; label: string; start: string; end: string; days: number }

export function bucketsFor(range: ProgressRange, today: string): Bucket[] {
  const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
  const week = (start: string): Bucket => {
    const end = addDays(start, 6) < today ? addDays(start, 6) : today;
    return { key: start, label: dayLabel(start), start, end, days: dayDiff(start, end) + 1 };
  };
  const thisMon = mondayOfDate(today);
  if (range === '4w' || range === '12w') {
    const n = range === '4w' ? 4 : 12;
    return Array.from({ length: n }, (_, i) => week(addDays(thisMon, -7 * (n - 1 - i))));
  }
  if (range === 'term') {
    const out: Bucket[] = [];
    for (let m = mondayOfDate(currentTerm(today).start); m <= thisMon; m = addDays(m, 7)) out.push(week(m));
    return out;
  }
  const out: Bucket[] = [];
  let y = Number(today.slice(0, 4));
  let mo = Number(today.slice(5, 7));
  for (let i = 0; i < 12; i++) {
    const start = `${y}-${String(mo).padStart(2, '0')}-01`;
    const nextStart = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
    const end = addDays(nextStart, -1) < today ? addDays(nextStart, -1) : today;
    out.unshift({ key: start.slice(0, 7), label: MONTHS[mo - 1]!, start, end, days: dayDiff(start, end) + 1 });
    mo--;
    if (mo === 0) { mo = 12; y--; }
  }
  return out;
}

// ---------- areas ----------
export type ResolvedArea =
  | { kind: 'activity'; id: string; label: string }
  | { kind: 'academics'; id: 'academics'; label: string }
  | { kind: 'subject'; id: string; label: string }
  | { kind: 'goal'; id: string; label: string }
  | { kind: 'extracurriculars'; id: 'extracurriculars'; label: string }
  | { kind: 'goals'; id: 'goals'; label: string }
  | { kind: 'project'; id: string; label: string };

export class AreaNotFound extends Error {
  constructor(public area: string, public available: string[]) {
    super(`no progress data for area "${area}"`);
  }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, '-');

export function listAreas(v: DemoView): ResolvedArea[] {
  return [
    { kind: 'academics', id: 'academics', label: 'Academics' },
    ...v.profile.subjects.map((s) => ({ kind: 'subject' as const, id: s.id, label: s.name })),
    { kind: 'extracurriculars', id: 'extracurriculars', label: 'Extracurriculars' },
    ...v.profile.activities.map((a) => ({ kind: 'activity' as const, id: a.id, label: activityLabel(a.id) })),
    { kind: 'goals', id: 'goals', label: 'Goals' },
    ...v.profile.goals.map((g) => ({ kind: 'goal' as const, id: g.id, label: g.title })),
    ...v.record.projects.filter((p) => (v.data.projectSeries[p.id] ?? []).length).map((p) => ({ kind: 'project' as const, id: p.id, label: p.name })),
  ];
}

function projectChart(v: DemoView, id: string, range: ProgressRange): ChartSpec {
  const p = v.record.projects.find((x) => x.id === id)!;
  const series = v.data.projectSeries[id] ?? [];
  const months = range === 'year' ? 12 : range === 'term' ? 4 : range === '12w' ? 3 : 2;
  const rows = series.slice(-months).map((x) => ({ period: x.month, label: MONTHS[Number(x.month.slice(5, 7)) - 1]!, revenue: x.revenue, orders: x.orders, customers: x.customers }));
  const total = rows.reduce((t, r) => t + r.revenue, 0);
  const full = rows.slice(0, -1);
  const best = [...full].sort((a, b) => b.revenue - a.revenue)[0];
  const last = rows[rows.length - 1];
  const insight = rows.length
    ? `AED ${total.toLocaleString('en-US')} revenue over the last ${rows.length} months; ${last!.customers} customers so far.` + (best ? ` Best full month: ${best.label} (AED ${best.revenue.toLocaleString('en-US')}).` : '')
    : 'No revenue recorded yet.';
  return {
    id: `${id}-${range}`, type: 'bar', title: p.name, subtitle: `Monthly revenue (AED) · ${p.tagline}`, unit: 'AED', xKey: 'label',
    series: [{ key: 'revenue', label: 'Revenue (AED)', color: color(0) }, { key: 'orders', label: 'Orders', color: color(2) }],
    data: rows, insight, generatedBy: 'rules',
  };
}

export function resolveArea(v: DemoView, raw: string): ResolvedArea {
  const a = norm(raw);
  const alias: Record<string, string> = { hackathons: 'hackathon', extracurricular: 'extracurriculars', activities: 'extracurriculars', academic: 'academics', grades: 'academics', goal: 'goals' };
  const key = alias[a] ?? a;
  const all = listAreas(v);
  const hit = all.find((x) => x.id === key) ?? all.find((x) => x.kind === 'subject' && norm(x.label) === key);
  if (!hit) throw new AreaNotFound(raw, all.map((x) => x.id));
  return hit;
}

// ---------- builders ----------
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`);
const pctChange = (a: number, b: number) => (a === 0 ? 0 : Math.round(((b - a) / a) * 100));

function activityMinutes(v: DemoView, id: string, b: Bucket): { minutes: number; sessions: number } {
  const xs = v.sessions.filter((s) => s.activityId === id && s.date >= b.start && s.date <= b.end);
  return { minutes: xs.reduce((s, x) => s + x.minutes, 0), sessions: xs.length };
}

function activityChart(v: DemoView, id: string, range: ProgressRange, buckets: Bucket[]): ChartSpec {
  const def = v.profile.activities.find((a) => a.id === id)!;
  const label = activityLabel(id);
  const event = Boolean(def.eventEveryWeeks);
  const rows = buckets.map((b): Record<string, string | number> => {
    const { minutes, sessions } = activityMinutes(v, id, b);
    return event ? { period: b.key, label: b.label, hours: round(minutes / 60, 1), events: sessions } : { period: b.key, label: b.label, minutes, sessions };
  });
  const inRange = v.sessions.filter((s) => s.activityId === id && s.date >= buckets[0]!.start && s.date <= v.data.today);
  const total = inRange.reduce((s, x) => s + x.minutes, 0);
  const parts: string[] = [];
  if (event) {
    const places = inRange.map((s) => s.metrics.placement).filter((x): x is number => typeof x === 'number');
    parts.push(inRange.length
      ? `${inRange.length} ${inRange.length === 1 ? 'event' : 'events'} and ${round(total / 60, 1)} hours of building over ${RANGE_TEXT[range]}.`
      : `No hackathons over ${RANGE_TEXT[range]}.`);
    if (places.length) parts.push(`Best placement: #${Math.min(...places)}.`);
    const next = v.data.events.find((e) => e.activityId === id);
    if (next) parts.push(`Next up: ${next.title} on ${next.date}.`);
  } else {
    const avg = Math.round(total / Math.max(1, buckets.length));
    const last = (rows[rows.length - 1] as { minutes: number }).minutes;
    const lastFull = buckets.length > 1 ? (rows[rows.length - 2] as { minutes: number }).minutes : last;
    parts.push(`${fmtMin(total)} of ${label.toLowerCase()} over ${RANGE_TEXT[range]} (about ${fmtMin(avg)} per ${range === 'year' ? 'month' : 'week'}).`);
    if (range !== 'year' && def.weeklyTargetMinutes) {
      const hit = rows.filter((r) => (r as { minutes: number }).minutes >= def.weeklyTargetMinutes).length;
      parts.push(`You hit your ${def.weeklyTargetMinutes}-minute weekly target in ${hit} of ${rows.length} weeks.`);
    } else if (avg) {
      const delta = pctChange(avg, lastFull);
      if (Math.abs(delta) >= 5) parts.push(`Last full period was ${Math.abs(delta)}% ${delta > 0 ? 'above' : 'below'} your average.`);
    }
    const m = def.metrics[0];
    if (m) {
      const vals = inRange.map((s) => s.metrics[m.key]).filter((x): x is number => typeof x === 'number');
      if (vals.length >= 2) {
        const best = m.better === 'lower' ? Math.min(...vals) : Math.max(...vals);
        const first = vals[0]!;
        const improved = m.better === 'lower' ? best < first : best > first;
        parts.push(improved ? `${m.label} best: ${best}${m.unit === 's' ? 's' : ` ${m.unit}`} (from ${first}${m.unit === 's' ? 's' : ` ${m.unit}`}).` : `${m.label} is holding at ${best}${m.unit === 's' ? 's' : ` ${m.unit}`}.`);
      }
    }
  }
  return {
    id: `${id}-${range}`, type: 'bar', title: label, subtitle: `${def.detail} · ${RANGE_TITLE[range]}`, unit: event ? 'h' : 'min', xKey: 'label',
    series: event ? [{ key: 'hours', label: 'Hours', color: color(0) }] : [{ key: 'minutes', label: 'Minutes', color: color(0) }],
    data: rows, insight: parts.join(' '), generatedBy: 'rules',
  };
}

function subjectRows(v: DemoView, ids: string[], buckets: Bucket[]) {
  return buckets.map((b) => {
    const row: Record<string, string | number> = { period: b.key, label: b.label };
    for (const id of ids) {
      const s = subjectScoreAt(v.data.assessments, id, b.end);
      if (s !== null) row[id] = s;
    }
    return row;
  });
}

function academicsChart(v: DemoView, range: ProgressRange, buckets: Bucket[]): ChartSpec {
  const subs = v.profile.subjects.slice(0, 6);
  const data = subjectRows(v, subs.map((s) => s.id), buckets);
  const avgOf = (row: Record<string, string | number>) => {
    const xs = subs.map((s) => row[s.id]).filter((x): x is number => typeof x === 'number');
    return xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 1) : 0;
  };
  const first = data[0]!;
  const last = data[data.length - 1]!;
  const deltas = subs.map((s) => ({ s, d: round(Number(last[s.id] ?? 0) - Number(first[s.id] ?? 0), 1) })).sort((a, b) => b.d - a.d);
  const a0 = avgOf(first);
  const a1 = avgOf(last);
  const top = deltas[0]!;
  const insight = `Your average is ${a1}% (${a1 >= a0 ? '+' : ''}${round(a1 - a0, 1)} over ${RANGE_TEXT[range]}).` +
    (top.d > 0 ? ` Biggest climb: ${top.s.name} (+${top.d}).` : '') +
    (deltas[deltas.length - 1]!.d < -1 ? ` Keep an eye on ${deltas[deltas.length - 1]!.s.name}.` : '');
  return {
    id: `academics-${range}`, type: 'line', title: 'Academics', subtitle: `Rolling average of your last 3 results · ${RANGE_TITLE[range]}`,
    unit: '%', xKey: 'label', series: subs.map((s, i) => ({ key: s.id, label: s.name, color: color(i) })), data, insight, generatedBy: 'rules',
  };
}

function subjectChart(v: DemoView, id: string, range: ProgressRange, buckets: Bucket[]): ChartSpec {
  const s = v.profile.subjects.find((x) => x.id === id)!;
  const data = subjectRows(v, [id], buckets).map((r) => ({ period: r.period!, label: r.label!, score: r[id] ?? 0, target: s.target }));
  const first = Number(data[0]!.score);
  const last = Number(data[data.length - 1]!.score);
  const gap = round(s.target - last, 1);
  const recent = v.data.assessments.filter((a) => a.subjectId === id && a.status === 'graded').slice(-1)[0];
  const next = v.data.assessments.find((a) => a.subjectId === id && a.status === 'upcoming');
  const insight = `${s.name} is at ${last}% (${last >= first ? 'up' : 'down'} ${Math.abs(round(last - first, 1))} points over ${RANGE_TEXT[range]}). ` +
    (gap > 0 ? `${gap} points to your ${s.target}% target.` : `You're above your ${s.target}% target.`) +
    (recent ? ` Latest: ${recent.percent}% on ${recent.title}.` : '') +
    (next ? ` Next: ${next.title} on ${next.date}.` : '');
  return {
    id: `${id}-${range}`, type: 'area', title: s.name, subtitle: `${s.teacher} · ${RANGE_TITLE[range]}`, unit: '%', xKey: 'label',
    series: [{ key: 'score', label: 'Score', color: color(0) }, { key: 'target', label: 'Target', color: color(3) }],
    data, insight, generatedBy: 'rules',
  };
}

function goalChart(v: DemoView, id: string, range: ProgressRange, buckets: Bucket[]): ChartSpec {
  const def = v.profile.goals.find((g) => g.id === id)!;
  const state = goalStates(v.profile, v.data, v.sessions).find((g) => g.id === id)!;
  const data = buckets.map((b) => ({ period: b.key, label: b.label, value: goalValueAt(def, v.data, v.sessions, b.end), target: def.target }));
  const unit = def.unit === '%' ? '%' : ` ${def.unit}`;
  const insight = state.progress >= 100
    ? `Goal reached: ${state.current}${unit} against a target of ${def.target}${unit}.`
    : `${state.progress}% of the way: ${state.current}${unit} now, target ${def.target}${unit} by ${state.dueDate}.`;
  return {
    id: `${id}-${range}`, type: 'line', title: def.title, subtitle: RANGE_TITLE[range], unit: def.unit, xKey: 'label',
    series: [{ key: 'value', label: 'You', color: color(0) }, { key: 'target', label: 'Target', color: color(3) }],
    data, insight, generatedBy: 'rules',
  };
}

function extracurricularsChart(v: DemoView, range: ProgressRange, buckets: Bucket[]): ChartSpec {
  const acts = v.profile.activities;
  const data = buckets.map((b) => {
    const row: Record<string, string | number> = { period: b.key, label: b.label };
    for (const a of acts) row[a.id] = activityMinutes(v, a.id, b).minutes;
    return row;
  });
  const totals = acts.map((a) => ({ a, m: data.reduce((s, r) => s + Number(r[a.id]), 0) })).sort((x, y) => y.m - x.m);
  const all = totals.reduce((s, x) => s + x.m, 0);
  const insight = all
    ? `${round(all / 60, 1)} hours of activities over ${RANGE_TEXT[range]}; ${activityLabel(totals[0]!.a.id)} took the most time (${Math.round((totals[0]!.m / all) * 100)}%).`
    : `No activity sessions logged over ${RANGE_TEXT[range]}.`;
  return {
    id: `extracurriculars-${range}`, type: 'stacked-bar', title: 'Activities', subtitle: `Minutes per ${range === 'year' ? 'month' : 'week'} · ${RANGE_TITLE[range]}`,
    unit: 'min', xKey: 'label', series: acts.map((a, i) => ({ key: a.id, label: activityLabel(a.id), color: color(i) })), data, insight, generatedBy: 'rules',
  };
}

function goalsChart(v: DemoView, range: ProgressRange): ChartSpec {
  const goals = goalStates(v.profile, v.data, v.sessions);
  const data = goals.map((g) => ({ goal: g.title, id: g.id, progress: g.progress }));
  const best = [...goals].sort((a, b) => b.progress - a.progress)[0];
  const insight = best ? `Closest to done: ${best.title} (${best.progress}%).` : 'No goals yet.';
  return {
    id: `goals-${range}`, type: 'radial', title: 'Goals', subtitle: 'Progress toward each goal', unit: '%', xKey: 'goal',
    series: [{ key: 'progress', label: 'Progress', color: color(0) }], data, insight, generatedBy: 'rules',
  };
}

function compareChart(v: DemoView, areas: ResolvedArea[], range: ProgressRange, buckets: Bucket[]): ChartSpec {
  const series = areas.map((a, i) => ({ key: a.id, label: a.label, color: color(i) }));
  const id = `compare-${areas.map((a) => a.id).join('-')}-${range}`;
  const title = areas.map((a) => a.label).join(' vs ');
  if (areas.every((a) => a.kind === 'activity')) {
    const data = buckets.map((b) => {
      const row: Record<string, string | number> = { period: b.key, label: b.label };
      for (const a of areas) row[a.id] = activityMinutes(v, a.id, b).minutes;
      return row;
    });
    const totals = areas.map((a) => ({ a, m: data.reduce((s, r) => s + Number(r[a.id]), 0) })).sort((x, y) => y.m - x.m);
    const [top, second] = totals;
    const insight = second && second.m > 0
      ? `${top!.a.label}: ${fmtMin(top!.m)} vs ${second.a.label}: ${fmtMin(second.m)} over ${RANGE_TEXT[range]} — ${round(top!.m / second.m, 1)}× the time.`
      : `${top!.a.label}: ${fmtMin(top!.m)} over ${RANGE_TEXT[range]}.`;
    return { id, type: 'bar', title, subtitle: `Minutes · ${RANGE_TITLE[range]}`, unit: 'min', xKey: 'label', series, data, insight, generatedBy: 'rules' };
  }
  if (areas.every((a) => a.kind === 'subject' || a.kind === 'academics')) {
    const subs = v.profile.subjects;
    const data = buckets.map((b) => {
      const row: Record<string, string | number> = { period: b.key, label: b.label };
      for (const a of areas) {
        const ids = a.kind === 'academics' ? subs.map((s) => s.id) : [a.id];
        const xs = ids.map((sid) => subjectScoreAt(v.data.assessments, sid, b.end)).filter((x): x is number => x !== null);
        if (xs.length) row[a.id] = round(xs.reduce((p, q) => p + q, 0) / xs.length, 1);
      }
      return row;
    });
    const last = data[data.length - 1]!;
    const first = data[0]!;
    const ranked = areas.map((a) => ({ a, now: Number(last[a.id] ?? 0), d: round(Number(last[a.id] ?? 0) - Number(first[a.id] ?? 0), 1) }));
    const lead = [...ranked].sort((x, y) => y.now - x.now)[0]!;
    const climb = [...ranked].sort((x, y) => y.d - x.d)[0]!;
    const insight = `${lead.a.label} leads at ${lead.now}%.` + (climb.d > 0 ? ` ${climb.a.label} improved the most (+${climb.d}) over ${RANGE_TEXT[range]}.` : '');
    return { id, type: 'line', title, subtitle: `Score · ${RANGE_TITLE[range]}`, unit: '%', xKey: 'label', series, data, insight, generatedBy: 'rules' };
  }
  // mixed units: each area as % of its own target
  const goalsById = new Map(v.profile.goals.map((g) => [g.id, g]));
  const data = buckets.map((b) => {
    const row: Record<string, string | number> = { period: b.key, label: b.label };
    for (const a of areas) {
      let val: number | null = null;
      if (a.kind === 'activity') {
        const def = v.profile.activities.find((x) => x.id === a.id)!;
        const { minutes, sessions } = activityMinutes(v, a.id, b);
        val = def.weeklyTargetMinutes ? (minutes / (def.weeklyTargetMinutes * (b.days / 7))) * 100 : sessions * 100;
      } else if (a.kind === 'subject') {
        const s = v.profile.subjects.find((x) => x.id === a.id)!;
        const sc = subjectScoreAt(v.data.assessments, a.id, b.end);
        val = sc === null ? null : (sc / s.target) * 100;
      } else if (a.kind === 'academics') {
        const xs = v.profile.subjects.map((s) => { const sc = subjectScoreAt(v.data.assessments, s.id, b.end); return sc === null ? null : (sc / s.target) * 100; }).filter((x): x is number => x !== null);
        val = xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : null;
      } else if (a.kind === 'goal') {
        const g = goalsById.get(a.id)!;
        val = goalProgress(g, goalValueAt(g, v.data, v.sessions, b.end));
      }
      if (val !== null) row[a.id] = Math.round(clamp(val, 0, 200));
    }
    return row;
  });
  const avg = (k: string) => { const xs = data.map((r) => r[k]).filter((x): x is number => typeof x === 'number'); return xs.length ? Math.round(xs.reduce((p, q) => p + q, 0) / xs.length) : 0; };
  const ranked = areas.map((a) => ({ a, v: avg(a.id) })).sort((x, y) => y.v - x.v);
  const insight = `Measured against your own targets over ${RANGE_TEXT[range]}: ${ranked.map((r) => `${r.a.label} ${r.v}%`).join(', ')}.`;
  return { id, type: 'line', title, subtitle: `% of your target · ${RANGE_TITLE[range]}`, unit: '%', xKey: 'label', series, data, insight, generatedBy: 'rules' };
}

/** Build a ChartSpec for one area, or a comparison when several are given. Throws AreaNotFound. */
export function buildChart(v: DemoView, areaInput: string | string[], range: ProgressRange): ChartSpec {
  const list = (Array.isArray(areaInput) ? areaInput : areaInput.split(',')).map((s) => s.trim()).filter(Boolean);
  const areas = list.map((a) => resolveArea(v, a)).filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i);
  if (!areas.length) throw new AreaNotFound('', listAreas(v).map((x) => x.id));
  const buckets = bucketsFor(range, v.data.today);
  if (areas.length > 1) {
    const flat = areas.flatMap((a) => (a.kind === 'extracurriculars'
      ? v.profile.activities.map((x) => ({ kind: 'activity' as const, id: x.id, label: activityLabel(x.id) }))
      : a.kind === 'goals' || a.kind === 'project' ? [] : [a]));
    return compareChart(v, flat.slice(0, 6), range, buckets);
  }
  const a = areas[0]!;
  switch (a.kind) {
    case 'activity': return activityChart(v, a.id, range, buckets);
    case 'academics': return academicsChart(v, range, buckets);
    case 'subject': return subjectChart(v, a.id, range, buckets);
    case 'goal': return goalChart(v, a.id, range, buckets);
    case 'extracurriculars': return extracurricularsChart(v, range, buckets);
    case 'goals': return goalsChart(v, range);
    case 'project': return projectChart(v, a.id, range);
  }
}
