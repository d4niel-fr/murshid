/**
 * Small RFC 5545 parser: unfolding, params, escaped text, VEVENT + VTODO,
 * DATE / DATE-TIME (UTC "Z", floating, TZID with fixed-offset zones + common
 * Gulf/IANA zones). RRULE expansion is NOT done: recurring masters are returned
 * once with `rrule` set (expand later with a library if needed).
 */
export interface IcsProperty { name: string; params: Record<string, string>; value: string }
export interface IcsComponent { type: string; props: IcsProperty[]; children: IcsComponent[] }

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string | null;
  start: string; // ISO UTC
  end: string; // ISO UTC
  allDay: boolean;
  rrule: string | null;
  status: string | null;
  url: string | null;
}
export interface IcsTodo { uid: string; summary: string; description: string | null; due: string | null; status: string | null }

/** Fixed offsets (minutes east of UTC) for zones without DST that UAE schools use. */
const FIXED_TZ: Record<string, number> = {
  'Asia/Dubai': 240, 'Asia/Muscat': 240, 'Arabian Standard Time': 240, 'Gulf Standard Time': 240,
  'Asia/Riyadh': 180, 'Asia/Qatar': 180, 'Asia/Bahrain': 180, 'Asia/Kuwait': 180,
  'Asia/Kolkata': 330, 'Asia/Calcutta': 330, 'India Standard Time': 330, 'Asia/Karachi': 300,
  UTC: 0, 'Etc/UTC': 0, GMT: 0, 'Etc/GMT': 0,
};

export function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter((l) => l.length > 0);
}

export function unescapeText(v: string): string {
  return v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

export function parseLine(line: string): IcsProperty {
  // split name;params:value, respecting quoted params
  let i = 0, inQ = false;
  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQ = !inQ;
    else if (ch === ':' && !inQ) break;
  }
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name = '', ...rawParams] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

export function parseComponents(text: string): IcsComponent[] {
  const root: IcsComponent = { type: 'ROOT', props: [], children: [] };
  const stack: IcsComponent[] = [root];
  for (const line of unfold(text)) {
    const p = parseLine(line);
    const top = stack[stack.length - 1]!;
    if (p.name === 'BEGIN') {
      const c: IcsComponent = { type: p.value.toUpperCase(), props: [], children: [] };
      top.children.push(c);
      stack.push(c);
    } else if (p.name === 'END') {
      if (stack.length > 1) stack.pop();
    } else top.props.push(p);
  }
  return root.children;
}

/** Parse an ICS DATE or DATE-TIME into ISO UTC. defaultOffsetMin applies to floating times / all-day dates. */
export function icsDateToIso(p: IcsProperty, defaultOffsetMin = 240): { iso: string; allDay: boolean } {
  const v = p.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) throw new Error(`Bad ICS date: ${v}`);
  const [, y, mo, d, hh, mi, ss, z] = m;
  const allDay = p.params.VALUE === 'DATE' || hh === undefined;
  const utcMs = Date.UTC(+y!, +mo! - 1, +d!, hh ? +hh : 0, mi ? +mi : 0, ss ? +ss : 0);
  if (z) return { iso: new Date(utcMs).toISOString(), allDay };
  const tz = p.params.TZID;
  let offset = defaultOffsetMin;
  if (tz) {
    const fixed = FIXED_TZ[tz];
    const gmt = /^(?:UTC|GMT)([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(tz);
    if (fixed !== undefined) offset = fixed;
    else if (gmt) offset = (gmt[1] === '-' ? -1 : 1) * (+gmt[2]! * 60 + (gmt[3] ? +gmt[3] : 0));
    else offset = ianaOffsetMinutes(tz, utcMs) ?? defaultOffsetMin;
  }
  return { iso: new Date(utcMs - offset * 60_000).toISOString(), allDay };
}

/** Best-effort IANA offset using Intl (Node ships full ICU). */
function ianaOffsetMinutes(tz: string, approxUtcMs: number): number | null {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const part = fmt.formatToParts(new Date(approxUtcMs)).find((x) => x.type === 'timeZoneName')?.value ?? '';
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part);
    if (!m) return part === 'GMT' ? 0 : null;
    return (m[1] === '-' ? -1 : 1) * (+m[2]! * 60 + (m[3] ? +m[3] : 0));
  } catch {
    return null;
  }
}

function prop(c: IcsComponent, name: string): IcsProperty | undefined {
  return c.props.find((p) => p.name === name);
}

function walk(cs: IcsComponent[], type: string, out: IcsComponent[] = []): IcsComponent[] {
  for (const c of cs) {
    if (c.type === type) out.push(c);
    walk(c.children, type, out);
  }
  return out;
}

/** Parse a duration like P1D, PT1H30M, -PT15M into ms. */
export function durationMs(v: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  const [w, d, h, mi, s] = [m[2], m[3], m[4], m[5], m[6]].map((x) => (x ? +x : 0)) as [number, number, number, number, number];
  return sign * ((((w * 7 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000;
}

export function parseIcs(text: string, defaultOffsetMin = 240): { events: IcsEvent[]; todos: IcsTodo[]; calendarName: string | null } {
  const comps = parseComponents(text);
  const cal = comps.find((c) => c.type === 'VCALENDAR');
  const calendarName = cal ? (prop(cal, 'X-WR-CALNAME')?.value ?? null) : null;
  const events: IcsEvent[] = [];
  for (const e of walk(comps, 'VEVENT')) {
    const ds = prop(e, 'DTSTART');
    if (!ds) continue;
    const start = icsDateToIso(ds, defaultOffsetMin);
    const de = prop(e, 'DTEND');
    const dur = prop(e, 'DURATION');
    let end: string;
    if (de) end = icsDateToIso(de, defaultOffsetMin).iso;
    else if (dur) end = new Date(new Date(start.iso).getTime() + durationMs(dur.value)).toISOString();
    else end = new Date(new Date(start.iso).getTime() + (start.allDay ? 86_400_000 : 0)).toISOString();
    const recurrenceId = prop(e, 'RECURRENCE-ID');
    const uidBase = prop(e, 'UID')?.value ?? `${ds.value}-${prop(e, 'SUMMARY')?.value ?? ''}`;
    events.push({
      uid: recurrenceId ? `${uidBase}#${recurrenceId.value}` : uidBase,
      summary: unescapeText(prop(e, 'SUMMARY')?.value ?? '(no title)'),
      description: prop(e, 'DESCRIPTION') ? unescapeText(prop(e, 'DESCRIPTION')!.value) : null,
      start: start.iso,
      end,
      allDay: start.allDay,
      rrule: prop(e, 'RRULE')?.value ?? null,
      status: prop(e, 'STATUS')?.value ?? null,
      url: prop(e, 'URL')?.value ?? null,
    });
  }
  const todos: IcsTodo[] = walk(comps, 'VTODO').map((t) => ({
    uid: prop(t, 'UID')?.value ?? unescapeText(prop(t, 'SUMMARY')?.value ?? 'todo'),
    summary: unescapeText(prop(t, 'SUMMARY')?.value ?? '(no title)'),
    description: prop(t, 'DESCRIPTION') ? unescapeText(prop(t, 'DESCRIPTION')!.value) : null,
    due: prop(t, 'DUE') ? icsDateToIso(prop(t, 'DUE')!, defaultOffsetMin).iso : null,
    status: prop(t, 'STATUS')?.value ?? null,
  }));
  return { events, todos, calendarName };
}
