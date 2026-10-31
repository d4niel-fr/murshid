/** "3 min ago", "in 2 days": relative time in the app's language. */
export function ago(ts: number, locale: 'en' | 'ar', now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', { numeric: 'auto', style: 'short' });
  const s = Math.round((ts - now) / 1000); const a = Math.abs(s);
  if (a < 45) return locale === 'ar' ? 'الآن' : 'just now';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86_400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 30 * 86_400) return rtf.format(Math.round(s / 86_400), 'day');
  return rtf.format(Math.round(s / (30 * 86_400)), 'month');
}
