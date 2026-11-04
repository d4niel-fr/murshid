/** Date helpers. Calendar dates are YYYY-MM-DD in Asia/Dubai (the product's home timezone). */
import { nAr } from './plural';
export const TZ = 'Asia/Dubai';

export function todayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function dubaiHour(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now)) % 24;
}

const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
};

export function addDays(iso: string, n: number): string {
  return new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a) - toUTC(b)) / 86400000);
}

/** Accepts "YYYY-MM-DD" or a relative "+N"/"-N" offset from today. */
export function resolveDate(s: string, today: string): string {
  if (/^[+-]\d+$/.test(s)) return addDays(today, Number(s));
  return s;
}

/** Monday-start week of an ISO date. */
export function startOfWeek(iso: string): string {
  const dow = new Date(toUTC(iso)).getUTCDay(); // 0 Sun
  const offset = (dow + 6) % 7;
  return addDays(iso, -offset);
}

export function weekdayIndex(iso: string): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7; // Mon=0
}

export function formatDate(iso: string, locale: 'en' | 'ar', opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const d = new Date(toUTC(iso));
  const safe = Number.isNaN(d.getTime()) ? new Date(iso) : d;
  if (Number.isNaN(safe.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', { timeZone: 'UTC', ...opts }).format(safe);
}

export function relativeDay(iso: string, today: string, locale: 'en' | 'ar'): string {
  const d = diffDays(iso, today);
  if (locale === 'ar') {
    if (d === 0) return 'اليوم';
    if (d === 1) return 'غداً';
    if (d === -1) return 'أمس';
    return d > 0 ? `بعد ${nAr(d, 'day', true)}` : `قبل ${nAr(-d, 'day', true)}`;
  }
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}
