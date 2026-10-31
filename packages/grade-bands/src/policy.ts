import { G11_12 } from './bands/g11-12.js';
import { G5_6 } from './bands/g5-6.js';
import { G7_8 } from './bands/g7-8.js';
import { G9_10 } from './bands/g9-10.js';
import { bandForGrade } from './grades.js';
import { WIDGET_REQUIRES } from './shared.js';
import type { AiTask, BandConfig, BandId, FeatureId, Locale, NavItem, WidgetId } from './types.js';

export const BANDS: Record<BandId, BandConfig> = {
  'g5-6': G5_6,
  'g7-8': G7_8,
  'g9-10': G9_10,
  'g11-12': G11_12,
};

export function getBand(id: BandId): BandConfig {
  return BANDS[id];
}

export function bandConfigForGrade(grade: number): BandConfig {
  return BANDS[bandForGrade(grade)];
}

export function isBandId(x: unknown): x is BandId {
  return typeof x === 'string' && x in BANDS;
}

export function isFeatureEnabled(band: BandId, feature: FeatureId): boolean {
  return BANDS[band].features[feature] === true;
}

/** Nav items whose `requires` feature is on (bands are authored so this is all of them; kept as a runtime guard). */
export function visibleNav(band: BandId): NavItem[] {
  const b = BANDS[band];
  return b.nav.filter((n) => !n.requires || b.features[n.requires]);
}

export function widgetAllowed(band: BandId, widget: WidgetId): boolean {
  const req = WIDGET_REQUIRES[widget];
  return !req || req.some((f) => BANDS[band].features[f]);
}

/** Dashboard widgets in band order, filtered by feature gates. */
export function visibleWidgets(band: BandId): WidgetId[] {
  return BANDS[band].dashboardWidgets.filter((w) => widgetAllowed(band, w));
}

/** Route guard for apps/web middleware: is this href reachable in this band? */
export function canAccessRoute(band: BandId, href: string): boolean {
  const items = BANDS[band].nav;
  const match = items
    .filter((n) => n.href === '/' ? href === '/' : href === n.href || href.startsWith(`${n.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return false;
  return !match.requires || isFeatureEnabled(band, match.requires);
}

/** Localised string with `{var}` interpolation; falls back to English, then to the key. */
export function t(band: BandId, key: string, locale: Locale = 'en', vars: Record<string, string | number> = {}): string {
  const copy = BANDS[band].copy;
  const raw = copy[`${locale}.${key}`] ?? copy[`en.${key}`] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** All strings for one locale, keys without the locale prefix. */
export function copyFor(band: BandId, locale: Locale): Record<string, string> {
  const prefix = `${locale}.`;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(BANDS[band].copy)) if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  return out;
}

/** Time-of-day greeting key for Asia/Dubai hours. */
export function greetingKey(hourDubai: number): 'greeting.morning' | 'greeting.afternoon' | 'greeting.evening' {
  if (hourDubai >= 4 && hourDubai < 12) return 'greeting.morning';
  if (hourDubai >= 12 && hourDubai < 17) return 'greeting.afternoon';
  return 'greeting.evening';
}

// ---------- AI ----------

export function aiAllows(band: BandId, task: AiTask): boolean {
  const b = BANDS[band];
  return b.features.aiChat && b.aiPolicy.allowedTasks.includes(task);
}

export function chatMessagesRemaining(band: BandId, usedToday: number): number {
  return Math.max(0, BANDS[band].aiPolicy.dailyMessageCap - Math.max(0, usedToday));
}

export type ChatGate =
  | { ok: true; remaining: number }
  | { ok: false; reason: 'disabled' | 'cap-reached' | 'task-not-allowed'; messageKey: string };

/** Pre-flight check for POST /chat. */
export function gateChat(band: BandId, usedToday: number, task?: AiTask): ChatGate {
  const b = BANDS[band];
  if (!b.features.aiChat) return { ok: false, reason: 'disabled', messageKey: 'chat.refusal' };
  if (chatMessagesRemaining(band, usedToday) === 0) return { ok: false, reason: 'cap-reached', messageKey: 'chat.capReached' };
  if (task && !b.aiPolicy.allowedTasks.includes(task)) return { ok: false, reason: 'task-not-allowed', messageKey: 'chat.refusal' };
  return { ok: true, remaining: chatMessagesRemaining(band, usedToday + 1) };
}

// ---------- opportunities ----------

export type OpportunityKind = 'competition' | 'olympiad' | 'summer-program' | 'internship' | 'scholarship' | 'volunteering' | 'university-event';
export interface OpportunityLike {
  kind: OpportunityKind;
  scope: 'school' | 'uae' | 'international';
  paid?: boolean;
  minAge?: number;
}
export interface OpportunityDecision {
  allowed: boolean;
  needsGuardianApproval: boolean;
  reason?: string;
}

/** Filter for `show_opportunities` and the opportunities page. */
export function opportunityDecision(band: BandId, opp: OpportunityLike, studentAge?: number): OpportunityDecision {
  const b = BANDS[band];
  const f = b.features;
  const deny = (reason: string): OpportunityDecision => ({ allowed: false, needsGuardianApproval: false, reason });
  if (opp.minAge !== undefined && studentAge !== undefined && studentAge < opp.minAge) return deny('below minimum age');
  switch (opp.kind) {
    case 'competition':
      if (opp.scope === 'school') { if (!f.schoolCompetitions) return deny('school competitions off'); }
      else if (!f.externalCompetitions) return deny('external competitions off');
      break;
    case 'olympiad':
      if (!f.olympiads) return deny('olympiads off');
      break;
    case 'summer-program':
      if (!f.summerPrograms) return deny('summer programmes off');
      break;
    case 'internship':
    case 'scholarship':
    case 'university-event':
      if (!f.applications) return deny(`${opp.kind} needs applications feature`);
      break;
    case 'volunteering':
      if (!f.externalOpportunities && opp.scope !== 'school') return deny('external opportunities off');
      break;
  }
  const external = opp.scope !== 'school';
  const needsGuardianApproval = b.guardian.approvesExternalOpportunities && (external || opp.paid === true);
  return { allowed: true, needsGuardianApproval };
}

// ---------- guardian ----------

export type GuardianArea = 'grades' | 'activities' | 'goals' | 'applications' | 'chat';

/**
 * What a linked guardian may see. For `opt-in` bands the student's explicit share decides.
 * Safety alerts are always delivered and are not covered here.
 */
export function guardianCanSee(band: BandId, area: GuardianArea, studentShared = false): boolean {
  const g = BANDS[band].guardian;
  const base: Record<GuardianArea, boolean> = {
    grades: g.seesGrades,
    activities: g.seesActivities,
    goals: g.seesGoals,
    applications: g.seesApplications,
    chat: g.seesChatTranscripts,
  };
  if (g.level === 'opt-in') return area === 'chat' ? false : studentShared || base[area];
  return base[area];
}
