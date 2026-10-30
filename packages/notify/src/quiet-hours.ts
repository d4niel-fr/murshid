import type { Channel } from './types.js';

export interface QuietHoursConfig {
  timeZone: string;
  /** 0=Sun … 6=Sat. UAE schools run Mon–Fri since 2022. */
  schoolDays: number[];
  /** Local "HH:MM". No interrupting messages during school hours on school days. */
  schoolStart: string;
  schoolEnd: string;
  /** On school nights (evening before a school day), nothing after this until `morningEnd`. */
  schoolNightCutoff: string;
  /** On other nights (weekends/holidays), nothing after this until `morningEnd`. */
  weekendNightCutoff: string;
  /** Overnight quiet ends at this local time. */
  morningEnd: string;
  /** Local dates (YYYY-MM-DD) that are not school days (holidays, exam leave). */
  holidays: string[];
  /** Channels that quiet hours apply to. Email and in-app are passive, so excluded by default. */
  channels: Channel[];
}

export const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  timeZone: 'Asia/Dubai',
  schoolDays: [1, 2, 3, 4, 5],
  schoolStart: '07:30',
  schoolEnd: '14:30',
  schoolNightCutoff: '21:30',
  weekendNightCutoff: '22:30',
  morningEnd: '06:30',
  holidays: [],
  channels: ['push', 'whatsapp'],
};

export function quietHoursFromEnv(env: Record<string, string | undefined> = process.env): QuietHoursConfig {
  const d = DEFAULT_QUIET_HOURS;
  return {
    timeZone: env.NOTIFY_TIMEZONE || d.timeZone,
    schoolDays: env.QUIET_SCHOOL_DAYS ? env.QUIET_SCHOOL_DAYS.split(',').map((x) => Number(x.trim())) : d.schoolDays,
    schoolStart: env.QUIET_SCHOOL_START || d.schoolStart,
    schoolEnd: env.QUIET_SCHOOL_END || d.schoolEnd,
    schoolNightCutoff: env.QUIET_SCHOOL_NIGHT_CUTOFF || d.schoolNightCutoff,
    weekendNightCutoff: env.QUIET_WEEKEND_NIGHT_CUTOFF || d.weekendNightCutoff,
    morningEnd: env.QUIET_MORNING_END || d.morningEnd,
    holidays: env.QUIET_HOLIDAYS ? env.QUIET_HOLIDAYS.split(',').map((x) => x.trim()) : d.holidays,
    channels: env.QUIET_CHANNELS ? (env.QUIET_CHANNELS.split(',').map((x) => x.trim()) as Channel[]) : d.channels,
  };
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const fmtCache = new Map<string, Intl.DateTimeFormat>();

export interface LocalParts {
  date: string; // YYYY-MM-DD
  weekday: number; // 0=Sun
  minutes: number; // minutes since local midnight
}

export function localParts(at: Date, timeZone: string): LocalParts {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    fmtCache.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAY[p.weekday as string] ?? 0,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

export function hm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isSchoolDay(date: string, cfg: QuietHoursConfig): boolean {
  return cfg.schoolDays.includes(weekdayOf(date)) && !cfg.holidays.includes(date);
}

export type QuietReason = 'school_hours' | 'school_night' | 'night';

/** Is this instant inside quiet hours (ignores channel)? */
export function quietReason(at: Date, cfg: QuietHoursConfig = DEFAULT_QUIET_HOURS): QuietReason | null {
  const { date, minutes } = localParts(at, cfg.timeZone);
  const today = isSchoolDay(date, cfg);
  // Early morning: belongs to the previous night.
  if (minutes < hm(cfg.morningEnd)) return today ? 'school_night' : 'night';
  if (today && minutes >= hm(cfg.schoolStart) && minutes < hm(cfg.schoolEnd)) return 'school_hours';
  const tomorrowIsSchool = isSchoolDay(addDays(date, 1), cfg);
  const cutoff = hm(tomorrowIsSchool ? cfg.schoolNightCutoff : cfg.weekendNightCutoff);
  if (minutes >= cutoff) return tomorrowIsSchool ? 'school_night' : 'night';
  return null;
}

export function isQuiet(at: Date, channel: Channel, cfg: QuietHoursConfig = DEFAULT_QUIET_HOURS): boolean {
  return cfg.channels.includes(channel) && quietReason(at, cfg) !== null;
}

const STEP_MS = 5 * 60_000;
const MAX_STEPS = (72 * 60) / 5;

/** Earliest allowed instant >= at (5-minute resolution). */
export function nextAllowed(at: Date, cfg: QuietHoursConfig = DEFAULT_QUIET_HOURS): Date {
  if (!quietReason(at, cfg)) return at;
  let t = Math.ceil(at.getTime() / STEP_MS) * STEP_MS;
  for (let i = 0; i < MAX_STEPS; i++, t += STEP_MS) if (!quietReason(new Date(t), cfg)) return new Date(t);
  return at;
}

/** Latest allowed instant <= at (5-minute resolution), or null if none within 72h. */
export function previousAllowed(at: Date, cfg: QuietHoursConfig = DEFAULT_QUIET_HOURS): Date | null {
  if (!quietReason(at, cfg)) return at;
  let t = Math.floor(at.getTime() / STEP_MS) * STEP_MS - STEP_MS;
  for (let i = 0; i < MAX_STEPS; i++, t -= STEP_MS) if (!quietReason(new Date(t), cfg)) return new Date(t);
  return null;
}

export interface Placement {
  at: Date;
  moved: 'none' | 'later' | 'earlier';
  reason?: QuietReason;
}

/**
 * Place a planned send outside quiet hours. Prefer pushing it later; if that would land after
 * `notAfter` (e.g. the deadline it reminds about), pull it earlier instead.
 */
export function placeOutsideQuietHours(
  planned: Date,
  channel: Channel,
  opts: { notAfter?: Date } = {},
  cfg: QuietHoursConfig = DEFAULT_QUIET_HOURS,
): Placement {
  if (!cfg.channels.includes(channel)) return { at: planned, moved: 'none' };
  const reason = quietReason(planned, cfg);
  if (!reason) return { at: planned, moved: 'none' };
  const later = nextAllowed(planned, cfg);
  if (!opts.notAfter || later.getTime() <= opts.notAfter.getTime()) return { at: later, moved: 'later', reason };
  const earlier = previousAllowed(planned, cfg);
  return earlier ? { at: earlier, moved: 'earlier', reason } : { at: later, moved: 'later', reason };
}
