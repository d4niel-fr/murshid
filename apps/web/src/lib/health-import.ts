/**
 * Reading health and workout files on the student's own device, so only daily totals and workout summaries are sent
 * to Murshid (never routes, heart-rate traces or the raw file):
 *
 *   GPX / TCX       a workout exported from Garmin Connect, Huawei Health, Polar Flow, COROS, Strava…
 *   CSV             daily numbers (Samsung Health "Download personal data", Google Takeout Fit daily metrics, a sheet)
 *   Apple Health    the iPhone's Health export: export.zip (opened here) or export.xml, read as a stream
 */

export interface DayIn { date: string; steps?: number; activeMinutes?: number; sleepMinutes?: number }
export interface WorkoutIn { id?: string; sport: string; title?: string; start: string; minutes: number; distanceKm?: number | null; calories?: number | null }
export interface Parsed { days: DayIn[]; workouts: WorkoutIn[] }

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

/** Great-circle distance in km. */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371; const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]); const dLon = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A GPX track: when it started, how long, how far, and the sport if the file says. */
export function parseGpx(text: string): WorkoutIn | null {
  const pts = [...text.matchAll(/<trkpt\b[^>]*?lat="(-?[\d.]+)"[^>]*?lon="(-?[\d.]+)"[^>]*?>([\s\S]*?)<\/trkpt>|<trkpt\b[^>]*?lon="(-?[\d.]+)"[^>]*?lat="(-?[\d.]+)"[^>]*?>([\s\S]*?)<\/trkpt>/g)].map((m) => {
    const lat = Number(m[1] ?? m[5]); const lon = Number(m[2] ?? m[4]); const body = m[3] ?? m[6] ?? '';
    const t = /<time>([^<]+)<\/time>/.exec(body)?.[1];
    return { p: [lat, lon] as [number, number], t: t ? Date.parse(t) : NaN };
  }).filter((x) => Number.isFinite(x.p[0]) && Number.isFinite(x.p[1]));
  const times = pts.map((x) => x.t).filter((t) => Number.isFinite(t));
  if (times.length < 2) return null;
  let km = 0; for (let i = 1; i < pts.length; i++) km += haversine(pts[i - 1]!.p, pts[i]!.p);
  const type = /<type>([^<]+)<\/type>/.exec(text)?.[1] ?? '';
  const name = /<trk>[\s\S]*?<name>([^<]+)<\/name>/.exec(text)?.[1] ?? /<name>([^<]+)<\/name>/.exec(text)?.[1];
  const start = Math.min(...times); const end = Math.max(...times);
  return { id: `gpx-${start}`, sport: type || name || 'other', title: name?.trim() || type || 'Workout', start: new Date(start).toISOString(), minutes: Math.max(1, Math.round((end - start) / 60_000)), distanceKm: km > 0.05 ? round(km) : null };
}

/** A TCX activity (Garmin's format): sport, laps' time and distance. */
export function parseTcx(text: string): WorkoutIn | null {
  const act = /<Activity\b[^>]*Sport="([^"]*)"[^>]*>/.exec(text);
  const id = /<Activity\b[\s\S]*?<Id>([^<]+)<\/Id>/.exec(text)?.[1];
  const secs = [...text.matchAll(/<TotalTimeSeconds>([\d.]+)<\/TotalTimeSeconds>/g)].reduce((t, m) => t + Number(m[1]), 0);
  const metres = [...text.matchAll(/<Lap\b[\s\S]*?<DistanceMeters>([\d.]+)<\/DistanceMeters>/g)].reduce((t, m) => t + Number(m[1]), 0);
  const cal = [...text.matchAll(/<Calories>(\d+)<\/Calories>/g)].reduce((t, m) => t + Number(m[1]), 0);
  const start = id ?? /<Lap\b[^>]*StartTime="([^"]+)"/.exec(text)?.[1];
  if (!start || Number.isNaN(Date.parse(start)) || !secs) return null;
  return { id: `tcx-${Date.parse(start)}`, sport: act?.[1] || 'other', title: act?.[1] || 'Workout', start: new Date(start).toISOString(), minutes: Math.max(1, Math.round(secs / 60)), distanceKm: metres ? round(metres / 1000) : null, calories: cal || null };
}

/** Split one CSV line (quotes allowed). */
function cells(line: string, sep: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur); return out.map((c) => c.trim());
}
/** A date in a cell: 2026-11-05, 05/11/2026 (day first), or a timestamp. */
function dateOf(v: string): string | null {
  if (/^\d{12,13}$/.test(v)) return new Date(Number(v) + 4 * 3_600_000).toISOString().slice(0, 10); // epoch ms (Samsung), Dubai day
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/.exec(v); if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`;
  const t = Date.parse(v); return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/**
 * Daily numbers from a CSV with a header row. Columns are found by name: a date, and any of steps, active / move /
 * exercise / "heart points" minutes, sleep (minutes or hours). Rows for the same day are added up.
 */
export function parseCsv(text: string): Parsed {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  // Samsung's export has a first line naming the table: skip lines until one looks like a header
  // Samsung Health's daily steps file names its steps column "count"
  const samsung = /step_daily_trend/.test(lines[0] ?? '');
  const hi = samsung ? 1 : lines.findIndex((l) => /date|day|time|التاريخ/i.test(l) && /step|active|move|exercise|sleep|minute|خطو/i.test(l));
  if (hi < 0) return { days: [], workouts: [] };
  const sep = (lines[hi]!.match(/;/g)?.length ?? 0) > (lines[hi]!.match(/,/g)?.length ?? 0) ? ';' : ',';
  const head = cells(lines[hi]!, sep).map((h) => h.toLowerCase());
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const iDate = samsung ? col(/day_time/) : col(/^(date|day|start_?time|create_?time|day_time|التاريخ)|date$/);
  const iSteps = samsung ? col(/^count$/) : col(/step/); const iActive = col(/active minutes|move minutes|exercise|active_time|activity minutes|very active|heart (points|minutes)|active_minutes/);
  const iSleep = col(/sleep/);
  const sleepHours = iSleep >= 0 && /hour|hrs?\b/.test(head[iSleep]!);
  if (iDate < 0) return { days: [], workouts: [] };
  const days = new Map<string, DayIn>();
  for (const l of lines.slice(hi + 1)) {
    const c = cells(l, sep); const d = dateOf(c[iDate] ?? ''); if (!d) continue;
    const n = (i: number) => { if (i < 0) return undefined; const v = Number((c[i] ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(v) && (c[i] ?? '').trim() !== '' ? v : undefined; };
    const day = days.get(d) ?? { date: d };
    const s = n(iSteps); if (s !== undefined) day.steps = Math.round((day.steps ?? 0) + s);
    const a = n(iActive); if (a !== undefined) day.activeMinutes = Math.round((day.activeMinutes ?? 0) + a);
    const z = n(iSleep); if (z !== undefined) day.sleepMinutes = Math.round((day.sleepMinutes ?? 0) + (sleepHours ? z * 60 : z));
    days.set(d, day);
  }
  return { days: [...days.values()].filter((d) => d.steps !== undefined || d.activeMinutes !== undefined || d.sleepMinutes !== undefined).slice(-400), workouts: [] };
}

/* ------------------------------------------------------------------ Apple Health export */

const APPLE_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/;
/** "2026-11-05 07:00:00 +0400" -> an ISO instant. */
export const appleTime = (s: string) => { const m = APPLE_DATE.exec(s); return m ? new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`).toISOString() : new Date(s).toISOString(); };
const SLEEP_ASLEEP = /HKCategoryValueSleepAnalysisAsleep/;

/**
 * Totals from Apple Health's export.xml, fed in pieces (it can be hundreds of MB). Steps and exercise minutes are
 * added up per day (Apple writes each sample once per device, so the iPhone and Watch both count: the larger of the
 * two per day is kept); sleep is the time asleep that ended on that day; workouts are kept whole.
 */
export class AppleHealthReader {
  private buf = '';
  private steps = new Map<string, Map<string, number>>(); // day -> device -> steps
  private exercise = new Map<string, number>();
  private sleep = new Map<string, number>();
  readonly workouts: WorkoutIn[] = [];
  constructor(private since: string) {}

  feed(chunk: string) {
    this.buf += chunk;
    let i: number;
    while ((i = this.buf.indexOf('>')) >= 0) {
      const tag = this.buf.slice(0, i + 1); this.buf = this.buf.slice(i + 1);
      const at = tag.lastIndexOf('<'); if (at < 0) continue;
      this.tag(tag.slice(at));
    }
    if (this.buf.length > 1_000_000) this.buf = this.buf.slice(-100_000); // never hold a broken file in memory
  }

  private tag(t: string) {
    if (t.startsWith('<Record ')) {
      const type = attr(t, 'type'); const start = attr(t, 'startDate'); if (!type || !start) return;
      const day = start.slice(0, 10); if (day < this.since) return;
      if (type === 'HKQuantityTypeIdentifierStepCount') {
        const dev = attr(t, 'sourceName') ?? '?'; const v = Number(attr(t, 'value'));
        if (Number.isFinite(v)) { const m = this.steps.get(day) ?? new Map(); m.set(dev, (m.get(dev) ?? 0) + v); this.steps.set(day, m); }
      } else if (type === 'HKQuantityTypeIdentifierAppleExerciseTime') {
        const v = Number(attr(t, 'value')); if (Number.isFinite(v)) this.exercise.set(day, (this.exercise.get(day) ?? 0) + v);
      } else if (type === 'HKCategoryTypeIdentifierSleepAnalysis' && SLEEP_ASLEEP.test(attr(t, 'value') ?? '')) {
        const end = attr(t, 'endDate'); if (!end) return;
        const mins = (Date.parse(appleTime(end)) - Date.parse(appleTime(start))) / 60_000;
        if (mins > 0 && mins < 960) this.sleep.set(end.slice(0, 10), (this.sleep.get(end.slice(0, 10)) ?? 0) + mins);
      }
    } else if (t.startsWith('<Workout ')) {
      const start = attr(t, 'startDate'); if (!start || start.slice(0, 10) < this.since) return;
      const unit = attr(t, 'durationUnit') ?? 'min'; const d = Number(attr(t, 'duration'));
      const minutes = unit === 'min' ? d : unit === 's' ? d / 60 : unit === 'hr' ? d * 60 : d;
      const dist = Number(attr(t, 'totalDistance')); const du = attr(t, 'totalDistanceUnit');
      const type = (attr(t, 'workoutActivityType') ?? 'other').replace('HKWorkoutActivityType', '');
      if (Number.isFinite(minutes) && minutes >= 1) this.workouts.push({ id: `apple-${start}`, sport: type, title: type.replace(/([a-z])([A-Z])/g, '$1 $2'), start: appleTime(start), minutes: Math.round(minutes), distanceKm: Number.isFinite(dist) && dist > 0 ? round(du === 'mi' ? dist * 1.609 : du === 'm' ? dist / 1000 : dist) : null });
    }
  }

  result(): Parsed {
    const dates = new Set([...this.steps.keys(), ...this.exercise.keys(), ...this.sleep.keys()]);
    const days = [...dates].sort().map((date) => {
      const s = this.steps.get(date); const day: DayIn = { date };
      if (s) day.steps = Math.round(Math.max(...s.values()));
      if (this.exercise.has(date)) day.activeMinutes = Math.round(this.exercise.get(date)!);
      if (this.sleep.has(date)) day.sleepMinutes = Math.round(Math.min(960, this.sleep.get(date)!));
      return day;
    });
    return { days: days.slice(-400), workouts: this.workouts.slice(-1000) };
  }
}

/* ------------------------------------------------------------------ zip (Apple's export.zip) */

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

/** Open one file inside a zip as a stream of bytes (stored or deflated; zip64 sizes too), without reading the rest. */
export async function zipEntry(file: Blob, want: RegExp): Promise<{ name: string; stream: ReadableStream<Uint8Array> } | null> {
  const tailLen = Math.min(file.size, 66_000 + 22);
  const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  let cdSize = u32(tail, eocd + 12); let cdOff = u32(tail, eocd + 16);
  if (cdOff === 0xffffffff || cdSize === 0xffffffff) {
    // zip64: the locator sits just before the end record
    const loc = eocd - 20;
    if (loc >= 0 && u32(tail, loc) === 0x07064b50) {
      const recOff = Number(tail.getBigUint64(loc + 8, true));
      const rec = new DataView(await file.slice(recOff, recOff + 56).arrayBuffer());
      cdSize = Number(rec.getBigUint64(40, true)); cdOff = Number(rec.getBigUint64(48, true));
    }
  }
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  for (let p = 0; p + 46 <= cd.byteLength && u32(cd, p) === 0x02014b50;) {
    const method = u16(cd, p + 10); let comp = u32(cd, p + 20); const nameLen = u16(cd, p + 28); const extraLen = u16(cd, p + 30); const commentLen = u16(cd, p + 32);
    let local = u32(cd, p + 42);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    // zip64 extra field: the real sizes and offset
    for (let e = p + 46 + nameLen; e + 4 <= p + 46 + nameLen + extraLen;) {
      const id = u16(cd, e); const len = u16(cd, e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (u32(cd, p + 24) === 0xffffffff) q += 8; // uncompressed size
        if (comp === 0xffffffff) { comp = Number(cd.getBigUint64(q, true)); q += 8; }
        if (local === 0xffffffff) local = Number(cd.getBigUint64(q, true));
      }
      e += 4 + len;
    }
    if (want.test(name)) {
      const lh = new DataView(await file.slice(local, local + 30).arrayBuffer());
      if (u32(lh, 0) !== 0x04034b50) throw new Error('damaged zip file');
      const start = local + 30 + u16(lh, 26) + u16(lh, 28);
      const raw = file.slice(start, start + comp).stream();
      if (method === 0) return { name, stream: raw };
      if (method === 8) return { name, stream: raw.pipeThrough(new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>) };
      throw new Error('this zip uses a compression Murshid cannot open');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

/** Read Apple Health's export (zip or xml), the last `days` days, reporting progress (0–1). */
export async function readAppleExport(file: File, days = 60, onProgress?: (x: number) => void): Promise<Parsed> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const reader = new AppleHealthReader(since);
  let stream: ReadableStream<Uint8Array>; let total = file.size;
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    const e = await zipEntry(file, /(^|\/)export\.xml$/);
    if (!e) throw new Error('no export.xml inside this zip: is it the Health export?');
    stream = e.stream; total = file.size * 12; // deflated XML grows roughly ten-fold
  } else stream = file.stream();
  const r = stream.pipeThrough(new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>).getReader();
  let seen = 0;
  for (;;) {
    const { done, value } = await r.read(); if (done) break;
    reader.feed(value); seen += value.length;
    onProgress?.(Math.min(0.99, seen / total));
  }
  onProgress?.(1);
  return reader.result();
}

/** Pick the right reader for a file. */
export async function readHealthFile(file: File, onProgress?: (x: number) => void): Promise<Parsed & { kind: 'apple' | 'gpx' | 'tcx' | 'csv' }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip') || (name.endsWith('.xml') && /export/.test(name))) return { kind: 'apple', ...(await readAppleExport(file, 60, onProgress)) };
  if (file.size > 30 * 1024 * 1024) throw new Error('this file is too big: export a shorter range');
  const text = await file.text();
  if (name.endsWith('.gpx') || /<gpx[\s>]/.test(text.slice(0, 2000))) { const w = parseGpx(text); if (!w) throw new Error('no timed track in this GPX file'); return { kind: 'gpx', days: [], workouts: [w] }; }
  if (name.endsWith('.tcx') || /<TrainingCenterDatabase/.test(text.slice(0, 2000))) { const w = parseTcx(text); if (!w) throw new Error('no activity in this TCX file'); return { kind: 'tcx', days: [], workouts: [w] }; }
  if (name.endsWith('.csv') || name.endsWith('.txt')) { const p = parseCsv(text); if (!p.days.length) throw new Error('no date and steps, active minutes or sleep columns found'); return { kind: 'csv', ...p }; }
  throw new Error('Murshid reads GPX, TCX and CSV files, and the Apple Health export (zip or xml)');
}
