import { todayIso } from '../util.js';
import type { Opportunity, Source } from '../types.js';
import { buildOpportunity, type RawItem } from './build.js';
import { findDates } from './dates.js';

/** Devpost public JSON: https://devpost.com/api/hackathons?status[]=upcoming&status[]=open */
interface DevpostHackathon {
  title: string;
  url: string;
  organization_name?: string | null;
  submission_period_dates?: string;
  open_state?: string;
  displayed_location?: { location?: string };
  themes?: Array<{ name: string }>;
  invite_only?: boolean;
}

export function parseDevpost(json: unknown, now: Date): RawItem[] {
  const list = (json as { hackathons?: DevpostHackathon[] }).hackathons ?? [];
  return list
    .filter((h) => !h.invite_only)
    .map((h) => {
      // "Aug 31 - Oct 23, 2026" → end date is the submission deadline
      const period = h.submission_period_dates ?? '';
      const parts = period.split(/\s+-\s+/);
      const endPart = parts.at(-1) ?? '';
      const yr = /(20\d{2})/.exec(period)?.[1];
      const endText = yr && !endPart.includes(yr) ? `${endPart}, ${yr}` : endPart;
      const end = findDates(endText, now).at(-1)?.iso ?? null;
      const loc = h.displayed_location?.location ?? '';
      const themes = (h.themes ?? []).map((t) => t.name);
      return {
        title: h.title,
        url: h.url,
        organizer: h.organization_name ?? 'Devpost',
        deadline: end,
        type: 'hackathon' as const,
        text: `${h.title}. ${themes.join(', ')}. ${loc}. Submission period ${period}.`,
        country: /online/i.test(loc) ? 'Online' : loc || null,
        tags: themes.map((t) => t.toLowerCase()),
      };
    });
}

/** Codeforces: https://codeforces.com/api/contest.list?gym=false (phase BEFORE = upcoming). */
interface CfContest {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds?: number;
}

export function parseCodeforces(json: unknown): RawItem[] {
  const res = (json as { status?: string; result?: CfContest[] }).result ?? [];
  return res
    .filter((c) => c.phase === 'BEFORE' && c.startTimeSeconds)
    .map((c) => ({
      title: c.name,
      url: `https://codeforces.com/contests/${c.id}`,
      organizer: 'Codeforces',
      deadline: todayIso(new Date(c.startTimeSeconds! * 1000)),
      type: 'competition' as const,
      cost_aed: 0,
      country: 'Online',
      text: `${c.name}. Online competitive programming contest. Free to participate.`,
      tags: ['coding', 'competitive-programming', 'online'],
    }));
}

export function extractFromApi(body: string, source: Source, now: Date): Opportunity[] {
  const json: unknown = JSON.parse(body);
  let raws: RawItem[];
  if (source.url.includes('devpost.com')) raws = parseDevpost(json, now);
  else if (source.url.includes('codeforces.com')) raws = parseCodeforces(json);
  else throw new Error(`No API adapter for source ${source.id}`);
  return raws.map((r) => buildOpportunity(r, source, { now }));
}
