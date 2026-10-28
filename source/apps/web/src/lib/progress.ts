/**
 * Rule-based ChartSpec builder over the mock world (mirrors GET /progress).
 * Pure: (world, query) → ChartSpec. Used by the mock client, the chat intent parser and the Insights studio.
 */
import { addDays, formatDate, startOfWeek } from './dates';
import { hash, type MockWorld } from './mock/data';
import type { Activity, ChartRange, ChartSpec, ChartType, Subject } from './types';

export type Locale = 'en' | 'ar';

export interface ProgressQuery {
  /** activity area ('gym', 'athletics', 'hackathon', …), activity id, 'academics', subject id, 'goals', 'extracurriculars', or 'balance' */
  area: string;
  range: ChartRange;
  type?: ChartType;
  /** subject ids to compare (2+) */
  compare?: string[];
  locale?: Locale;
}

export const RANGE_LABEL: Record<ChartRange, { en: string; ar: string }> = {
  '4w': { en: 'last 4 weeks', ar: 'آخر ٤ أسابيع' },
  '12w': { en: 'last 12 weeks', ar: 'آخر ١٢ أسبوعاً' },
  term: { en: 'this term', ar: 'هذا الفصل' },
  year: { en: 'this year', ar: 'هذا العام' },
};

interface Bucket { start: string; end: string; label: string }

export function buckets(range: ChartRange, today: string, locale: Locale = 'en'): Bucket[] {
  if (range === 'year') {
    const out: Bucket[] = [];
    const [y, m] = today.split('-').map(Number) as [number, number];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - 1 - i, 1));
      const start = d.toISOString().slice(0, 10);
      const end = addDays(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString().slice(0, 10), -1);
      out.push({ start, end, label: formatDate(start, locale, { month: 'short' }) });
    }
    return out;
  }
  const n = range === '4w' ? 4 : range === '12w' ? 12 : 14;
  const thisWeek = startOfWeek(today);
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(thisWeek, -(n - 1 - i) * 7);
    return { start, end: addDays(start, 6), label: formatDate(start, locale) };
  });
}

const ACTIVITY_AREAS = ['athletics', 'gym', 'hackathon', 'football', 'piano', 'coding', 'debate', 'art', 'swimming'];

export function findActivity(world: MockWorld, area: string): Activity | undefined {
  const acts = world.extracurriculars.activities;
  return acts.find((a) => a.id === area) ?? acts.find((a) => a.area === area) ?? (area === 'club' ? acts.find((a) => a.kind === 'club') : undefined);
}

const SUBJECT_ALIASES: Record<string, string[]> = {
  maths: ['math'], math: ['math'], physics: ['physics'], chemistry: ['chem'], biology: ['bio'], english: ['english', 'ela'],
  arabic: ['arabic'], science: ['science'], cs: ['computer', 'computing'], economics: ['econ'], history: ['history'],
};

export function findSubject(world: MockWorld, id: string): Subject | undefined {
  const subs = world.academics.subjects;
  const key = id.toLowerCase();
  const direct = subs.find((s) => s.id === key) ?? subs.find((s) => s.id.startsWith(key) || s.name.toLowerCase().startsWith(key));
  if (direct) return direct;
  const words = SUBJECT_ALIASES[key];
  if (!words) return undefined;
  return subs.find((s) => words.some((w) => s.name.toLowerCase().startsWith(w) || s.id.startsWith(w)))
    ?? subs.find((s) => words.some((w) => s.name.toLowerCase().includes(w)));
}

/** "86%" or "6/7" depending on the grading scale. */
export function fmtScore(v: number, scale: Subject['scale'] = 'percent'): string {
  return scale === 'ib7' ? `${Math.round(v * 10) / 10}/7` : `${Math.round(v * 10) / 10}%`;
}
const unitOf = (s: Subject) => (s.scale === 'ib7' ? '/7' : '%');

/** Weekly mark series (52 weeks) interpolated through the subject's assessment trend, ending at `current`. */
function subjectWeekly(s: Subject): number[] {
  const pts = [...s.trend.slice(0, -1), s.current];
  const out: number[] = [];
  for (let w = 0; w < 52; w++) {
    const pos = (w / 51) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(pos));
    const f = pos - i;
    const v = pts[i]! + (pts[i + 1]! - pts[i]!) * f;
    const amp = s.scale === 'ib7' ? 0.12 : 1.2;
    const wobble = Math.sin(w * 1.7 + s.id.length) * amp * (1 - w / 60);
    out.push(Math.round((v + wobble) * (s.scale === 'ib7' ? 100 : 10)) / (s.scale === 'ib7' ? 100 : 10));
  }
  out[51] = s.current;
  return out;
}

function subjectSeriesOver(s: Subject, bs: Bucket[], today: string): number[] {
  const weekly = subjectWeekly(s);
  const thisWeek = startOfWeek(today);
  return bs.map((b) => {
    const weeksAgo = Math.max(0, Math.round((Date.parse(thisWeek) - Date.parse(startOfWeek(b.end > today ? today : b.end))) / (7 * 86400000)));
    return weekly[Math.max(0, 51 - weeksAgo)]!;
  });
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round(((a - b) / Math.abs(b)) * 100));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function halfChange(values: number[]): number {
  const h = Math.floor(values.length / 2);
  return pct(avg(values.slice(h)), avg(values.slice(0, h)));
}

const L = (locale: Locale, en: string, ar: string) => (locale === 'ar' ? ar : en);
// Placeholder id; buildChartSpec replaces it with a deterministic one (stable across server/client renders).
const nextId = (p: string) => p;

export function activitySpec(world: MockWorld, a: Activity, range: ChartRange, type: ChartType | undefined, locale: Locale): ChartSpec {
  const bs = buckets(range, world.today, locale);
  const rows = bs.map((b) => {
    const ss = a.sessions.filter((x) => x.date >= b.start && x.date <= b.end);
    const minutes = ss.reduce((m, x) => m + x.minutes, 0);
    const metrics = ss.filter((x) => x.metric).map((x) => x.metric!.value);
    const shipped = ss.filter((x) => x.minutes >= 300).length;
    const row: Record<string, string | number> = { x: b.label, hours: Math.round((minutes / 60) * 10) / 10, sessions: ss.length };
    if (metrics.length) row.metric = Math.round(avg(metrics) * 100) / 100;
    if (a.area === 'hackathon') row.projects = shipped;
    return row;
  });
  const metricName = a.sessions.find((x) => x.metric)?.metric;
  const hasMetric = !!metricName && rows.filter((r) => r.metric !== undefined).length >= 2;
  const rangeLabel = RANGE_LABEL[range][locale];
  const hours = rows.map((r) => Number(r.hours));
  const total = Math.round(hours.reduce((x, y) => x + y, 0) * 10) / 10;
  const change = halfChange(hours);
  const wantMetric = hasMetric && ((a.area !== 'hackathon' && (type === 'line' || type === 'area')) || (!type && (a.area === 'gym' || a.area === 'athletics' || a.area === 'swimming')));

  if (wantMetric) {
    const data = rows.filter((r) => r.metric !== undefined).map((r) => ({ x: r.x, metric: r.metric!, hours: r.hours }));
    const first = Number(data[0]!.metric), last = Number(data.at(-1)!.metric);
    const lowerIsBetter = metricName!.unit === 's' || metricName!.unit === 'min';
    const better = lowerIsBetter ? last < first : last > first;
    const delta = Math.round(Math.abs(last - first) * 10) / 10;
    return {
      id: nextId('chart'), type: type === 'area' ? 'area' : 'line',
      title: L(locale, `${a.name}: ${metricName!.name}`, `${a.name}: ${metricName!.name}`),
      subtitle: L(locale, `Average per period, ${rangeLabel}`, `المتوسط لكل فترة، ${rangeLabel}`),
      unit: metricName!.unit, xKey: 'x',
      series: [{ key: 'metric', label: metricName!.name, color: 'var(--chart-1)' }],
      data,
      insight: better
        ? L(locale, `${metricName!.name} improved by ${delta}${metricName!.unit} ${rangeLabel}, across ${total}h of training.`, `تحسّن ${metricName!.name} بمقدار ${delta}${metricName!.unit} ${rangeLabel}، خلال ${total} ساعة تدريب.`)
        : L(locale, `${metricName!.name} is holding steady (${delta}${metricName!.unit} change). Consistency first: ${total}h logged ${rangeLabel}.`, `${metricName!.name} ثابت تقريباً (تغيّر ${delta}${metricName!.unit}). الاستمرارية أولاً: ${total} ساعة ${rangeLabel}.`),
      generatedBy: 'rules',
    };
  }

  const series = a.area === 'hackathon' && type === 'stacked-bar'
    ? [{ key: 'hours', label: L(locale, 'Hours', 'ساعات'), color: 'var(--chart-1)' }, { key: 'projects', label: L(locale, 'Projects', 'مشاريع'), color: 'var(--chart-2)' }]
    : [{ key: 'hours', label: L(locale, 'Hours', 'ساعات'), color: 'var(--chart-1)' }];
  const projects = rows.reduce((m, r) => m + Number(r.projects ?? 0), 0);
  return {
    id: nextId('chart'), type: type && type !== 'pie' && type !== 'radial' ? type : 'bar',
    title: L(locale, `${a.name}: time spent`, `${a.name}: الوقت المستغرق`),
    subtitle: L(locale, `Hours per ${range === 'year' ? 'month' : 'week'}, ${rangeLabel}`, `ساعات لكل ${range === 'year' ? 'شهر' : 'أسبوع'}، ${rangeLabel}`),
    unit: 'h', xKey: 'x', series, data: rows.map((r) => ({ x: r.x, hours: r.hours, ...(a.area === 'hackathon' ? { projects: r.projects ?? 0 } : {}) })),
    insight: a.area === 'hackathon'
      ? L(locale, `${total}h on hackathons ${rangeLabel}${projects ? `, ${projects} project${projects > 1 ? 's' : ''} shipped` : ''}. ${change >= 0 ? 'Momentum is up' : 'A quieter stretch'} versus the first half.`, `${total} ساعة في الهاكاثونات ${rangeLabel}${projects ? `، و${projects} مشروع منجز` : ''}.`)
      : L(locale, `${total}h logged ${rangeLabel}; ${change >= 0 ? `up ${change}%` : `down ${-change}%`} in the second half versus the first.`, `${total} ساعة ${rangeLabel}؛ ${change >= 0 ? `ارتفاع ${change}%` : `انخفاض ${-change}%`} في النصف الثاني مقارنة بالأول.`),
    generatedBy: 'rules',
  };
}

function subjectsSpec(world: MockWorld, subs: Subject[], range: ChartRange, type: ChartType | undefined, locale: Locale, title?: string): ChartSpec {
  const bs = buckets(range, world.today, locale);
  const series = subs.map((s, i) => ({ key: s.id, label: s.name, color: `var(--chart-${(i % 6) + 1})` }));
  const cols = subs.map((s) => subjectSeriesOver(s, bs, world.today));
  const data = bs.map((b, i) => {
    const row: Record<string, string | number> = { x: b.label };
    subs.forEach((s, j) => { row[s.id] = cols[j]![i]!; });
    return row;
  });
  const deltas = subs.map((s, j) => ({ s, d: Math.round((cols[j]!.at(-1)! - cols[j]![0]!) * 10) / 10 }));
  const top = deltas.slice().sort((a, b) => b.d - a.d)[0]!;
  const rangeLabel = RANGE_LABEL[range][locale];
  let insight: string;
  if (subs.length === 1) {
    const s = subs[0]!;
    const gap = Math.round((s.target - s.current) * 10) / 10;
    const cur = fmtScore(s.current, s.scale), tgt = fmtScore(s.target, s.scale);
    insight = gap > 0
      ? L(locale, `${s.name} is at ${cur} (${top.d >= 0 ? '+' : ''}${top.d} ${rangeLabel}); ${gap} ${s.scale === 'ib7' ? 'point' : 'points'} to your ${tgt} target.`, `${s.name} عند ${cur} (${top.d >= 0 ? '+' : ''}${top.d} ${rangeLabel})؛ يتبقى ${gap} للوصول إلى هدفك ${tgt}.`)
      : L(locale, `${s.name} is at ${cur}, on or above your ${tgt} target. Keep it there.`, `${s.name} عند ${cur}، عند هدفك ${tgt} أو أعلى.`);
  } else if (subs.length === 2) {
    const [a, b] = subs as [Subject, Subject];
    const lead = a.current >= b.current ? a : b;
    const other = lead === a ? b : a;
    insight = L(locale,
      `${lead.name} leads ${other.name} by ${Math.round((lead.current - other.current) * 10) / 10} points. ${top.s.name} improved most ${rangeLabel} (${top.d >= 0 ? '+' : ''}${top.d}).`,
      `${lead.name} يتقدم على ${other.name} بفارق ${Math.round((lead.current - other.current) * 10) / 10} نقاط. ${top.s.name} تحسّن أكثر ${rangeLabel} (${top.d >= 0 ? '+' : ''}${top.d}).`);
  } else if (Math.abs(top.d) < (subs[0]!.scale === 'ib7' ? 0.15 : 0.6)) {
    const gap = subs.map((s) => ({ s, g: s.target - s.current })).sort((a, b) => b.g - a.g)[0]!;
    insight = gap.g > 0
      ? L(locale, `Average ${fmtScore(world.academics.average, world.academics.scale)}, steady ${rangeLabel}. Biggest gap to target: ${gap.s.name} (${Math.round(gap.g * 10) / 10}).`, `المعدل ${fmtScore(world.academics.average, world.academics.scale)}، ثابت ${rangeLabel}. أكبر فجوة عن الهدف: ${gap.s.name} (${Math.round(gap.g * 10) / 10}).`)
      : L(locale, `Average ${fmtScore(world.academics.average, world.academics.scale)}, steady ${rangeLabel} and on target everywhere.`, `المعدل ${fmtScore(world.academics.average, world.academics.scale)}، ثابت ${rangeLabel} وعند الهدف في كل المواد.`);
  } else {
    insight = L(locale, `Average ${fmtScore(world.academics.average, world.academics.scale)}. ${top.s.name} improved most ${rangeLabel} (${top.d >= 0 ? '+' : ''}${top.d}).`, `المعدل ${fmtScore(world.academics.average, world.academics.scale)}. ${top.s.name} تحسّن أكثر ${rangeLabel} (${top.d >= 0 ? '+' : ''}${top.d}).`);
  }
  if (type === 'bar' || type === 'pie' || type === 'radial') {
    // categorical: current vs target per subject
    return {
      id: nextId('chart'), type: type === 'pie' ? 'bar' : type, title: title ?? L(locale, 'Current vs target', 'الحالي مقابل الهدف'),
      subtitle: L(locale, 'Latest assessment', 'آخر تقييم'), unit: unitOf(subs[0]!), xKey: 'x',
      series: type === 'radial' ? [{ key: 'current', label: L(locale, 'Current', 'الحالي'), color: 'var(--chart-1)' }] : [{ key: 'current', label: L(locale, 'Current', 'الحالي'), color: 'var(--chart-1)' }, { key: 'target', label: L(locale, 'Target', 'الهدف'), color: 'var(--chart-6)' }],
      data: subs.map((s) => ({ x: s.name, current: s.current, target: s.target })), insight, generatedBy: 'rules',
    };
  }
  return {
    id: nextId('chart'), type: type === 'area' ? 'area' : 'line',
    title: title ?? (subs.length === 1 ? L(locale, `${subs[0]!.name} grade trend`, `اتجاه درجات ${subs[0]!.name}`) : L(locale, 'Grade trends', 'اتجاهات الدرجات')),
    subtitle: L(locale, `${subs[0]!.scale === 'ib7' ? 'IB grade (1–7)' : 'Percent'}, ${rangeLabel}`, `${subs[0]!.scale === 'ib7' ? 'درجة IB (١–٧)' : 'نسبة مئوية'}، ${rangeLabel}`), unit: unitOf(subs[0]!), xKey: 'x', series, data, insight, generatedBy: 'rules',
  };
}

function goalsSpec(world: MockWorld, type: ChartType | undefined, locale: Locale): ChartSpec {
  const data = world.goals.map((g) => ({ x: g.title, progress: Math.round(g.progress * 100) }));
  const best = data.slice().sort((a, b) => b.progress - a.progress)[0]!;
  return {
    id: nextId('chart'), type: type === 'bar' ? 'bar' : 'radial', title: L(locale, 'Goal progress', 'تقدّم الأهداف'),
    subtitle: L(locale, 'Percent complete', 'نسبة الإنجاز'), unit: '%', xKey: 'x',
    series: [{ key: 'progress', label: L(locale, 'Progress', 'التقدّم'), color: 'var(--chart-1)' }], data,
    insight: L(locale, `Closest to done: "${best.x}" at ${best.progress}%.`, `الأقرب للإنجاز: "${best.x}" بنسبة ${best.progress}%.`), generatedBy: 'rules',
  };
}

function balanceSpec(world: MockWorld, range: ChartRange, type: ChartType | undefined, locale: Locale): ChartSpec {
  const bs = buckets(range, world.today, locale);
  const acts = world.extracurriculars.activities;
  const from = bs[0]!.start;
  const to = bs.at(-1)!.end;
  const rangeLabel = RANGE_LABEL[range][locale];
  if (type === 'stacked-bar' || type === 'bar' || type === 'line' || type === 'area') {
    const data = bs.map((b) => {
      const row: Record<string, string | number> = { x: b.label };
      for (const a of acts) row[a.id] = Math.round(a.sessions.filter((x) => x.date >= b.start && x.date <= b.end).reduce((m, x) => m + x.minutes, 0) / 6) / 10;
      return row;
    });
    return {
      id: nextId('chart'), type: type === 'bar' ? 'stacked-bar' : type, title: L(locale, 'Activities over time', 'الأنشطة عبر الزمن'),
      subtitle: L(locale, `Hours, ${rangeLabel}`, `ساعات، ${rangeLabel}`), unit: 'h', xKey: 'x',
      series: acts.map((a, i) => ({ key: a.id, label: a.name, color: `var(--chart-${(i % 6) + 1})` })), data,
      insight: L(locale, `You trained ${acts.length} different activities ${rangeLabel}.`, `مارست ${acts.length} أنشطة مختلفة ${rangeLabel}.`), generatedBy: 'rules',
    };
  }
  const data = acts.map((a) => ({ x: a.name, hours: Math.round(a.sessions.filter((x) => x.date >= from && x.date <= to).reduce((m, x) => m + x.minutes, 0) / 6) / 10 }));
  const top = data.slice().sort((a, b) => b.hours - a.hours)[0]!;
  const total = Math.round(data.reduce((m, d) => m + d.hours, 0) * 10) / 10;
  return {
    id: nextId('chart'), type: type === 'radial' ? 'radial' : 'pie', title: L(locale, 'Where your time goes', 'أين يذهب وقتك'),
    subtitle: L(locale, `Hours by activity, ${rangeLabel}`, `الساعات حسب النشاط، ${rangeLabel}`), unit: 'h', xKey: 'x',
    series: [{ key: 'hours', label: L(locale, 'Hours', 'ساعات') }], data,
    insight: L(locale, `${top.x} takes the biggest share: ${top.hours}h of ${total}h ${rangeLabel}.`, `${top.x} يأخذ الحصة الأكبر: ${top.hours} من ${total} ساعة ${rangeLabel}.`), generatedBy: 'rules',
  };
}

export function buildChartSpec(world: MockWorld, q: ProgressQuery): ChartSpec {
  const spec = buildChartSpecInner(world, q);
  const key = `${world.band}|${q.area}|${q.range}|${q.type ?? ''}|${(q.compare ?? []).join(',')}|${q.locale ?? 'en'}`;
  return { ...spec, id: `chart-${hash(key).toString(36)}` };
}

function buildChartSpecInner(world: MockWorld, q: ProgressQuery): ChartSpec {
  const locale = q.locale ?? 'en';
  const area = q.area.toLowerCase();
  if (q.compare && q.compare.length >= 2) {
    const subs = q.compare.map((c) => findSubject(world, c)).filter((s): s is Subject => !!s);
    if (subs.length >= 2) {
      return subjectsSpec(world, subs, q.range, q.type, locale, L(locale, `${subs.map((s) => s.name).join(' vs ')}`, subs.map((s) => s.name).join(' مقابل ')));
    }
  }
  if (area === 'goals') return goalsSpec(world, q.type, locale);
  if (area === 'balance' || area === 'extracurriculars' || area === 'activities') {
    return balanceSpec(world, q.range, q.type ?? (area === 'balance' ? 'pie' : 'stacked-bar'), locale);
  }
  if (area === 'academics' || area === 'grades') return subjectsSpec(world, world.academics.subjects, q.range, q.type, locale);
  const act = findActivity(world, area);
  if (act) {
    if (q.type === 'pie' || q.type === 'radial') return balanceSpec(world, q.range, q.type, locale);
    return activitySpec(world, act, q.range, q.type, locale);
  }
  const subj = findSubject(world, area);
  if (subj) return subjectsSpec(world, [subj], q.range, q.type, locale);
  if (ACTIVITY_AREAS.includes(area)) {
    // asked about an activity this student doesn't do: show the overall balance instead
    return balanceSpec(world, q.range, 'pie', locale);
  }
  return subjectsSpec(world, world.academics.subjects, q.range, q.type, locale);
}
