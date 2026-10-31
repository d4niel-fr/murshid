/** UAE time helpers. Asia/Dubai is UTC+4 all year (no DST), so a fixed offset is exact. */
export const TZ = 'Asia/Dubai';
export const TZ_OFFSET_MIN = 4 * 60;
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** YYYY-MM-DD of the given instant in Dubai. */
export function dubaiDate(d: Date): string {
  return new Date(d.getTime() + TZ_OFFSET_MIN * MIN).toISOString().slice(0, 10);
}

/** Instant for a Dubai wall-clock date + minutes after midnight. */
export function dubaiInstant(date: string, minutesAfterMidnight = 0): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + (minutesAfterMidnight - TZ_OFFSET_MIN) * MIN);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) + n * DAY).toISOString().slice(0, 10);
}

/** 0=Sunday ... 6=Saturday for a YYYY-MM-DD date. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday (YYYY-MM-DD) of the Dubai week containing the instant. */
export function mondayOf(d: Date): string {
  const date = dubaiDate(d);
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

/** ISO string rendered with the +04:00 offset (readable for UAE clients). */
export function toDubaiIso(d: Date): string {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * MIN).toISOString().slice(0, 19);
  return `${local}+04:00`;
}

export function ageOn(dob: string, at: Date): number {
  const [y, m, d] = dob.split('-').map(Number) as [number, number, number];
  const today = dubaiDate(at);
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age;
}

export const minutesBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / MIN);
export const addMinutes = (d: Date, n: number): Date => new Date(d.getTime() + n * MIN);
export const daysBetween = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / DAY;

export const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
