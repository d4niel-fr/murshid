export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** "Tue 14 Oct, 15:00" in the given zone. */
export function fmtLocal(iso: string | Date, timeZone = 'Asia/Dubai', withTime = true): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function firstName(full: string, preferred?: string | null): string {
  return preferred?.trim() || full.trim().split(/\s+/)[0] || full;
}

/** Human "when" relative to the actual send time: "in 2 hours", "today", "tomorrow", "in 3 days". */
export function whenPhrase(dueIso: string, sendAt: Date, timeZone = 'Asia/Dubai'): string {
  const due = new Date(dueIso);
  const hours = (due.getTime() - sendAt.getTime()) / 3_600_000;
  if (hours <= 0) return 'now';
  if (hours <= 3) return hours <= 1 ? 'within the hour' : `in ${Math.round(hours)} hours`;
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const diffDays = Math.round((Date.parse(day(due)) - Date.parse(day(sendAt))) / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return `in ${diffDays} days`;
}
