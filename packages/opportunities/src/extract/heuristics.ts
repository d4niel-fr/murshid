/** Generic rule-based field extractors (grade/age eligibility, cost, nationality, type, tags, emirate). */
import type { Emirate, OpportunityType } from '../types.js';

const clampGrade = (g: number) => Math.max(1, Math.min(13, g));
/** UAE convention: Grade 1 starts at age 6, so grade ≈ age - 5 at the start of the school year. */
export const ageToGrade = (age: number) => clampGrade(age - 5);
/** UK "Year N" ≈ US/UAE "Grade N-1". */
export const ukYearToGrade = (year: number) => clampGrade(year - 1);

export interface GradeRange {
  min: number | null;
  max: number | null;
  evidence: string | null;
}

const DASH = '\\s*(?:-|–|—|to|through|and)\\s*';

/**
 * Extract a grade range. Priority: explicit grades > ages > UK years > phrases.
 * (UK single years below Year 5 are ignored: they're usually counters like "Year 1, Year 2".)
 * Multiple explicit ranges are merged (min of mins, max of maxes).
 */
export function extractGradeRange(text: string): GradeRange {
  const t = text.replace(/\s+/g, ' ');
  const ranges: Array<[number, number, string]> = [];
  let m: RegExpExecArray | null;

  const gradeRe = new RegExp(`\\bgrades?\\s*(\\d{1,2})(?:${DASH}(?:grade\\s*)?(\\d{1,2}))?\\b`, 'gi');
  while ((m = gradeRe.exec(t)) !== null) {
    const a = +m[1]!, b = m[2] ? +m[2] : a;
    if (a >= 1 && a <= 13 && b >= a && b <= 13) ranges.push([a, b, m[0]]);
  }
  const ordRe = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)(?:${DASH}(\\d{1,2})(?:st|nd|rd|th))?\\s*grade`, 'gi');
  while ((m = ordRe.exec(t)) !== null) {
    const a = +m[1]!, b = m[2] ? +m[2] : a;
    if (a >= 1 && b <= 13 && b >= a) ranges.push([a, b, m[0]]);
  }
  if (ranges.length) {
    return { min: Math.min(...ranges.map((r) => r[0])), max: Math.max(...ranges.map((r) => r[1])), evidence: ranges[0]![2] };
  }

  const ageRe = new RegExp(`\\b(?:aged?|ages)\\s*(?:between\\s*)?(\\d{1,2})(?:${DASH}(\\d{1,2}))?`, 'gi');
  const ageRe2 = new RegExp(`\\b(\\d{1,2})(?:${DASH}(\\d{1,2}))\\s*(?:years?\\s*old|year-olds|yrs)`, 'gi');
  for (const re of [ageRe, ageRe2]) {
    while ((m = re.exec(t)) !== null) {
      const a = +m[1]!, b = m[2] ? +m[2] : a;
      if (a >= 8 && b <= 25 && b >= a) ranges.push([ageToGrade(a), ageToGrade(Math.min(b, 18)), m[0]]);
    }
  }
  if (ranges.length) {
    return { min: Math.min(...ranges.map((r) => r[0])), max: Math.max(...ranges.map((r) => r[1])), evidence: ranges[0]![2] };
  }

  const yearRe = new RegExp(`\\byears?\\s*(\\d{1,2})(?:${DASH}(?:year\\s*)?(\\d{1,2}))?\\b`, 'gi');
  while ((m = yearRe.exec(t)) !== null) {
    const a = +m[1]!, b = m[2] ? +m[2] : a;
    if (a >= 2 && a <= 14 && b >= a && b <= 14 && (m[2] || a >= 5)) ranges.push([ukYearToGrade(a), ukYearToGrade(b), m[0]]);
  }
  if (ranges.length) {
    return { min: Math.min(...ranges.map((r) => r[0])), max: Math.max(...ranges.map((r) => r[1])), evidence: ranges[0]![2] };
  }

  const phrases: Array<[RegExp, number, number]> = [
    [/rising seniors?/i, 11, 12],
    [/rising juniors?/i, 10, 11],
    [/rising sophomores?/i, 9, 10],
    [/high[- ]school (?:students|seniors|juniors|level)|secondary school students|pre-college|precollege|teens?\b/i, 9, 12],
    [/middle school/i, 6, 8],
    [/undergraduate|university students|college students/i, 13, 13],
  ];
  for (const [re, a, b] of phrases) {
    const mm = re.exec(t);
    if (mm) return { min: a, max: b, evidence: mm[0] };
  }
  return { min: null, max: null, evidence: null };
}

const FX_TO_AED: Record<string, number> = { AED: 1, USD: 3.6725, $: 3.6725, GBP: 4.6, '£': 4.6, EUR: 4.0, '€': 4.0, INR: 0.044, '₹': 0.044 };

export interface CostInfo {
  cost_aed: number | null;
  evidence: string | null;
}

/**
 * Cost detection. "free"/"no cost"/"fully funded" → 0. Otherwise the largest tuition-like amount
 * near a fee keyword, converted to AED with static rates (refresh rates later; not critical for ranking).
 */
export function extractCost(text: string): CostInfo {
  const t = text.replace(/\s+/g, ' ');
  const amountRe = /(AED|USD|GBP|EUR|INR|\$|£|€|₹)\s?,?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s?(AED|USD|GBP|EUR|dirhams?)/gi;
  const feeKw = /(tuition|fee|fees|cost|price|program(?:me)? fee|registration|charge)/i;
  const found: Array<{ aed: number; raw: string; nearFee: boolean; tuition: boolean; appFee: boolean }> = [];
  let m: RegExpExecArray | null;
  while ((m = amountRe.exec(t)) !== null) {
    const cur = (m[1] ?? m[4] ?? 'AED').toUpperCase().replace(/DIRHAMS?/, 'AED');
    const num = +(m[2] ?? m[3] ?? '0').replace(/,/g, '');
    const rate = FX_TO_AED[cur] ?? FX_TO_AED[m[1] ?? ''] ?? 1;
    const ctx = t.slice(Math.max(0, m.index - 60), m.index);
    const prizeCtx = /(prize|award|win|scholarship worth|grant of|million)/i.test(ctx);
    if (prizeCtx) continue;
    const near = ctx.slice(-30);
    found.push({ aed: Math.round(num * rate), raw: m[0], nearFee: feeKw.test(ctx), tuition: /(tuition|program(?:me)? fee|course fee)\W*$/i.test(near), appFee: /application fee\W*$/i.test(near) });
  }
  const fee = found.filter((f) => f.nearFee);
  if (fee.length) {
    // Prefer an explicit tuition/program fee; else the largest fee-adjacent amount that isn't an application fee.
    const tuition = fee.find((f) => f.tuition);
    const nonApp = fee.filter((f) => !f.appFee);
    const best = tuition ?? (nonApp.length ? nonApp : fee).reduce((a, b) => (b.aed > a.aed ? b : a));
    return { cost_aed: best.aed, evidence: best.raw };
  }
  const free = /\b(free of charge|free to (?:enter|participate|apply|join)|no (?:cost|fee|charge)|tuition[- ]free|fully[- ]funded|at no cost|free\b(?! time| trial))/i.exec(t);
  if (free) return { cost_aed: 0, evidence: free[0] };
  return { cost_aed: null, evidence: null };
}

/** Nationality restriction detection. Returns a normalized string or null (open to all / unknown). */
export function extractNationality(text: string): string | null {
  const t = text.replace(/\s+/g, ' ');
  const rules: Array<[RegExp, string]> = [
    [/(emirati (?:students|nationals|passport|citizens)(?: only)?|uae nationals\b|uae national (?:students|only|citizens)|hold an emirati passport|for emiratis|emirati youth|young emiratis)/i, 'UAE nationals only'],
    [/(u\.?s\.? citizens?(?: or permanent residents)?(?: only)?|must be a us citizen|united states citizens)/i, 'US citizens/residents only'],
    [/(uk residents? only|must be (?:a )?uk resident|resident in the uk)/i, 'UK residents only'],
    [/(gcc nationals?)/i, 'GCC nationals only'],
    [/(indian nationals? only|indian citizens only)/i, 'Indian nationals only'],
  ];
  // Negations like "both UAE national and non-UAE national students are eligible"
  if (/non-?uae nationals?|all nationalities|open to (?:students of )?all nationalities|any nationality/i.test(t)) return null;
  for (const [re, label] of rules) if (re.test(t)) return label;
  return null;
}

const TYPE_RULES: Array<[RegExp, OpportunityType]> = [
  [/\bolympiad\b/i, 'olympiad'],
  [/\bmodel united nations\b|\bMUN\b/i, 'mun'],
  [/\bhackathon\b|\bhack\b(?!er)/i, 'hackathon'],
  [/\bscholarships?\b/i, 'scholarship'],
  [/\binternships?\b|job shadow/i, 'internship'],
  [/\bvolunteer(?:ing|s)?\b/i, 'volunteering'],
  [/\bsummer (?:program|programme|school|camp|session|academy)|\bboot ?camp\b|\bcamp\b|pre-college|precollege/i, 'summer_program'],
  [/\bcompetition|challenge|contest|prize|award|fair\b/i, 'competition'],
  [/\bcourse\b|workshop|program(?:me)?\b/i, 'course'],
];

export function inferType(text: string, fallback: OpportunityType = 'competition'): OpportunityType {
  for (const [re, ty] of TYPE_RULES) if (re.test(text)) return ty;
  return fallback;
}

const TAG_RULES: Array<[RegExp, string]> = [
  [/\b(ai|artificial intelligence|machine learning|ml)\b/i, 'ai'],
  [/\brobot/i, 'robotics'],
  [/\b(coding|programming|software|computer science|informatics|python|app development|apps?)\b/i, 'coding'],
  [/\bcyber ?security|ethical hacking|ctf\b/i, 'cybersecurity'],
  [/\bdata science|analytics\b/i, 'data-science'],
  [/\bmath(?:s|ematics)?\b/i, 'math'],
  [/\bphysics\b/i, 'physics'],
  [/\bchemi(?:stry|cal)\b/i, 'chemistry'],
  [/\bbiolog|biotech|life science/i, 'biology'],
  [/\bmedic(?:al|ine)|health\b/i, 'medicine'],
  [/\bspace|astronom|satellite|astronaut/i, 'space'],
  [/\bengineering\b/i, 'engineering'],
  [/\bresearch\b/i, 'research'],
  [/\bsustainab|climate|environment|water\b/i, 'sustainability'],
  [/\bentrepreneur|startup|business|venture/i, 'entrepreneurship'],
  [/\bfinance|investing|investment|economics?\b/i, 'finance'],
  [/\bwriting|essay|literature|poetry|creative writing/i, 'writing'],
  [/\bdebate|public speaking|model united nations|\bMUN\b/i, 'debate'],
  [/\b(arts?|fine art|film|music|photography|graphic design|interactive media)\b/i, 'arts'],
  [/\bleadership\b/i, 'leadership'],
  [/\bcommunity|volunteer|social impact/i, 'community'],
  [/\barabic\b/i, 'arabic'],
  [/\buniversity prep|college application|common ?app/i, 'university-prep'],
];

export function inferTags(text: string, base: string[] = []): string[] {
  const set = new Set(base.map((x) => x.toLowerCase()));
  for (const [re, tag] of TAG_RULES) if (re.test(text)) set.add(tag);
  if (/\bonline|virtual|remote\b/i.test(text)) set.add('online');
  return [...set].sort();
}

const EMIRATES: Array<[RegExp, Emirate]> = [
  [/abu dhabi|al ain|saadiyat/i, 'Abu Dhabi'],
  [/\bdubai\b/i, 'Dubai'],
  [/\bsharjah\b/i, 'Sharjah'],
  [/\bajman\b/i, 'Ajman'],
  [/umm al quwain/i, 'Umm Al Quwain'],
  [/ras al khaimah|\bRAK\b/, 'Ras Al Khaimah'],
  [/fujairah/i, 'Fujairah'],
];

/** Pick the most-mentioned emirate (ties → first match), or null. */
export function inferEmirate(text: string): Emirate | null {
  let best: Emirate | null = null;
  let bestCount = 0;
  for (const [re, e] of EMIRATES) {
    const n = (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) ?? []).length;
    if (n > bestCount) {
      best = e;
      bestCount = n;
    }
  }
  return best;
}

/** Short eligibility snippet: ±110-char windows around eligibility cues, merged, max ~300 chars. */
export function extractEligibilityText(text: string): string | null {
  const t = text.replace(/\s+/g, ' ');
  const cue = /(eligib\w*|open to|who can apply|must be|grades?\s*\d{1,2}\s*(?:-|–|to)\s*\d{1,2}|aged?\s*\d{1,2}|ages\s*\d{1,2}|nationals?\b|students in (?:grade|year))/gi;
  const windows: Array<[number, number]> = [];
  let m: RegExpExecArray | null;
  while ((m = cue.exec(t)) !== null) {
    const s = Math.max(0, m.index - 40);
    const e = Math.min(t.length, m.index + m[0].length + 110);
    const last = windows.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else windows.push([s, e]);
    if (windows.length >= 3) break;
  }
  if (!windows.length) return null;
  const joined = windows.map(([s, e]) => t.slice(s, e).trim()).join(' … ');
  return joined.length > 300 ? joined.slice(0, 297) + '...' : joined;
}
