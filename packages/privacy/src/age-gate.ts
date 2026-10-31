/**
 * Age gate: a *neutral* date-of-birth screen.
 *
 * Neutral means the UI never reveals the threshold (no "you must be 13+" text,
 * no pre-filled year, no "I am over 13" checkbox), so a child is not nudged to
 * lie. If a user is blocked we set a device/session lock so they can't simply
 * go back and enter a different date.
 */
import type { Clock, IsoDate } from './types.js';
import { systemClock } from './types.js';

export const MIN_AGE = 13;
export const ADULT_AGE = 18;
export const GATE_TIMEZONE = 'Asia/Dubai';

/** Copy for the screen. Deliberately does not mention any age. */
export const NEUTRAL_DOB_SCREEN = {
  title: 'When is your birthday?',
  titleAr: 'متى عيد ميلادك؟',
  helper: 'We use this to set up Murshid in the right way for you.',
  helperAr: 'نستخدم هذا لإعداد مرشد بالطريقة المناسبة لك.',
  fields: ['day', 'month', 'year'] as const,
  /** UI rule: year picker starts empty — never default to a qualifying year. */
  defaultYear: null,
  blockedMessage:
    "Thanks! Murshid isn't available for you right now. Ask a parent or your school counsellor about other study tools.",
} as const;

export type AgeGateOutcome =
  | { outcome: 'invalid'; reason: string }
  | { outcome: 'blocked_under_min_age'; age: number }
  | { outcome: 'allowed_needs_guardian'; age: number }
  | { outcome: 'allowed_adult'; age: number }
  | { outcome: 'locked'; reason: 'previous_block' };

/** Today's calendar date in Asia/Dubai, as y/m/d numbers. */
function todayParts(now: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: GATE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [y, m, d] = fmt.format(now).split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

export function parseDob(dob: IsoDate): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Completed years of age on `now` (Asia/Dubai calendar). */
export function ageOn(dob: IsoDate, now: Date): number | null {
  const p = parseDob(dob);
  if (!p) return null;
  const t = todayParts(now);
  let age = t.y - p.y;
  if (t.m < p.m || (t.m === p.m && t.d < p.d)) age -= 1;
  return age;
}

/** Store for the anti-retry lock (device id or install id; never the DOB itself). */
export interface AgeGateLockStore {
  isLocked(deviceKey: string): Promise<boolean>;
  lock(deviceKey: string, until: Date): Promise<void>;
}

export class InMemoryAgeGateLockStore implements AgeGateLockStore {
  private locks = new Map<string, number>();
  constructor(private clock: Clock = systemClock) {}
  async isLocked(deviceKey: string) {
    const until = this.locks.get(deviceKey);
    return until !== undefined && until > this.clock().getTime();
  }
  async lock(deviceKey: string, until: Date) {
    this.locks.set(deviceKey, until.getTime());
  }
}

export interface AgeGateOptions {
  clock?: Clock;
  lockStore?: AgeGateLockStore;
  /** How long a blocked device stays locked. Default 30 days. */
  lockDays?: number;
}

export class AgeGate {
  private clock: Clock;
  private lockStore: AgeGateLockStore;
  private lockDays: number;

  constructor(opts: AgeGateOptions = {}) {
    this.clock = opts.clock ?? systemClock;
    this.lockStore = opts.lockStore ?? new InMemoryAgeGateLockStore(this.clock);
    this.lockDays = opts.lockDays ?? 30;
  }

  /** Pure evaluation, no lock side effects. */
  evaluate(dob: IsoDate): Exclude<AgeGateOutcome, { outcome: 'locked' }> {
    const age = ageOn(dob, this.clock());
    if (age === null) return { outcome: 'invalid', reason: 'Not a valid date' };
    if (age < 0 || age > 120) return { outcome: 'invalid', reason: 'Date out of range' };
    if (age < MIN_AGE) return { outcome: 'blocked_under_min_age', age };
    if (age < ADULT_AGE) return { outcome: 'allowed_needs_guardian', age };
    return { outcome: 'allowed_adult', age };
  }

  /** Full screen submit: honours and sets the anti-retry lock. */
  async submit(deviceKey: string, dob: IsoDate): Promise<AgeGateOutcome> {
    if (await this.lockStore.isLocked(deviceKey)) {
      return { outcome: 'locked', reason: 'previous_block' };
    }
    const result = this.evaluate(dob);
    if (result.outcome === 'blocked_under_min_age') {
      const until = new Date(this.clock().getTime() + this.lockDays * 86_400_000);
      await this.lockStore.lock(deviceKey, until);
    }
    return result;
  }
}
