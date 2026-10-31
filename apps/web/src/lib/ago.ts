/** "3 min ago", "in 2 days" within a week, then a date ("12 Oct"): in the app's language. */
export function ago(ts: number, locale: 'en' | 'ar', now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', { numeric: 'auto', style: 'short' });
  const s = Math.round((ts - now) / 1000); const a = Math.abs(s);
  if (a < 45) return locale === 'ar' ? 'الآن' : 'just now';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 7 * 86_400) return rtf.format(Math.round(s / 86_400), 'day');
  // past a week, a date reads better than "340 days ago" (the year only when it isn't this year)
  const d = new Date(ts); const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(d);
}
