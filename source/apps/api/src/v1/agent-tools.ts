/**
 * Store-backed implementations of the orchestrator's tools (packages/agent-gateway ORCHESTRATOR_TOOLS).
 * Read tools return `{ summary, ...data }` from the shared DemoStore; write tools change it (tasks, plans,
 * applications, milestones, the LinkedIn pack) and write an audit entry, so the student app and the admin
 * portal show Murshid's changes straight away.
 */
import type { ToolHandler } from '@murshid/agent-gateway';
import { enumLabel } from '@murshid/core';
import { addDays, weekday } from '../lib/time';
import { dayDiff, goalStates, tasksForDay, type DemoTask } from './data';
import { buildLinkedInPack } from './linkedin';
import type { DemoStore, DemoView } from './store';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
import { achievements, applications, opportunities, projects, subjectSummaries, tasks, training, upcoming, studentCard } from './views';

const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "today" | "tomorrow" | weekday | "in 3 days" | YYYY-MM-DD → YYYY-MM-DD (Dubai). */
export function parseDay(input: unknown, today: string): string {
  const s = String(input ?? '').trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (!s || s === 'today' || s === 'tonight') return today;
  if (s === 'tomorrow') return addDays(today, 1);
  const inN = /^in (\d{1,2}) days?$/.exec(s);
  if (inN) return addDays(today, Number(inN[1]));
  const wd = WD.findIndex((d) => s.replace(/^(next|this|on)\s+/, '').startsWith(d.slice(0, 3)));
  if (wd >= 0) {
    let n = (wd - weekday(today) + 7) % 7;
    if (s.startsWith('next') && n === 0) n = 7;
    return addDays(today, n);
  }
  throw new Error(`could not read the date "${String(input)}"; use YYYY-MM-DD`);
}

/** "6pm" | "18:00" | "6:30 pm" → HH:MM. */
export function parseTime(input: unknown, fallback = '18:00'): string {
  const s = String(input ?? '').trim().toLowerCase();
  if (!s) return fallback;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) return fallback;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return fallback;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Deterministic extraction for the rule fallback: "add a task to email my coach tomorrow at 5pm". */
export function taskFromMessage(message: string, today: string): { title: string; date: string; time: string } {
  const m = message.trim();
  const timeM = /\bat (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i.exec(m);
  const dayM = /\b(today|tonight|tomorrow|(?:next |this |on )?(?:sun|mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?|in \d{1,2} days?|\d{4}-\d{2}-\d{2})\b/i.exec(m);
  let title = m
    .replace(/^(please\s+)?(can you\s+)?(add (a |an )?(task|reminder|to-?do)( to| for| that)?|remind me( to)?)\s*/i, '')
    .replace(timeM?.[0] ?? '\u0000', '').replace(dayM?.[0] ?? '\u0000', '')
    .replace(/\s+(on|at|for)\s*$/i, '').replace(/[.!?\s]+$/, '').replace(/\s{2,}/g, ' ').trim();
  if (!title) title = 'Task';
  let date = today;
  try { if (dayM) date = parseDay(dayM[1]!.replace(/^on /i, ''), today); } catch { /* keep today */ }
  return { title: title[0]!.toUpperCase() + title.slice(1), date, time: parseTime(timeM?.[1], '17:00') };
}

const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export interface ToolEnv { store: DemoStore; studentId: string; now: () => Date; actor: string }

export function createAgentTools(env: ToolEnv): Record<string, ToolHandler> {
  const view = (): DemoView => env.store.view(env.studentId, env.now());
  const audit = (action: 'create' | 'update', resource: string, resourceId: string, summary: string, changes?: Record<string, unknown>) =>
    env.store.audit({ actor: env.actor, actorRole: 'agent', studentId: env.studentId, action, resource, resourceId, summary, changes, at: env.now().toISOString() });

  function addTask(v: DemoView, t: Omit<DemoTask, 'id' | 'status' | 'overdue' | 'source'> & { notes?: string | null }): DemoTask {
    const task: DemoTask = { ...t, id: env.store.nextId('task-m'), status: 'todo', overdue: false, source: 'murshid', notes: t.notes ?? null };
    v.record.customTasks.push(task);
    return task;
  }

  return {
    get_student_overview: () => {
      const v = view();
      const goals = goalStates(v.profile, v.data, v.sessions).map(({ history: _h, ...g }) => g);
      const today = tasks(v, 'today');
      return {
        summary: `${v.profile.preferredName}, ${v.profile.classLabel} at ${v.profile.school}. ${goals.length} goals (closest: ${[...goals].sort((a, b) => b.progress - a.progress)[0]?.title ?? 'none'}). ${today.filter((t) => !t.done).length} tasks open today.`,
        student: studentCard(v), goals, today: today.map((t) => ({ title: t.title, time: t.time, done: t.done, overdue: t.overdue })),
        projects: v.record.projects.map((p) => p.name), activities: v.profile.activities.map((a) => a.id),
      };
    },

    get_academics: () => {
      const v = view();
      const subs = subjectSummaries(v);
      const avg = subs.length ? Math.round((subs.reduce((t, s) => t + s.current, 0) / subs.length) * 10) / 10 : 0;
      const weakest = [...subs].sort((a, b) => (a.current - a.target) - (b.current - b.target))[0];
      const next = v.data.assessments.filter((a) => a.status === 'upcoming').slice(0, 6);
      const name = new Map(v.profile.subjects.map((s) => [s.id, s.name]));
      const recent = v.data.assessments.filter((a) => a.status === 'graded').slice(-8).reverse();
      const staff = new Set(v.record.assessmentsAdded.map((a) => a.id));
      const fromSchool = v.data.assessments.filter((a) => a.status === 'upcoming' && staff.has(a.id));
      return {
        summary: subs.length
          ? `Average ${avg}% across ${subs.length} subjects.${weakest ? ` Furthest from target: ${weakest.name} (${weakest.current}% vs ${weakest.target}%).` : ''}${next[0] ? ` Next assessment: ${next[0].title} on ${next[0].date}.` : ''}${fromSchool.length ? ` New from school: ${fromSchool.map((a) => `${a.title} on ${a.date}`).join('; ')}.` : ''}`
          : 'No subjects recorded yet.',
        average: avg,
        subjects: subs.map((s) => ({ id: s.id, name: s.name, current: s.current, target: s.target, delta12w: s.delta12w, trend: s.trend, teacher: s.teacher })),
        upcoming: next.map((a) => ({ id: a.id, subject: name.get(a.subjectId) ?? a.subjectId, title: a.title, kind: a.kind, date: a.date, daysLeft: dayDiff(v.data.today, a.date), ...(staff.has(a.id) ? { addedBySchool: true } : {}) })),
        newFromSchool: fromSchool.map((a) => ({ title: a.title, date: a.date, subject: name.get(a.subjectId) ?? a.subjectId })),
        recentGrades: recent.map((a) => ({ subject: name.get(a.subjectId) ?? a.subjectId, title: a.title, percent: a.percent, date: a.date })),
      };
    },

    get_training: () => {
      const v = view();
      const t = training(v, 8);
      const lines = t.map((a) => {
        const lastWeek = a.weeklyLoad[a.weeklyLoad.length - 2]!;
        const pb = Object.values(a.personalBests).slice(0, 2).map((p) => `${p.label} ${p.value}${p.unit === 's' ? 's' : ` ${p.unit}`}`).join(', ');
        return `${a.name}: ${Math.round(lastWeek.minutes / 6) / 10}h last week (target ${Math.round(a.weeklyTargetMinutes / 6) / 10}h)${a.acuteChronicRatio ? `, load ratio ${a.acuteChronicRatio}` : ''}${pb ? `; bests: ${pb}` : ''}${a.upcoming[0] ? `; next: ${a.upcoming[0].title} on ${a.upcoming[0].date}` : ''}.`;
      });
      return { summary: lines.join(' ') || 'No activities recorded yet.', activities: t };
    },

    get_tasks: (args) => {
      const v = view();
      const scope = ['today', 'week', 'overdue'].includes(String(args.scope)) ? (args.scope as 'today' | 'week' | 'overdue') : 'week';
      const items = scope === 'week' ? [...tasks(v, 'overdue'), ...tasks(v, 'week')] : tasks(v, scope);
      return {
        summary: `${items.filter((t) => !t.done).length} open of ${items.length} tasks (${scope === 'week' ? 'next 7 days + overdue' : scope}).${items.filter((t) => t.source && t.source !== 'generated' && !t.done).slice(0, 4).map((t) => ` "${t.title}" (${t.date}${t.source === 'admin' ? ', set by school' : ''}).`).join('')}`,
        scope, tasks: items.map((t) => ({ id: t.id, title: t.title, date: t.date, time: t.time, minutes: t.durationMinutes, done: t.done, overdue: t.overdue, source: t.source ?? 'generated' })),
      };
    },

    get_upcoming: (args) => {
      const v = view();
      const days = Math.min(42, Math.max(1, Number(args.days) || 14));
      const items = upcoming(v, days);
      const assessments = items.filter((i) => i.kind === 'assessment');
      return {
        summary: `${plural(assessments.length, 'assessment')}, ${plural(items.filter((i) => i.kind === 'deadline').length, 'deadline')} and ${plural(items.filter((i) => i.kind === 'event').length, 'fixture/event', 'fixtures/events')} in the next ${days} days.${assessments[0] ? ` First: ${assessments[0].title} on ${assessments[0].date}.` : ''}`,
        days, items: items.map((i) => ({ kind: i.kind, title: i.title, date: i.date, daysLeft: i.daysLeft, subject: i.subject })),
      };
    },

    get_goals: () => {
      const v = view();
      const goals = goalStates(v.profile, v.data, v.sessions).map(({ history: _h, ...g }) => g);
      return { summary: goals.map((g) => `${g.title}: ${g.progress}%`).join('; ') || 'No goals yet.', goals };
    },

    find_opportunities: (args) => {
      const v = view();
      const type = typeof args.type === 'string' && args.type ? args.type : undefined;
      const tag = typeof args.tag === 'string' && args.tag ? args.tag.toLowerCase() : undefined;
      let items = opportunities(v, type, 20);
      if (tag) items = items.filter((o) => o.tags.some((t) => t.includes(tag)) || o.title.toLowerCase().includes(tag));
      if (!items.length) items = opportunities(v, undefined, 20);
      const applied = new Set(v.record.applications.map((a) => a.opportunityId).filter(Boolean));
      const list = items.slice(0, 8).map((o) => ({ id: o.id, title: o.title, organizer: o.organizer, type: o.typeLabel, deadline: o.deadline, daysLeft: o.daysLeft, costAed: o.costAed, why: o.why, publishedByStaff: o.source === 'admin', saved: applied.has(o.id), matchScore: o.matchScore }));
      const staff = list.filter((o) => o.publishedByStaff);
      return {
        summary: list.length
          ? `${list.length} open matches. Best fit: ${list[0]!.title} (${list[0]!.daysLeft} days left).${staff.length ? ` Published by your school: ${staff.map((o) => o.title).join(', ')}.` : ''}`
          : 'No open opportunities right now.',
        opportunities: list,
        ui: { name: 'show_opportunities', args: { ...(type ? { type } : {}), limit: 3 } },
      };
    },

    get_applications: () => {
      const v = view();
      const apps = applications(v);
      const won = apps.filter((a) => a.status === 'accepted').length;
      return { summary: `${apps.length} applications this year: ${won} accepted, ${apps.filter((a) => a.status === 'rejected').length} not selected, ${apps.filter((a) => ['saved', 'preparing', 'submitted'].includes(a.status)).length} in progress.`, applications: apps };
    },

    get_side_projects: () => {
      const v = view();
      const ps = projects(v);
      const first = ps.find((p) => p.totals) ?? ps[0];
      const lines = ps.map((p) => p.totals
        ? `${p.name}: AED ${p.totals.revenueAed.toLocaleString('en-US')} revenue from ${p.totals.orders} orders and ${p.totals.customers} customers since ${p.startDate.slice(0, 7)}; last full month AED ${p.totals.lastMonth.revenue.toLocaleString('en-US')}.${p.nextMilestone ? ` Next milestone: ${p.nextMilestone.title} (${p.nextMilestone.date}).` : ''}`
        : `${p.name}: ${p.tagline}; ${p.doneMilestones}/${p.milestones.length} milestones done.`);
      return {
        summary: lines.join(' ') || 'No side projects yet.',
        chartArea: first && first.totals ? first.id : undefined,
        projects: ps.map((p) => ({ ...p, metrics: p.metrics.slice(-12) })),
      };
    },

    get_cv_profile: () => {
      const v = view();
      const cv = v.record.cv;
      const links = env.store.getLinks(env.studentId, env.now());
      return {
        summary: `Headline: "${cv.headline}". ${cv.skills.length} skills, ${cv.certifications.length} certifications, ${achievements(v).length} achievements.${cv.universityGoal ? ` University goal: ${cv.universityGoal}.` : ''}`,
        cv, achievements: achievements(v), links: Object.fromEntries(Object.entries(links).filter(([k, x]) => typeof x === 'string' && !['updatedAt'].includes(k))),
        age: v.profile.age, curriculum: enumLabel('curriculum', v.profile.curriculum), roles: v.profile.activities.map((a) => a.role ?? a.detail),
      };
    },

    get_wellbeing_signals: () => {
      const v = view();
      const up = upcoming(v, 14).filter((i) => i.kind === 'assessment');
      const t = training(v, 6);
      const lastWeek = t.reduce((s, a) => s + a.weeklyLoad[a.weeklyLoad.length - 2]!.minutes, 0);
      const usual = Math.round(t.reduce((s, a) => s + a.weeklyLoad.slice(0, -2).reduce((x, w) => x + w.minutes, 0) / Math.max(1, a.weeklyLoad.length - 2), 0));
      const overdue = tasks(v, 'overdue').length;
      return {
        summary: `${up.length} assessments in the next 14 days; ${Math.round(lastWeek / 6) / 10}h of training last week (usual ${Math.round(usual / 6) / 10}h); ${overdue} overdue tasks; ${v.profile.studyStreakDays}-day study streak.`,
        assessmentsNext14d: up.map((u) => ({ title: u.title, date: u.date })), trainingMinutesLastWeek: lastWeek, usualTrainingMinutes: usual, overdueTasks: overdue,
        projects: v.record.projects.filter((p) => p.status === 'active').map((p) => p.name),
        note: 'Signals only. No medical data is stored.',
      };
    },

    create_task: (rawArgs, ctx) => {
      const v = view();
      const args = rawArgs.fromMessage ? { ...taskFromMessage(ctx.message, v.data.today), kind: 'study' } : rawArgs;
      const title = clip(args.title, 120);
      if (!title) throw new Error('title is required');
      const date = parseDay(args.date, v.data.today);
      if (date < v.data.today) throw new Error('date is in the past');
      if (dayDiff(v.data.today, date) > 120) throw new Error('date is more than 120 days away');
      const kind = ['study', 'assignment', 'activity', 'habit', 'application'].includes(String(args.kind)) ? (args.kind as DemoTask['kind']) : 'study';
      const minutes = Math.min(240, Math.max(10, Math.round(Number(args.durationMinutes) || 45)));
      const task = addTask(v, { title, kind, date, time: parseTime(args.time), durationMinutes: minutes, subjectId: null, area: null });
      audit('create', 'task', task.id, `Murshid added task "${title}" on ${date}`);
      return { summary: `Added "${title}" on ${WD_SHORT[weekday(date)]} ${date} at ${task.time} (${minutes} min).`, task };
    },

    build_week_plan: (args) => {
      const v = view();
      const start = args.startDate ? parseDay(args.startDate, v.data.today) : v.data.today;
      const focus = clip(args.focus, 200);
      const tag = `week-plan:${start}`;
      // re-planning the same week replaces the previous plan instead of stacking a second one
      const before = v.record.customTasks.length;
      v.record.customTasks = v.record.customTasks.filter((t) => t.notes !== tag);
      const replaced = before - v.record.customTasks.length;
      const ups = upcoming(v, 10);
      const assessments = ups.filter((u) => u.kind === 'assessment');
      const hasProject = v.record.projects.some((p) => p.status === 'active');
      const project = v.record.projects.find((p) => p.status === 'active');
      const added: DemoTask[] = [];
      const days: { date: string; weekday: string; items: { time: string; title: string; minutes: number; kind: string; area: string | null; new: boolean }[] }[] = [];
      let projectBlocks = 0;
      for (let i = 0; i < 7; i++) {
        const date = addDays(start, i);
        const wd = weekday(date);
        const existing = tasksForDay(v.profile, v.data, date, v.now).filter((t) => t.notes !== tag);
        const fixturesToday = v.data.events.filter((e) => e.date === date);
        const examSoon = assessments.filter((a) => { const d = dayDiff(date, a.date); return d >= 1 && d <= 2; });
        const newItems: Omit<DemoTask, 'id' | 'status' | 'overdue' | 'source'>[] = [];
        // extra deep-revision block 1-2 days before each assessment (on top of the generated short revision)
        for (const a of examSoon.slice(0, 1)) {
          newItems.push({ title: `Deep revision: ${a.title} (past paper + mark scheme)`, kind: 'study', date, time: wd === 6 || wd === 0 ? '11:00' : '20:00', durationMinutes: 50, subjectId: a.subjectId, area: a.subjectId, notes: tag });
        }
        // fixture prep: lighter evening and early night before a match / race
        for (const f of v.data.events.filter((e) => e.date === addDays(date, 1))) {
          newItems.push({ title: `Prep for ${f.title}: kit, hydration, lights out 22:00`, kind: 'habit', date, time: '21:00', durationMinutes: 15, subjectId: null, area: f.activityId, notes: tag });
        }
        // side project: max 3 blocks a week, never the night before an assessment or on a fixture day
        if (hasProject && projectBlocks < 3 && !examSoon.length && !fixturesToday.length && [2, 4, 6].includes(wd)) {
          newItems.push({ title: `${project!.name}: ${wd === 6 ? 'orders, suppliers and content batch' : 'customer messages and one growth task'}`, kind: 'activity', date, time: wd === 6 ? '15:00' : '20:30', durationMinutes: wd === 6 ? 90 : 40, subjectId: null, area: project!.id, notes: tag });
          projectBlocks++;
        }
        // one protected rest evening (Friday) and a weekly review (Sunday)
        if (wd === 5) newItems.push({ title: 'Rest evening: no screens after 21:30, family / friends time', kind: 'habit', date, time: '19:30', durationMinutes: 120, subjectId: null, area: null, notes: tag });
        if (wd === 0) newItems.push({ title: 'Weekly review with Murshid: goals, grades, training, business (15 min)', kind: 'habit', date, time: '18:00', durationMinutes: 15, subjectId: null, area: null, notes: tag });
        const saved = newItems.map((t) => addTask(v, t));
        added.push(...saved);
        days.push({
          date, weekday: WD_SHORT[wd]!,
          items: [
            ...existing.map((t) => ({ time: t.time, title: t.title, minutes: t.durationMinutes, kind: t.kind, area: t.area, new: false })),
            ...saved.map((t) => ({ time: t.time, title: t.title, minutes: t.durationMinutes, kind: t.kind, area: t.area, new: true })),
          ].sort((a, b) => a.time.localeCompare(b.time)),
        });
      }
      audit('create', 'plan', tag, `Murshid saved a week plan from ${start} (${added.length} items${replaced ? `, replaced ${replaced}` : ''})`, { focus });
      const fixtures = v.data.events.filter((e) => e.date >= start && e.date <= addDays(start, 6));
      const nRev = added.filter((t) => t.kind === 'study').length;
      const summary = `Saved a 7-day plan from ${start}: ${added.length} new items (${nRev} deep-revision block${nRev === 1 ? '' : 's'}, ${projectBlocks} ${project?.name ?? 'project'} block${projectBlocks === 1 ? '' : 's'}, rest evening, weekly review) around ${plural(assessments.filter((a) => a.date <= addDays(start, 6)).length, 'assessment')} and ${plural(fixtures.length, 'fixture')}.${replaced ? ' (Replaced the earlier plan for this week.)' : ''}`;
      return {
        summary, start, focus: focus || null, savedItems: added.length,
        plan: days.map((d) => ({ ...d, items: d.items.map((x) => `${x.time} ${x.title}${x.new ? ' [new]' : ''}`) })),
        ui: { name: 'show_plan', args: { start, days, summary } },
      };
    },

    save_opportunity: (args) => {
      const v = view();
      const open = opportunities(v, undefined, 50);
      // rules fallback (no model to pick an id): save the top match, the one the scout recommends first
      const id = String(args.opportunityId ?? (args.fromMessage ? open[0]?.id ?? '' : ''));
      const opp = open.find((o) => o.id === id);
      if (!opp) throw new Error(`no open opportunity with id "${id}"`);
      const existing = v.record.applications.find((a) => a.opportunityId === id);
      if (existing) return { summary: `${opp.title} is already in your applications (${existing.status}).`, application: existing };
      const app = { id: env.store.nextId('app'), opportunityId: id, title: opp.title, organizer: opp.organizer, type: opp.type, status: 'saved' as const, outcome: null, appliedAt: null, updatedAt: v.data.today, source: 'murshid' as const };
      v.record.applications.push(app);
      const prep = addTask(v, { title: `Start application: ${opp.title}`, kind: 'application', date: addDays(v.data.today, Math.min(3, Math.max(0, opp.daysLeft - 1))), time: '17:00', durationMinutes: 45, subjectId: null, area: null });
      audit('create', 'application', app.id, `Murshid saved "${opp.title}" to applications`);
      return { summary: `Saved ${opp.title} (deadline ${opp.deadline}) and added a task to start it on ${prep.date}.`, application: app };
    },

    add_project_milestone: (args) => {
      const v = view();
      const p = v.record.projects.find((x) => x.id === String(args.projectId)) ?? (v.record.projects.length === 1 ? v.record.projects[0] : undefined);
      if (!p) throw new Error(`unknown project "${String(args.projectId)}"`);
      const title = clip(args.title, 140);
      if (!title) throw new Error('title is required');
      const date = args.date ? parseDay(args.date, v.data.today) : addDays(v.data.today, 30);
      const ms = { id: env.store.nextId(`${p.id}-m`), title, date, done: false, source: 'murshid' as const };
      p.milestones.push(ms);
      audit('create', 'milestone', ms.id, `Murshid added milestone "${title}" to ${p.name}`);
      return { summary: `Added milestone "${title}" to ${p.name} for ${date}.`, milestone: ms };
    },

    generate_linkedin_cv: (args) => {
      const v = view();
      const headline = clip(args.headline, 220) || undefined;
      const about = String(args.about ?? '').trim().slice(0, 2600) || undefined;
      const pack = buildLinkedInPack(v, { headline, about });
      v.record.linkedin = pack;
      audit('create', 'linkedin_pack', `${env.studentId}-linkedin`, `Murshid generated the LinkedIn pack and CV PDF${pack.generatedBy === 'ai' ? ' (model-written headline/About)' : ''}`);
      return {
        summary: `Generated your LinkedIn pack (headline, About, ${pack.experience.length} experience entries, ${pack.skills.length} skills, ${pack.featured.length} featured items) and a CV PDF. Download: /student/cv/linkedin.pdf`,
        pdfUrl: '/student/cv/linkedin.pdf',
        pack: { headline: pack.headline, about: pack.about, experience: pack.experience.map((e) => `${e.title} — ${e.organization}`), skills: pack.skills, featured: pack.featured.map((f) => f.title) },
        ui: { name: 'show_cv', args: { pdfUrl: '/student/cv/linkedin.pdf', headline: pack.headline, about: pack.about, experience: pack.experience, skills: pack.skills, featured: pack.featured, synthetic: true } },
      };
    },
  };
}
