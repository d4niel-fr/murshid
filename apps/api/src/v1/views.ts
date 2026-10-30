/** Response builders for the v1 endpoints (dashboard, academics, extracurriculars, opportunities, tasks). */
import { enumLabel } from '@murshid/core';
import { addDays, weekday } from '../lib/time';
import { buildChart } from './charts';
import {
  activityLabel, currentTerm, dayDiff, goalStates, mondayOfDate, overdueTasks, round, subjectScoreAt, tasksForDay, tasksRange,
  type DemoTask,
} from './data';
import type { DemoView } from './store';

export function studentCard(v: DemoView) {
  const p = v.profile;
  return {
    id: p.id, name: p.name, preferredName: p.preferredName, nameAr: p.nameAr, grade: p.grade, band: p.band, age: p.age,
    classLabel: p.classLabel, school: p.school, curriculum: p.curriculum, curriculumLabel: enumLabel('curriculum', p.curriculum),
    emirate: p.emirate, emirateLabel: enumLabel('emirate', p.emirate), languages: p.languages, interests: p.interests,
    initials: p.name.split(' ').map((w) => w[0]).join('').slice(0, 2), synthetic: true,
  };
}

const trendOf = (d: number) => (d > 1 ? 'up' : d < -1 ? 'down' : 'flat') as 'up' | 'down' | 'flat';

export function subjectSummaries(v: DemoView) {
  const today = v.data.today;
  const ago = addDays(today, -84);
  return v.profile.subjects.map((s, i) => {
    const current = subjectScoreAt(v.data.assessments, s.id, today) ?? s.base;
    const before = subjectScoreAt(v.data.assessments, s.id, ago) ?? current;
    const delta = round(current - before, 1);
    return {
      id: s.id, name: s.name, nameAr: s.nameAr, teacher: s.teacher, current, target: s.target, delta12w: delta, trend: trendOf(delta),
      color: `var(--chart-${(i % 6) + 1})`,
    };
  });
}

export function opportunities(v: DemoView, type?: string, limit = 10) {
  const tracked = new Set(v.record.applications.map((a) => a.opportunityId).filter(Boolean));
  return v.profile.opportunities
    .filter((o) => !type || o.type === type)
    .map((o) => {
      const deadline = o.deadline ?? addDays(v.data.today, o.deadlineInDays);
      const daysLeft = dayDiff(v.data.today, deadline);
      return {
        id: o.id, title: o.title, organizer: o.organizer, type: o.type, typeLabel: enumLabel('opportunityType', o.type),
        emirate: o.emirate, emirateLabel: o.emirate ? enumLabel('emirate', o.emirate) : 'UAE-wide / online',
        deadline, daysLeft, grades: [o.minGrade, o.maxGrade],
        costAed: o.costAed, tags: o.tags, why: o.why, url: o.url ?? `https://example.org/opportunities/${o.id}`, synthetic: true as const,
        source: o.source ?? 'demo',
        saved: tracked.has(o.id),
        // staff-published opportunities are hand-picked for the student: rank them first
        matchScore: Math.min(99, Math.max(55, (o.source === 'admin' ? 106 : 96) - Math.max(0, daysLeft) / 3 - (o.costAed > 1000 ? 8 : 0))) | 0,
      };
    })
    .filter((o) => o.daysLeft >= 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

const taskOut = (t: DemoTask) => ({
  ...t, kindLabel: enumLabel('taskKind', t.kind), done: t.status === 'done',
});

export function tasks(v: DemoView, scope: 'today' | 'week' | 'overdue') {
  if (scope === 'overdue') return overdueTasks(v.profile, v.data, v.now).map(taskOut);
  if (scope === 'today') {
    const today = tasksRange(v.profile, v.data, v.now, 0, 0);
    return [...overdueTasks(v.profile, v.data, v.now), ...today].map(taskOut);
  }
  return tasksRange(v.profile, v.data, v.now, 0, 6).map(taskOut);
}

export function upcoming(v: DemoView, days = 21) {
  const today = v.data.today;
  const until = addDays(today, days);
  const subj = new Map(v.profile.subjects.map((s) => [s.id, s]));
  const items = [
    ...v.data.assessments.filter((a) => a.status === 'upcoming' && a.date <= until).map((a) => ({
      id: a.id, kind: 'assessment' as const, kindLabel: enumLabel('assessmentKind', a.kind), title: a.title, date: a.date,
      daysLeft: dayDiff(today, a.date), subjectId: a.subjectId, subject: subj.get(a.subjectId)?.name ?? null, area: a.subjectId,
    })),
    ...opportunities(v).filter((o) => o.deadline <= until).map((o) => ({
      id: o.id, kind: 'deadline' as const, kindLabel: `${o.typeLabel} deadline`, title: o.title, date: o.deadline,
      daysLeft: o.daysLeft, subjectId: null, subject: null, area: null,
    })),
    ...v.data.events.filter((e) => e.date <= until).map((e) => ({
      id: e.id, kind: 'event' as const, kindLabel: activityLabel(e.activityId), title: e.title, date: e.date,
      daysLeft: dayDiff(today, e.date), subjectId: null, subject: null, area: e.activityId,
    })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function activitySummaries(v: DemoView, sessionLimit = 0) {
  const today = v.data.today;
  const weekStart = mondayOfDate(today);
  return v.profile.activities.map((a) => {
    const xs = v.sessions.filter((s) => s.activityId === a.id);
    const sum = (from: string) => xs.filter((s) => s.date >= from && s.date <= today).reduce((t, s) => t + s.minutes, 0);
    const latest: Record<string, number> = {};
    const best: Record<string, number> = {};
    for (const m of a.metrics) {
      const vals = xs.map((s) => s.metrics[m.key]).filter((x): x is number => typeof x === 'number');
      if (vals.length) {
        latest[m.key] = vals[vals.length - 1]!;
        best[m.key] = m.better === 'lower' ? Math.min(...vals) : Math.max(...vals);
      }
    }
    // consecutive weeks (ending last week or this week) with at least one session
    let streakWeeks = 0;
    for (let mon = xs.some((s) => s.date >= weekStart) ? weekStart : addDays(weekStart, -7); ; mon = addDays(mon, -7)) {
      if (!xs.some((s) => s.date >= mon && s.date <= addDays(mon, 6))) break;
      streakWeeks++;
    }
    const minutes = xs.reduce((t, s) => t + s.minutes, 0);
    return {
      id: a.id, kind: a.id, name: activityLabel(a.id), nameAr: activityLabel(a.id, 'ar'), detail: a.detail, detailAr: a.detailAr,
      schedule: a.eventEveryWeeks ? `About every ${a.eventEveryWeeks} weeks` : a.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', '),
      weeklyTargetMinutes: a.weeklyTargetMinutes,
      metricDefs: a.metrics.map(({ key, label, unit, better }) => ({ key, label, unit, better })),
      totals: {
        sessions: xs.length, minutes, hours: round(minutes / 60, 1), thisWeekMinutes: sum(weekStart),
        last7dMinutes: sum(addDays(today, -6)), last28dMinutes: sum(addDays(today, -27)), streakWeeks,
        sessionsThisWeek: xs.filter((s) => s.date >= weekStart).length,
      },
      latestMetrics: latest, bestMetrics: best,
      lastSessionDate: xs[xs.length - 1]?.date ?? null,
      nextEvent: v.data.events.find((e) => e.activityId === a.id) ?? null,
      ...(sessionLimit ? { sessions: [...xs].reverse().slice(0, sessionLimit) } : {}),
    };
  });
}

export function academics(v: DemoView) {
  const today = v.data.today;
  const term = currentTerm(today);
  const subjects = subjectSummaries(v).map((s) => {
    const graded = v.data.assessments.filter((a) => a.subjectId === s.id && a.status === 'graded');
    const months = new Map<string, number[]>();
    for (const a of graded) months.set(a.date.slice(0, 7), [...(months.get(a.date.slice(0, 7)) ?? []), a.percent!]);
    return {
      ...s,
      termAverage: (() => {
        const xs = graded.filter((a) => a.date >= term.start).map((a) => a.percent!);
        return xs.length ? round(xs.reduce((p, q) => p + q, 0) / xs.length, 1) : null;
      })(),
      grades: graded.map((a) => ({ date: a.date, percent: a.percent!, assessmentId: a.id, kind: a.kind })),
      monthly: [...months.entries()].map(([month, xs]) => ({ month, average: round(xs.reduce((p, q) => p + q, 0) / xs.length, 1) })),
    };
  });
  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((p, q) => p + q, 0) / xs.length, 1) : 0);
  const name = new Map(v.profile.subjects.map((s) => [s.id, s.name]));
  const withLabels = (a: (typeof v.data.assessments)[number]) => ({ ...a, subject: name.get(a.subjectId) ?? a.subjectId, kindLabel: enumLabel('assessmentKind', a.kind) });
  return {
    student: studentCard(v),
    term: { ...term, weeksIn: Math.max(1, Math.ceil((dayDiff(term.start, today) + 1) / 7)) },
    average: avg(subjects.map((s) => s.current)),
    target: avg(subjects.map((s) => s.target)),
    subjects,
    assessments: v.data.assessments.filter((a) => a.status === 'graded').reverse().map(withLabels),
    upcoming: v.data.assessments.filter((a) => a.status === 'upcoming').map(withLabels),
    chart: buildChart(v, 'academics', 'term'),
  };
}

export function dashboard(v: DemoView) {
  const p = v.profile;
  const subjects = subjectSummaries(v);
  const acts = activitySummaries(v);
  const goals = goalStates(p, v.data, v.sessions);
  const avg = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length, 1) : 0);
  const academicsAvg = avg(subjects.map((s) => s.current));
  const academicsDelta = round(avg(subjects.map((s) => s.delta12w)), 1);
  const up = upcoming(v, 14);

  // highlights (rule-based)
  const highlights: { id: string; kind: 'improvement' | 'personal-best' | 'streak' | 'deadline' | 'goal'; text: string; textAr: string; area: string | null }[] = [];
  const climber = [...subjects].sort((a, b) => b.delta12w - a.delta12w)[0];
  if (climber && climber.delta12w > 0) {
    highlights.push({ id: `hl-climb-${climber.id}`, kind: 'improvement', text: `${climber.name} is up ${climber.delta12w} points in 12 weeks.`, textAr: `${climber.nameAr} ارتفعت ${climber.delta12w} نقاط خلال 12 أسبوعًا.`, area: climber.id });
  }
  for (const a of p.activities) {
    const m = a.metrics.find((x) => x.key !== 'projects');
    if (!m) continue;
    const from = addDays(v.data.today, -27);
    const vals = (pred: (d: string) => boolean) => v.sessions.filter((s) => s.activityId === a.id && pred(s.date)).map((s) => s.metrics[m.key]).filter((x): x is number => typeof x === 'number');
    const recent = vals((d) => d >= from);
    const older = vals((d) => d < from);
    if (!recent.length || !older.length) continue;
    const rb = m.better === 'lower' ? Math.min(...recent) : Math.max(...recent);
    const ob = m.better === 'lower' ? Math.min(...older) : Math.max(...older);
    if (m.better === 'lower' ? rb < ob : rb > ob) {
      const u = m.unit === 's' ? 's' : ` ${m.unit}`;
      highlights.push({ id: `hl-pb-${a.id}-${m.key}`, kind: 'personal-best', text: `New personal best — ${m.label}: ${rb}${u}.`, textAr: `رقم شخصي جديد — ${activityLabel(a.id, 'ar')}: ${rb}${u}.`, area: a.id });
      break;
    }
  }
  highlights.push({ id: 'hl-streak', kind: 'streak', text: `${p.studyStreakDays}-day study streak.`, textAr: `${p.studyStreakDays} أيام متتالية من المذاكرة.`, area: null });
  const nearGoal = [...goals].filter((g) => g.status === 'active').sort((a, b) => b.progress - a.progress)[0];
  if (nearGoal) highlights.push({ id: `hl-goal-${nearGoal.id}`, kind: 'goal', text: `${nearGoal.progress}% of the way to "${nearGoal.title}".`, textAr: `أنجزت ${nearGoal.progress}٪ من "${nearGoal.titleAr}".`, area: nearGoal.id });
  const next = up.find((u) => u.kind === 'assessment');
  if (next) highlights.push({ id: `hl-next-${next.id}`, kind: 'deadline', text: `${next.title} ${next.daysLeft === 1 ? 'tomorrow' : `in ${next.daysLeft} days`}.`, textAr: `${next.title} بعد ${next.daysLeft} أيام.`, area: next.area });

  const wd = weekday(v.data.today);
  return {
    student: studentCard(v),
    band: p.band,
    generatedAt: v.now.toISOString(),
    date: v.data.today,
    isSchoolDay: wd >= 1 && wd <= 5,
    today: tasks(v, 'today'),
    upcoming: up,
    progress: {
      academics: {
        average: academicsAvg, target: avg(subjects.map((s) => s.target)), delta12w: academicsDelta, trend: trendOf(academicsDelta),
        subjects,
      },
      extracurriculars: {
        thisWeekMinutes: acts.reduce((s, a) => s + a.totals.thisWeekMinutes, 0),
        last7dMinutes: acts.reduce((s, a) => s + a.totals.last7dMinutes, 0),
        weeklyTargetMinutes: acts.reduce((s, a) => s + a.weeklyTargetMinutes, 0),
        activities: acts.map((a) => ({
          id: a.id, name: a.name, thisWeekMinutes: a.totals.thisWeekMinutes, last7dMinutes: a.totals.last7dMinutes,
          weeklyTargetMinutes: a.weeklyTargetMinutes, sessionsThisWeek: a.totals.sessionsThisWeek, streakWeeks: a.totals.streakWeeks,
          lastSessionDate: a.lastSessionDate, nextEvent: a.nextEvent,
        })),
      },
      goals: goals.map(({ history: _h, ...g }) => g),
    },
    streaks: {
      studyDays: p.studyStreakDays,
      longestStudyDays: p.studyStreakDays + 9,
      activityWeeks: Math.max(0, ...acts.map((a) => a.totals.streakWeeks)),
      byActivity: Object.fromEntries(acts.map((a) => [a.id, a.totals.streakWeeks])),
    },
    highlights,
    opportunities: opportunities(v, undefined, 3),
  };
}

export { tasksForDay };

// ---------- side projects, applications, achievements, sports detail ----------
export function projects(v: DemoView) {
  return v.record.projects.map((p) => {
    const series = v.data.projectSeries[p.id] ?? [];
    const last12 = series.filter((x) => x.month >= addDays(v.data.today, -364).slice(0, 7));
    const totals = series.length ? {
      revenueAed: series.reduce((t, x) => t + x.revenue, 0),
      revenue12mAed: last12.reduce((t, x) => t + x.revenue, 0),
      orders: series.reduce((t, x) => t + x.orders, 0),
      customers: series[series.length - 1]!.customers,
      followers: series[series.length - 1]!.followers,
      lastMonth: series.length >= 2 ? series[series.length - 2]! : series[series.length - 1]!,
    } : null;
    const ms = [...p.milestones].sort((a, b) => a.date.localeCompare(b.date));
    const thisMonth = v.data.today.slice(0, 7);
    return {
      ...p, milestones: ms, metrics: series.map((x) => (x.month === thisMonth ? { ...x, partialMonth: true } : x)), totals,
      nextMilestone: ms.find((m) => !m.done) ?? null,
      doneMilestones: ms.filter((m) => m.done).length,
    };
  });
}

export function applications(v: DemoView) {
  return [...v.record.applications].sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''));
}

export function achievements(v: DemoView) {
  return [...v.record.achievements].sort((a, b) => b.date.localeCompare(a.date));
}

/** Per-sport detail for coaches: weekly load, fixtures (matches/races) and personal bests. */
export function training(v: DemoView, weeks = 8) {
  const today = v.data.today;
  const weekStart = mondayOfDate(today);
  return v.profile.activities.map((a) => {
    const xs = v.sessions.filter((s) => s.activityId === a.id);
    const load = Array.from({ length: weeks }, (_, i) => {
      const start = addDays(weekStart, -7 * (weeks - 1 - i));
      const inWeek = xs.filter((s) => s.date >= start && s.date <= addDays(start, 6));
      return { week: start, minutes: inWeek.reduce((t, s) => t + s.minutes, 0), sessions: inWeek.length };
    });
    // last full week vs the 4 weeks before it (this week is still in progress)
    const acute = load[load.length - 2]!.minutes;
    const chronic = Math.round(load.slice(-6, -2).reduce((t, w) => t + w.minutes, 0) / 4);
    const pbs: Record<string, { value: number; date: string; unit: string; label: string }> = {};
    for (const m of a.metrics) {
      if (m.unit === 'goals' || m.unit === 'assists') continue;
      for (const s of xs) {
        const val = s.metrics[m.key];
        if (typeof val !== 'number') continue;
        const cur = pbs[m.key];
        if (!cur || (m.better === 'lower' ? val < cur.value : val > cur.value)) pbs[m.key] = { value: val, date: s.date, unit: m.unit, label: m.label };
      }
    }
    const fixtures = xs.filter((s) => s.type === 'match' || s.type === 'race');
    const season = fixtures.filter((s) => s.date >= addDays(today, -120));
    const record = a.fixtures?.kind === 'match' ? {
      played: season.length,
      won: season.filter((s) => /: W /.test(s.note ?? '')).length,
      drawn: season.filter((s) => /: D /.test(s.note ?? '')).length,
      lost: season.filter((s) => /: L /.test(s.note ?? '')).length,
      goals: season.reduce((t, s) => t + (s.metrics.goals ?? 0), 0),
      assists: season.reduce((t, s) => t + (s.metrics.assists ?? 0), 0),
    } : null;
    return {
      id: a.id, name: activityLabel(a.id), detail: a.detail, role: a.role ?? null, weeklyTargetMinutes: a.weeklyTargetMinutes,
      weeklyLoad: load, acuteChronicRatio: chronic ? round(acute / chronic, 2) : null,
      personalBests: pbs, recentFixtures: [...fixtures].reverse().slice(0, 5).map((s) => ({ date: s.date, type: s.type, note: s.note, metrics: s.metrics })),
      last120dRecord: record,
      upcoming: v.data.events.filter((e) => e.activityId === a.id).slice(0, 3),
    };
  });
}
