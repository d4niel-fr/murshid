/**
 * Study buddy mode (optional persona next to the tutor). The persona and its guardrails live in
 * @murshid/agent-gateway (buddy.ts); this file owns who may use it and the audit trail:
 * - availability: a guardian or the school can switch it off at any time; Grades 5-6 (under 13) need a guardian to
 *   switch it on (Decree-Law 26/2025: under-13 consent; UK Children's Code: high privacy / protective defaults).
 * - limits: per-band soft daily turn limit (nudge, then pause until tomorrow); counted per student per Dubai day.
 * - audit: every buddy turn and every settings change is written to the audit log with its safety flags and what
 *   produced the reply. Message text is never logged (PDPL data minimisation).
 */
import { BUDDY_TONES, BuddyEngine, buddyBand, type BuddyBand, type BuddyTurnResult, type ChatProvider } from '@murshid/agent-gateway';
import type { DemoStore, DemoView } from './store';
import { upcoming } from './views';

export type BuddyActor = 'guardian' | 'school';
export interface BuddyControls { guardian: boolean | null; school: boolean | null; updatedAt: string | null; updatedBy: BuddyActor | null }
export interface BuddyStatus {
  available: boolean;
  reason: 'on' | 'school_off' | 'guardian_off' | 'needs_guardian';
  band: BuddyBand;
  tone: { humour: string; maxWords: number; dailyTurns: number; defaultOn: boolean };
  controls: BuddyControls;
  turnsToday: number;
}

const controls = new WeakMap<DemoStore, Map<string, BuddyControls>>();
const turns = new WeakMap<DemoStore, Map<string, number>>();
const mapFor = <T>(wm: WeakMap<DemoStore, Map<string, T>>, store: DemoStore) => {
  let m = wm.get(store);
  if (!m) { m = new Map(); wm.set(store, m); }
  return m;
};

export function dubaiParts(now: Date): { date: string; hour: number } {
  const d = new Date(now.getTime() + 4 * 3600_000); // Asia/Dubai is UTC+4, no DST
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

export function buddyControls(store: DemoStore, studentId: string): BuddyControls {
  return mapFor(controls, store).get(studentId) ?? { guardian: null, school: null, updatedAt: null, updatedBy: null };
}

export function buddyStatus(store: DemoStore, v: DemoView): BuddyStatus {
  const band = buddyBand(v.profile.grade);
  const tone = BUDDY_TONES[band];
  const c = buddyControls(store, v.profile.id);
  const reason: BuddyStatus['reason'] = c.school === false ? 'school_off' : c.guardian === false ? 'guardian_off' : !tone.defaultOn && c.guardian !== true ? 'needs_guardian' : 'on';
  return {
    available: reason === 'on', reason, band,
    tone: { humour: tone.humour, maxWords: tone.maxWords, dailyTurns: tone.dailyTurns, defaultOn: tone.defaultOn },
    controls: c, turnsToday: mapFor(turns, store).get(`${v.profile.id}:${dubaiParts(v.now).date}`) ?? 0,
  };
}

export function setBuddyControl(store: DemoStore, v: DemoView, by: BuddyActor, enabled: boolean, actor: string): BuddyStatus {
  const before = buddyControls(store, v.profile.id);
  const next: BuddyControls = { ...before, [by]: enabled, updatedAt: v.now.toISOString(), updatedBy: by };
  mapFor(controls, store).set(v.profile.id, next);
  store.audit({
    actor, actorRole: by === 'school' ? 'admin' : 'guardian', studentId: v.profile.id, action: 'update', resource: 'buddy_mode', resourceId: v.profile.id,
    summary: `${by === 'school' ? 'School' : 'Guardian'} switched study buddy mode ${enabled ? 'on' : 'off'}`,
    changes: { [by]: { from: before[by], to: enabled } }, at: v.now.toISOString(),
  });
  return buddyStatus(store, v);
}

const REASON_TEXT: Record<Exclude<BuddyStatus['reason'], 'on'>, string> = {
  school_off: 'Study buddy mode is switched off by your school. The tutor is here for anything you need.',
  guardian_off: 'Study buddy mode is switched off by your parent or guardian. The tutor is here for anything you need.',
  needs_guardian: 'Study buddy mode needs a parent or guardian to switch it on for your grade. The tutor is here for anything you need.',
};

export interface BuddyChatResult extends BuddyTurnResult { status: BuddyStatus }

export async function runBuddy(
  store: DemoStore, v: DemoView, message: string, history: { role: 'user' | 'assistant'; content: string }[],
  engine: { provider?: ChatProvider; models?: string[] },
): Promise<BuddyChatResult> {
  const status = buddyStatus(store, v);
  const { date, hour } = dubaiParts(v.now);
  if (!status.available) {
    store.audit({ actor: 'murshid', actorRole: 'agent', studentId: v.profile.id, action: 'create', resource: 'buddy_turn', resourceId: `${v.profile.id}:${date}`, summary: `Study buddy blocked (${status.reason}); tutor offered`, changes: { reason: status.reason }, at: v.now.toISOString() });
    return { text: REASON_TEXT[status.reason as Exclude<BuddyStatus['reason'], 'on'>], flags: [], action: 'paused', model: null, nudge: null, limit: 'ok', ms: 0, status };
  }
  const next = upcoming(v, 7)[0];
  const r = await new BuddyEngine(engine).turn({
    message, history,
    ctx: {
      name: v.profile.preferredName, grade: v.profile.grade, band: status.band, hour, turnsToday: status.turnsToday,
      nextUp: next ? `${next.title} on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${next.date}T12:00:00Z`).getUTCDay()]}` : null, firstTurn: !history.some((m) => m.role === 'assistant'),
    },
  });
  mapFor(turns, store).set(`${v.profile.id}:${date}`, status.turnsToday + 1);
  // flags and outcome only: never the student's words (data minimisation)
  store.audit({
    actor: 'murshid', actorRole: 'agent', studentId: v.profile.id, action: 'create', resource: 'buddy_turn', resourceId: `${v.profile.id}:${date}:${status.turnsToday + 1}`,
    summary: `Study buddy reply (${r.action}${r.flags.length ? `; flags: ${r.flags.join(', ')}` : ''})`,
    changes: { action: r.action, flags: r.flags, band: status.band, model: r.model, limit: r.limit, ...(r.replacedReasons ? { replacedReasons: r.replacedReasons } : {}) },
    at: v.now.toISOString(),
  });
  return { ...r, status: buddyStatus(store, v) };
}
