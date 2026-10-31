import type { RenderedContent } from './templates.js';
import { emailShell } from './templates.js';
import { escapeHtml, firstName, fmtLocal, plural, truncate } from './format.js';
import type { Application, CalendarEvent, Goal, Material, Opportunity, Student, Task } from './types.js';

export interface BriefingInput {
  student: Student;
  /** Guardian briefings are summary-only: counts and goal progress, no item titles. */
  audience: 'student' | 'guardian';
  guardianName?: string;
  tasks: Task[];
  exams?: Material[];
  events?: CalendarEvent[];
  applications?: { application: Application; opportunity: Opportunity }[];
  /** Opportunities matched to this student and first seen since the last briefing (caller filters). */
  newOpportunities?: Opportunity[];
  goals?: Goal[];
  /** goal id → progress at last week's briefing, for deltas. */
  previousGoalProgress?: Record<string, number>;
  now: Date;
  timeZone?: string;
}

export interface BriefingItem {
  kind: 'test' | 'deadline' | 'application';
  title: string;
  at: string;
}

export interface Briefing {
  audience: 'student' | 'guardian';
  greetingName: string;
  studentFirstName: string;
  weekStart: string;
  weekEnd: string;
  counts: { tests: number; deadlines: number; newOpportunities: number; overdue: number; activeGoals: number };
  goals: { id: string; title: string; progress: number; delta: number | null }[];
  items: BriefingItem[];
  headline: string;
  tips: string[];
}

const TEST_RE = /\b(test|exam|quiz|assessment|mock|midterm|mid-term|final|olympiad)\b/i;
const WEEK_MS = 7 * 86_400_000;

/** Rule-based composer. // AI-LATER: personalised tone, study-plan suggestions, Arabic copy. */
export function composeWeeklyBriefing(input: BriefingInput): Briefing {
  const { student, now } = input;
  const start = now.getTime();
  const end = start + WEEK_MS;
  const inWeek = (iso?: string | null) => !!iso && new Date(iso).getTime() >= start && new Date(iso).getTime() < end;
  const open = (t: Task) => t.status === 'todo' || t.status === 'doing';

  const items: BriefingItem[] = [];
  const seenTests = new Set<string>();
  const addTest = (title: string, at: string) => {
    const key = `${title.toLowerCase().trim()}|${at.slice(0, 10)}`;
    if (seenTests.has(key)) return;
    seenTests.add(key);
    items.push({ kind: 'test', title, at });
  };
  for (const m of input.exams ?? []) if (m.kind === 'exam' && inWeek(m.due_at)) addTest(m.title, m.due_at!);
  for (const e of input.events ?? []) if (TEST_RE.test(e.title) && inWeek(e.start_at)) addTest(e.title, e.start_at);

  for (const t of input.tasks) {
    if (!open(t) || !inWeek(t.due_at)) continue;
    if (t.kind === 'assignment' || t.kind === 'application') items.push({ kind: 'deadline', title: t.title, at: t.due_at! });
  }
  for (const { application, opportunity } of input.applications ?? []) {
    if ((application.status === 'saved' || application.status === 'preparing') && inWeek(opportunity.deadline)) {
      items.push({ kind: 'application', title: opportunity.title, at: opportunity.deadline! });
    }
  }
  items.sort((a, b) => a.at.localeCompare(b.at));

  const overdue = input.tasks.filter((t) => open(t) && t.due_at && new Date(t.due_at).getTime() < start).length;
  const tests = items.filter((i) => i.kind === 'test').length;
  const deadlines = items.length - tests;
  const newOpportunities = (input.newOpportunities ?? []).filter((o) => o.status !== 'closed').length;

  const active = (input.goals ?? []).filter((g) => g.status === 'active');
  const goals = active
    .map((g) => {
      const prev = input.previousGoalProgress?.[g.id];
      return { id: g.id, title: g.title, progress: clamp(g.progress), delta: prev === undefined ? null : clamp(g.progress) - clamp(prev) };
    })
    .sort((a, b) => (b.delta ?? -1) - (a.delta ?? -1) || b.progress - a.progress)
    .slice(0, 3);

  const sFirst = firstName(student.full_name, student.preferred_name);
  const headline =
    tests >= 3
      ? `Big week: ${plural(tests, 'test')} coming up`
      : tests + deadlines >= 4
        ? `Busy week: ${plural(tests + deadlines, 'thing')} due`
        : tests + deadlines === 0
          ? 'A lighter week ahead'
          : `${plural(tests + deadlines, 'thing')} due this week`;

  const tips: string[] = [];
  if (overdue) tips.push(`Clear ${plural(overdue, 'overdue task')} first.`);
  if (tests) tips.push('Plan short revision blocks on the days before each test.');
  if (newOpportunities) tips.push(`Have a look at ${plural(newOpportunities, 'new opportunity', 'new opportunities')} matched to you.`);
  const stalled = goals.find((g) => g.delta === 0);
  if (stalled) tips.push(`Pick one small step for "${stalled.title}".`);

  const tz = input.timeZone ?? 'Asia/Dubai';
  return {
    audience: input.audience,
    greetingName: input.audience === 'guardian' ? (input.guardianName?.split(/\s+/)[0] ?? 'there') : sFirst,
    studentFirstName: sFirst,
    weekStart: fmtLocal(new Date(start), tz, false),
    weekEnd: fmtLocal(new Date(end - 1), tz, false),
    counts: { tests, deadlines, newOpportunities, overdue, activeGoals: active.length },
    goals,
    items: input.audience === 'guardian' ? [] : items,
    headline,
    tips: input.audience === 'guardian' ? [] : tips,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countsLine(b: Briefing): string {
  return `${plural(b.counts.tests, 'test')}, ${plural(b.counts.deadlines, 'deadline')}, ${plural(b.counts.newOpportunities, 'new opportunity', 'new opportunities')}`;
}

function goalLine(b: Briefing): string {
  if (!b.goals.length) return 'no active goals yet';
  return b.goals
    .map((g) => `${g.title} ${g.progress}%${g.delta ? ` (${g.delta > 0 ? '+' : ''}${g.delta})` : ''}`)
    .join('; ');
}

export function briefingToPush(b: Briefing): { title: string; body: string } {
  const who = b.audience === 'guardian' ? `${b.studentFirstName}'s week` : 'Your week ahead';
  const first = b.items[0];
  const next = first ? ` First: ${first.title} (${fmtLocal(first.at).split(',')[0]}).` : '';
  return { title: truncate(`${who}: ${b.headline}`, 50), body: truncate(`${countsLine(b)}.${next}`, 178) };
}

export function briefingToWhatsAppParams(b: Briefing): string[] {
  const first = b.items[0];
  return [
    b.greetingName,
    String(b.counts.tests),
    String(b.counts.deadlines),
    String(b.counts.newOpportunities),
    truncate(goalLine(b), 200),
    b.audience === 'guardian' ? `Open Murshid to see ${b.studentFirstName}'s summary` : first ? `${first.title}, ${fmtLocal(first.at)}` : 'nothing scheduled',
  ];
}

export function briefingToEmail(b: Briefing): { subject: string; html: string; text: string } {
  const subject =
    b.audience === 'guardian' ? `${b.studentFirstName}'s week ahead: ${b.headline}` : `Your week ahead: ${b.headline}`;
  const stat = (n: number, label: string) =>
    `<td align="center" style="padding:10px;border:1px solid #e3e6ea;border-radius:8px"><div style="font-size:24px;font-weight:bold;color:#1f3a5f">${n}</div><div style="font-size:12px;color:#5b6470">${escapeHtml(label)}</div></td>`;
  const statsRow = `<table role="presentation" width="100%" cellspacing="6"><tr>${stat(b.counts.tests, 'tests')}${stat(b.counts.deadlines, 'deadlines')}${stat(b.counts.newOpportunities, 'new opportunities')}</tr></table>`;
  const itemsHtml = b.items.length
    ? `<h3 style="font-size:15px;margin:18px 0 6px">Coming up</h3><ul style="padding-left:18px;margin:0">${b.items
        .slice(0, 8)
        .map((i) => `<li><strong>${escapeHtml(i.title)}</strong> &middot; ${escapeHtml(fmtLocal(i.at))}${i.kind === 'test' ? ' &middot; test' : ''}</li>`)
        .join('')}</ul>`
    : '';
  const goalsHtml = b.goals.length
    ? `<h3 style="font-size:15px;margin:18px 0 6px">Goals</h3>${b.goals
        .map(
          (g) =>
            `<div style="margin:6px 0"><div>${escapeHtml(g.title)} <span style="color:#5b6470">${g.progress}%${g.delta ? ` (${g.delta > 0 ? '+' : ''}${g.delta} this week)` : ''}</span></div><div style="background:#e6e9ef;border-radius:4px;height:6px"><div style="background:#2e7d5b;border-radius:4px;height:6px;width:${g.progress}%"></div></div></div>`,
        )
        .join('')}`
    : '';
  const tipsHtml = b.tips.length ? `<h3 style="font-size:15px;margin:18px 0 6px">Tips</h3><ul style="padding-left:18px;margin:0">${b.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';
  const overdue = b.counts.overdue ? `<p style="color:#a33">${escapeHtml(plural(b.counts.overdue, 'task'))} overdue.</p>` : '';
  const intro =
    b.audience === 'guardian'
      ? `<p>Hi ${escapeHtml(b.greetingName)}, here is ${escapeHtml(b.studentFirstName)}'s week (${escapeHtml(b.weekStart)} to ${escapeHtml(b.weekEnd)}).</p>`
      : `<p>Hi ${escapeHtml(b.greetingName)}, here is your week (${escapeHtml(b.weekStart)} to ${escapeHtml(b.weekEnd)}).</p>`;
  const html = emailShell(b.headline, intro + statsRow + overdue + itemsHtml + goalsHtml + tipsHtml);

  const text = [
    b.audience === 'guardian' ? `Hi ${b.greetingName}, here is ${b.studentFirstName}'s week.` : `Hi ${b.greetingName}, here is your week.`,
    `${b.headline}. ${countsLine(b)}.`,
    b.counts.overdue ? `${plural(b.counts.overdue, 'task')} overdue.` : '',
    ...b.items.slice(0, 8).map((i) => `- ${i.title} (${fmtLocal(i.at)})`),
    b.goals.length ? `Goals: ${goalLine(b)}` : '',
    ...b.tips.map((t) => `Tip: ${t}`),
  ]
    .filter(Boolean)
    .join('\n');
  return { subject: truncate(subject, 90), html, text };
}

export function renderBriefing(b: Briefing): RenderedContent {
  const push = briefingToPush(b);
  return {
    push: { ...push, data: { url: 'murshid://briefing' } },
    email: briefingToEmail(b),
    whatsapp: { template: 'murshid_weekly_briefing', language: 'en', bodyParams: briefingToWhatsAppParams(b) },
    inApp: { title: push.title, body: push.body, link: '/briefing' },
  };
}
