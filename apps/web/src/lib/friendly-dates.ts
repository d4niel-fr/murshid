/** ISO dates in replies ("2026-11-04") read as "Wed 4 Nov" (or Arabic). */
const ISO_DATE = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
export function friendlyDates(text: string, locale: 'en' | 'ar'): string {
  return text.replace(ISO_DATE, (m, y, mo, d) => {
    const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    if (Number.isNaN(dt.getTime())) return m;
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt);
  });
}
