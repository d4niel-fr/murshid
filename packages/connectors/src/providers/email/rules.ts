import type { MaterialKind } from '../../core/types';
import type { ParsedEmail } from './mime';

export type LmsSource = 'google_classroom' | 'teams' | 'phoenix' | 'managebac' | 'generic';

export interface RuleMatch {
  lms: LmsSource;
  title: string;
  courseName: string | null;
  kind: MaterialKind;
  url: string | null;
  confidence: number; // 0..1, rule-based
}

export interface EmailRule {
  lms: LmsSource;
  matches(e: ParsedEmail): boolean;
  extract(e: ParsedEmail): RuleMatch | null;
}

const lines = (t: string) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
/** search visible text first, then raw HTML (links often live only in href attributes) */
const firstUrl = (e: ParsedEmail, host?: RegExp) => {
  const t = `${e.text}\n${e.html ?? ''}`;
  for (const m of t.matchAll(/https?:\/\/[^\s<>")\]]+/g)) if (!host || host.test(m[0])) return m[0];
  return null;
};
const unquote = (s: string) => s.replace(/^["“”'‘’]+|["“”'‘’]+$/g, '').trim();
const kindFromWord = (w: string): MaterialKind =>
  /announcement|post/i.test(w) ? 'announcement' : /material|resource|note/i.test(w) ? 'note' : /question|assignment|task|homework/i.test(w) ? 'assignment' : 'assignment';

/**
 * Google Classroom (no-reply@classroom.google.com).
 * Subject: New assignment: "Lab Report 2" | New material: "..." | New question: "..."
 * Body: "<Teacher> posted a new assignment in <Course>"
 */
export const googleClassroomRule: EmailRule = {
  lms: 'google_classroom',
  matches: (e) => /@classroom\.google\.com$/.test(e.fromAddress),
  extract(e) {
    const sm = /^(?:Fwd?:\s*)?(?:New|Updated)\s+(assignment|material|question|announcement)\s*:\s*(.+)$/i.exec(e.subject);
    const posted = /posted a new (assignment|material|question|announcement) in (.+?)(?:\s*$|\n)/im.exec(e.text);
    if (!sm && !posted) return null;
    const word = sm?.[1] ?? posted?.[1] ?? 'assignment';
    const title = sm ? unquote(sm[2]!) : (lines(e.text)[1] ?? e.subject);
    return {
      lms: 'google_classroom',
      title,
      courseName: posted?.[2]?.trim() ?? null,
      kind: kindFromWord(word),
      url: firstUrl(e, /classroom\.google\.com/),
      confidence: sm && posted ? 0.95 : 0.8,
    };
  },
};

/**
 * Microsoft Teams assignments (noreply@email.teams.microsoft.com).
 * Subject: "New assignment in <Class>: <Title>" or "New assignment: <Title>"
 */
export const teamsRule: EmailRule = {
  lms: 'teams',
  matches: (e) => /teams\.microsoft\.com$|@microsoft\.com$/.test(e.fromAddress) && /assignment/i.test(e.subject + e.text),
  extract(e) {
    const a = /^(?:Fwd?:\s*)?New assignment in (.+?):\s*(.+)$/i.exec(e.subject);
    const b = /^(?:Fwd?:\s*)?New assignment:\s*(.+)$/i.exec(e.subject);
    if (!a && !b) return null;
    const cls = a?.[1] ?? /^(?:Class|Team):\s*(.+)$/im.exec(e.text)?.[1] ?? null;
    return {
      lms: 'teams',
      title: unquote((a?.[2] ?? b?.[1])!),
      courseName: cls?.trim() ?? null,
      kind: 'assignment',
      url: firstUrl(e, /teams\.microsoft\.com/),
      confidence: a ? 0.9 : 0.75,
    };
  },
};

/**
 * GEMS Phoenix (GEMS Education LMS). Format is NOT publicly documented; this
 * rule targets the label/value layout of school notification digests and must
 * be validated against real forwarded samples. Matches sender name/address
 * containing "phoenix" or a GEMS domain plus an Assignment label.
 */
export const phoenixRule: EmailRule = {
  lms: 'phoenix',
  matches: (e) => /phoenix/i.test(e.from) || (/gems(edu|education|world)/i.test(e.fromAddress) && /assignment|homework/i.test(e.text)),
  extract(e) {
    const title =
      /^(?:Assignment|Homework|Task)(?:\s+(?:Title|Name))?\s*:\s*(.+)$/im.exec(e.text)?.[1] ??
      /^(?:Fwd?:\s*)?(?:New\s+)?(?:Assignment|Homework)\s*[:\-–]\s*(.+)$/i.exec(e.subject)?.[1];
    if (!title) return null;
    const subject = /^(?:Subject|Course|Class)\s*:\s*(.+)$/im.exec(e.text)?.[1] ?? null;
    const isExam = /^(?:Type|Category)\s*:\s*(.*(?:assessment|exam|test|quiz).*)$/im.test(e.text);
    return { lms: 'phoenix', title: title.trim(), courseName: subject?.trim() ?? null, kind: isExam ? 'exam' : 'assignment', url: firstUrl(e), confidence: 0.7 };
  },
};

/**
 * ManageBac (notifications@managebac.com and school subdomains).
 * Subject: "New Task: <Title>" / "Task Reminder: <Title>"; body has class name then "Due: ..."
 */
export const managebacRule: EmailRule = {
  lms: 'managebac',
  matches: (e) => /managebac\.com$/.test(e.fromAddress) || /managebac/i.test(e.from),
  extract(e) {
    const sm = /^(?:Fwd?:\s*)?(?:New Task|Task Reminder|Task Updated|Upcoming Task)\s*:\s*(.+?)(?:\s+\((.+)\))?$/i.exec(e.subject);
    if (!sm) return null;
    const cls = sm[2] ?? /^(?:Class|Subject)\s*:\s*(.+)$/im.exec(e.text)?.[1] ?? null;
    const summative = /^Type\s*:\s*summative/im.test(e.text);
    return {
      lms: 'managebac',
      title: sm[1]!.trim(),
      courseName: cls?.trim() ?? null,
      kind: summative ? 'exam' : 'assignment',
      url: firstUrl(e, /managebac/),
      confidence: 0.9,
    };
  },
};

/** Fallback: anything with a due line. Low confidence. AI-LATER: LLM extractor replaces this. */
export const genericRule: EmailRule = {
  lms: 'generic',
  matches: (e) => /\b(due|deadline|submit by)\b/i.test(e.text),
  extract: (e) => ({
    lms: 'generic',
    title: e.subject.replace(/^(?:fwd?|re):\s*/gi, '').trim() || '(untitled)',
    courseName: null,
    kind: 'assignment',
    url: firstUrl(e),
    confidence: 0.4,
  }),
};

export const DEFAULT_RULES: EmailRule[] = [googleClassroomRule, teamsRule, managebacRule, phoenixRule, genericRule];
